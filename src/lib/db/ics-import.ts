import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types.ts'
import { getSchoolTerms } from './onboarding.ts'
import { fetchIcsFeed, type ParsedIcsEvent } from '../schedule/ics.ts'
import { todayInTimezone } from '../schedule/week-bounds.ts'

type ImportStatus = Database['public']['Enums']['import_status']

// ---------------------------------------------------------------------
// Mapping (task 3) — resolves the feed's raw events into calendar days,
// using whatever mapping the admin has already saved. Anything with no
// mapping yet is surfaced separately as needing attention rather than
// guessed at.
// ---------------------------------------------------------------------

export type MappingAction = 'school_day' | 'no_school' | 'ignore'
export type SummaryMappingEntry = { action: MappingAction; dayTypeCode?: string; variantId?: string }
export type SummaryMapping = Record<string, SummaryMappingEntry>

export type ResolvedCalendarDay = {
  date: string
  isSchoolDay: boolean
  dayTypeCode: string | null
  variantId: string | null
  note: string | null
}

// Pure: no database access. When more than one mapped event lands on the
// same date (a real ICS feed can list a holiday and a rotation-day event
// on the same day), the last one wins — there's no reliable way to know
// which is "more specific" from the summary text alone, so this is the
// simplest deterministic rule rather than a guess.
export function resolveCalendarDays(
  events: ParsedIcsEvent[],
  mapping: SummaryMapping
): { resolved: ResolvedCalendarDay[]; unmappedSummaries: string[] } {
  const unmapped = new Set<string>()
  const byDate = new Map<string, ResolvedCalendarDay>()

  for (const event of events) {
    const entry = mapping[event.summary]
    if (!entry) {
      unmapped.add(event.summary)
      continue
    }
    if (entry.action === 'ignore') continue

    if (entry.action === 'no_school') {
      byDate.set(event.date, { date: event.date, isSchoolDay: false, dayTypeCode: null, variantId: null, note: event.summary })
    } else {
      byDate.set(event.date, {
        date: event.date,
        isSchoolDay: true,
        dayTypeCode: entry.dayTypeCode ?? null,
        variantId: entry.variantId ?? null,
        note: null,
      })
    }
  }

  return {
    resolved: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    unmappedSummaries: [...unmapped].sort(),
  }
}

// ---------------------------------------------------------------------
// Diff (task 4) — added / changed / removed, plus what approving it
// would mean for slots and rounds already on that date.
// ---------------------------------------------------------------------

export type ExistingCalendarDay = {
  date: string
  isSchoolDay: boolean
  dayTypeCode: string | null
  variantId: string | null
  variantName: string | null
  manuallySet: boolean
  totalSlots: number
  // Same "not cancelled or expired" definition slots.ts's
  // upsertSlotsForRange already uses to decide which slots it will never
  // touch — this has to match that function exactly, since it's the
  // thing that actually determines what survives a regeneration.
  protectedRounds: number
}

export type DiffSide = {
  isSchoolDay: boolean
  dayTypeCode: string | null
  // variantId/note are only ever populated on the `after` side — that's
  // the side writeDiffEntries actually persists, and it needs the real
  // id, not just the display name, without re-deriving it from the
  // mapping a second time.
  variantId: string | null
  variantName: string | null
  note: string | null
} | null

export type DiffEntry = {
  date: string
  kind: 'added' | 'changed' | 'removed'
  before: DiffSide
  after: DiffSide
  // A manually-set existing entry never gets silently overwritten (task
  // 5) — this entry is excluded from the bundled "approve batch" action
  // and needs its own explicit override.
  conflictsWithManual: boolean
  openSlotsAffected: number
  protectedRounds: number
}

// Pure: no database access — variantIdToName is a pre-fetched lookup
// table, same "pass the lookup data in" pattern archive.ts's shaping
// functions use for terms.
//
// `existing` is queried across the school's whole current-and-upcoming
// term range (syncIcsSource), which can be much wider than what this
// particular feed actually returns — a real ICS subscription is
// typically a rolling window, not the entire school year (see the step
// file's own note on this). `datesWithAnyEvent` is every date the feed
// had *any* event on this sync, mapped or not; `feedSpan` is its
// observed min/max. A "removed" entry only fires for an existing school
// day that falls *inside* the feed's own observed span but has no event
// at all there anymore — a date the feed simply hasn't reached yet
// (outside the span) is left alone entirely, and a date with only an
// unmapped/ignored event is a "needs attention" case, not a removal.
// Getting this wrong means a feed that only covers the next few weeks
// could silently wipe out a school's entire later term.
export function computeDiff(
  resolved: ResolvedCalendarDay[],
  existing: ExistingCalendarDay[],
  variantIdToName: Map<string, string>,
  feedSpan: { start: string; end: string } | null,
  datesWithAnyEvent: Set<string>
): DiffEntry[] {
  const existingByDate = new Map(existing.map((e) => [e.date, e]))
  const resolvedByDate = new Map(resolved.map((r) => [r.date, r]))
  const allDates = new Set([...existingByDate.keys(), ...resolvedByDate.keys()])

  const entries: DiffEntry[] = []

  for (const date of allDates) {
    const before = existingByDate.get(date) ?? null
    const after = resolvedByDate.get(date) ?? null

    const beforeSide: DiffSide = before
      ? { isSchoolDay: before.isSchoolDay, dayTypeCode: before.dayTypeCode, variantId: null, variantName: before.variantName, note: null }
      : null

    if (!before && after) {
      entries.push({
        date,
        kind: 'added',
        before: null,
        after: {
          isSchoolDay: after.isSchoolDay,
          dayTypeCode: after.dayTypeCode,
          variantId: after.variantId,
          variantName: after.variantId ? (variantIdToName.get(after.variantId) ?? null) : null,
          note: after.note,
        },
        conflictsWithManual: false,
        openSlotsAffected: 0,
        protectedRounds: 0,
      })
      continue
    }

    if (before && !after) {
      // Never a day already marked no-school — nothing meaningful would
      // change. Never a date the feed still has an event on, even an
      // unmapped one (see above). Never a date outside this sync's
      // observed feed span — the feed never had an opinion about it.
      if (!before.isSchoolDay) continue
      if (datesWithAnyEvent.has(date)) continue
      if (!feedSpan || date < feedSpan.start || date > feedSpan.end) continue
      entries.push({
        date,
        kind: 'removed',
        before: beforeSide,
        after: { isSchoolDay: false, dayTypeCode: null, variantId: null, variantName: null, note: 'No longer on the calendar feed.' },
        conflictsWithManual: before.manuallySet,
        openSlotsAffected: before.totalSlots - before.protectedRounds > 0 ? before.totalSlots - before.protectedRounds : 0,
        protectedRounds: before.protectedRounds,
      })
      continue
    }

    if (before && after) {
      const changed =
        before.isSchoolDay !== after.isSchoolDay || before.dayTypeCode !== after.dayTypeCode || before.variantId !== after.variantId
      if (!changed) continue
      entries.push({
        date,
        kind: 'changed',
        before: beforeSide,
        after: {
          isSchoolDay: after.isSchoolDay,
          dayTypeCode: after.dayTypeCode,
          variantId: after.variantId,
          variantName: after.variantId ? (variantIdToName.get(after.variantId) ?? null) : null,
          note: after.note,
        },
        conflictsWithManual: before.manuallySet,
        openSlotsAffected: before.totalSlots - before.protectedRounds > 0 ? before.totalSlots - before.protectedRounds : 0,
        protectedRounds: before.protectedRounds,
      })
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

export type StoredDiff = { entries: DiffEntry[]; unmappedSummaries: string[]; rangeStart: string; rangeEnd: string }

// ---------------------------------------------------------------------
// Sync (tasks 4, 6, 7) — the shared logic behind both the admin's
// "Sync now" action and the daily cron route. Takes an injectable
// client, same pattern as slots.ts's upsertSlotsForRange: the cron route
// has no session at all and uses the service role; the admin action
// passes their own RLS-respecting session.
// ---------------------------------------------------------------------

export type SyncOutcome =
  | { ok: true; batchId: string | null; entryCount: number; unmappedCount: number }
  | { ok: false; error: string }

export async function syncIcsSource(sourceId: string, client: SupabaseClient<Database>): Promise<SyncOutcome> {
  const { data: source, error: sourceError } = await client
    .from('ics_sources')
    .select('id, school_id, url, summary_mapping')
    .eq('id', sourceId)
    .single()

  if (sourceError || !source) return { ok: false, error: 'That feed no longer exists.' }

  const { data: school, error: schoolError } = await client.from('schools').select('timezone').eq('id', source.school_id).single()
  if (schoolError || !school) return { ok: false, error: 'Could not load the school.' }

  const terms = await getSchoolTerms(source.school_id, client)
  const today = todayInTimezone(school.timezone)
  const upcomingTerms = terms.filter((t) => t.endsOn >= today)

  if (upcomingTerms.length === 0) {
    await client
      .from('ics_sources')
      .update({ last_synced_at: new Date().toISOString(), last_status: 'no_terms', last_error: null })
      .eq('id', sourceId)
    return { ok: true, batchId: null, entryCount: 0, unmappedCount: 0 }
  }

  const rangeStart = upcomingTerms.reduce((min, t) => (t.startsOn < min ? t.startsOn : min), upcomingTerms[0].startsOn)
  const rangeEnd = upcomingTerms.reduce((max, t) => (t.endsOn > max ? t.endsOn : max), upcomingTerms[0].endsOn)

  const fetchResult = await fetchIcsFeed(source.url, school.timezone, rangeStart, rangeEnd)
  if (!fetchResult.ok) {
    // Task 6: the failure is recorded, but calendar_days is never
    // touched — the last known good calendar stays exactly as it was.
    await client.from('ics_sources').update({ last_status: 'failed', last_error: fetchResult.error }).eq('id', sourceId)
    return { ok: false, error: fetchResult.error }
  }

  const mapping = (source.summary_mapping ?? {}) as SummaryMapping
  const { resolved, unmappedSummaries } = resolveCalendarDays(fetchResult.events, mapping)

  // Every date this sync's feed actually had an event on, mapped or
  // not — bounds how far computeDiff is allowed to treat a missing date
  // as "removed" rather than "the feed never reached that far." A feed
  // with zero events has no span at all, so nothing can ever be flagged
  // removed from an empty result.
  const eventDates = fetchResult.events.map((e) => e.date)
  const datesWithAnyEvent = new Set(eventDates)
  const feedSpan =
    eventDates.length > 0
      ? { start: eventDates.reduce((min, d) => (d < min ? d : min)), end: eventDates.reduce((max, d) => (d > max ? d : max)) }
      : null

  const { data: existingRaw, error: existingError } = await client
    .from('calendar_days')
    .select(
      `
      date, is_school_day, variant_id, manually_set,
      day_types ( code ),
      schedule_variants ( name ),
      slots ( rounds ( status ) )
    `
    )
    .eq('school_id', source.school_id)
    .gte('date', rangeStart)
    .lte('date', rangeEnd)

  if (existingError) return { ok: false, error: existingError.message }

  const existing: ExistingCalendarDay[] = (existingRaw ?? []).map((row) => {
    const slots = row.slots ?? []
    const protectedRounds = slots.filter((s) =>
      (s.rounds ?? []).some((r) => r.status !== 'cancelled' && r.status !== 'expired')
    ).length
    return {
      date: row.date,
      isSchoolDay: row.is_school_day,
      dayTypeCode: row.day_types?.code ?? null,
      variantId: row.variant_id,
      variantName: row.schedule_variants?.name ?? null,
      manuallySet: row.manually_set,
      totalSlots: slots.length,
      protectedRounds,
    }
  })

  const resolvedVariantIds = [...new Set(resolved.map((r) => r.variantId).filter((v): v is string => v !== null))]
  const variantIdToName = new Map<string, string>()
  if (resolvedVariantIds.length > 0) {
    const { data: variantsRaw, error: variantsError } = await client
      .from('schedule_variants')
      .select('id, name')
      .in('id', resolvedVariantIds)
    if (variantsError) return { ok: false, error: variantsError.message }
    for (const v of variantsRaw ?? []) variantIdToName.set(v.id, v.name)
  }

  const entries = computeDiff(resolved, existing, variantIdToName, feedSpan, datesWithAnyEvent)

  const diff: StoredDiff = { entries, unmappedSummaries, rangeStart, rangeEnd }

  const { data: batch, error: batchError } = await client
    .from('ics_import_batches')
    .insert({ school_id: source.school_id, source_id: sourceId, status: 'pending' as ImportStatus, diff })
    .select('id')
    .single()

  if (batchError || !batch) return { ok: false, error: batchError?.message ?? 'Could not save the import batch.' }

  await client.from('ics_sources').update({ last_synced_at: new Date().toISOString(), last_status: 'ok', last_error: null }).eq('id', sourceId)

  return { ok: true, batchId: batch.id, entryCount: entries.length, unmappedCount: unmappedSummaries.length }
}

// ---------------------------------------------------------------------
// Approve / reject a batch (task 4)
// ---------------------------------------------------------------------

export type BatchDetail = {
  id: string
  status: ImportStatus
  createdAt: string
  approvedAt: string | null
  diff: StoredDiff
}

export async function getBatch(batchId: string, client: SupabaseClient<Database>): Promise<BatchDetail | null> {
  const { data, error } = await client
    .from('ics_import_batches')
    .select('id, status, created_at, approved_at, diff')
    .eq('id', batchId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    status: data.status,
    createdAt: data.created_at,
    approvedAt: data.approved_at,
    diff: data.diff as StoredDiff,
  }
}

// Writes every non-conflicting entry to calendar_days, closes (never
// deletes — see decisions.md's "nothing is ever hard deleted" note in
// schema.sql) any of that date's slots that have no protected round,
// then regenerates via the existing upsertSlotsForRange so school-day
// entries actually produce real slots. A day type named in the diff but
// not yet in day_types gets created here, same find-or-create pattern
// saveRotation already uses for the manual path.
export async function approveBatch(
  batchId: string,
  approvedBy: string,
  client: SupabaseClient<Database>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: batchRow, error: batchError } = await client
    .from('ics_import_batches')
    .select('id, school_id, status, diff')
    .eq('id', batchId)
    .maybeSingle()

  if (batchError) return { ok: false, error: batchError.message }
  if (!batchRow) return { ok: false, error: "That batch doesn't exist." }
  if (batchRow.status !== 'pending') return { ok: false, error: 'This batch was already resolved.' }

  const diff = batchRow.diff as StoredDiff
  const applicable = diff.entries.filter((e) => !e.conflictsWithManual)

  const result = await writeDiffEntries(batchRow.school_id, applicable, client)
  if (!result.ok) return result

  const { error: updateError } = await client
    .from('ics_import_batches')
    .update({ status: 'approved' as ImportStatus, approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', batchId)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

export async function rejectBatch(
  batchId: string,
  rejectedBy: string,
  client: SupabaseClient<Database>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: batchRow, error: batchError } = await client
    .from('ics_import_batches')
    .select('id, status')
    .eq('id', batchId)
    .maybeSingle()

  if (batchError) return { ok: false, error: batchError.message }
  if (!batchRow) return { ok: false, error: "That batch doesn't exist." }
  if (batchRow.status !== 'pending') return { ok: false, error: 'This batch was already resolved.' }

  const { error: updateError } = await client
    .from('ics_import_batches')
    .update({ status: 'rejected' as ImportStatus, approved_by: rejectedBy, approved_at: new Date().toISOString() })
    .eq('id', batchId)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

// A single conflicting (manually-set) date, approved on its own —
// task 5's "flags the conflict... and lets the admin choose" as a real
// per-date choice rather than a checkbox buried in the bundled approval.
export async function overrideConflictEntry(
  batchId: string,
  date: string,
  client: SupabaseClient<Database>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: batchRow, error: batchError } = await client
    .from('ics_import_batches')
    .select('id, school_id, diff')
    .eq('id', batchId)
    .maybeSingle()

  if (batchError) return { ok: false, error: batchError.message }
  if (!batchRow) return { ok: false, error: "That batch doesn't exist." }

  const diff = batchRow.diff as StoredDiff
  const entry = diff.entries.find((e) => e.date === date && e.conflictsWithManual)
  if (!entry) return { ok: false, error: 'No conflicting entry for that date.' }

  return writeDiffEntries(batchRow.school_id, [entry], client)
}

// Shared by approveBatch and overrideConflictEntry: writes calendar_days
// for a set of entries, closes now-orphaned open slots on any date that
// became non-school, then regenerates slots for the affected range.
async function writeDiffEntries(
  schoolId: string,
  entries: DiffEntry[],
  client: SupabaseClient<Database>
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (entries.length === 0) return { ok: true }

  const schoolDayEntries = entries.filter((e) => e.after?.isSchoolDay)
  const dayTypeCodes = [...new Set(schoolDayEntries.map((e) => e.after?.dayTypeCode).filter((c): c is string => Boolean(c)))]

  const codeToId = new Map<string, string>()
  if (dayTypeCodes.length > 0) {
    const { data: existingDayTypes, error: dayTypesError } = await client
      .from('day_types')
      .select('id, code')
      .eq('school_id', schoolId)
      .in('code', dayTypeCodes)
    if (dayTypesError) return { ok: false, error: dayTypesError.message }
    for (const d of existingDayTypes ?? []) codeToId.set(d.code, d.id)

    const missingCodes = dayTypeCodes.filter((c) => !codeToId.has(c))
    if (missingCodes.length > 0) {
      const { data: created, error: createError } = await client
        .from('day_types')
        .insert(missingCodes.map((code) => ({ school_id: schoolId, code })))
        .select('id, code')
      if (createError) return { ok: false, error: createError.message }
      for (const d of created ?? []) codeToId.set(d.code, d.id)
    }
  }

  const rows = entries.map((e) => ({
    school_id: schoolId,
    date: e.date,
    is_school_day: Boolean(e.after?.isSchoolDay),
    day_type_id: e.after?.dayTypeCode ? (codeToId.get(e.after.dayTypeCode) ?? null) : null,
    variant_id: e.after?.variantId ?? null,
    note: e.after?.note ?? null,
    source: 'feed' as const,
    manually_set: false,
  }))

  const { error: upsertError } = await client.from('calendar_days').upsert(rows, { onConflict: 'school_id,date' })
  if (upsertError) return { ok: false, error: upsertError.message }

  // Close (never delete) any slot on a now-non-school date that has no
  // protected round — the "cancels N open slots" half of task 4's diff
  // language, made real rather than just displayed.
  const closedDates = entries.filter((e) => !e.after?.isSchoolDay).map((e) => e.date)
  if (closedDates.length > 0) {
    const { data: calendarDaysToClose } = await client
      .from('calendar_days')
      .select('id, slots ( id, rounds ( status ) )')
      .eq('school_id', schoolId)
      .in('date', closedDates)

    const slotIdsToClose = (calendarDaysToClose ?? []).flatMap((cd) =>
      (cd.slots ?? [])
        .filter((s) => !(s.rounds ?? []).some((r) => r.status !== 'cancelled' && r.status !== 'expired'))
        .map((s) => s.id)
    )

    if (slotIdsToClose.length > 0) {
      const { error: closeError } = await client.from('slots').update({ is_open: false }).in('id', slotIdsToClose)
      if (closeError) return { ok: false, error: closeError.message }
    }
  }

  const range = entries.map((e) => e.date).sort()
  const { upsertSlotsForRange } = await import('./slots.ts')
  await upsertSlotsForRange(schoolId, range[0], range[range.length - 1], { client })

  return { ok: true }
}

// ---------------------------------------------------------------------
// Feed configuration (task 1) and mapping persistence (task 3) — the
// richer, revisitable version of what onboarding.ts's linkCalendarFeed
// built as a one-time wizard placeholder. ics_sources has no unique
// constraint on school_id, so this treats "one feed per school" as an
// application-level rule (find the existing row and update it) rather
// than relying on the database to enforce it, matching how
// getCalendarSource already infers the manual/feed choice from presence
// rather than a second source of truth.
// ---------------------------------------------------------------------

export type IcsSourceSummary = {
  id: string
  url: string
  summaryMapping: SummaryMapping
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
}

export async function getIcsSource(schoolId: string): Promise<IcsSourceSummary | null> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ics_sources')
    .select('id, url, summary_mapping, last_synced_at, last_status, last_error')
    .eq('school_id', schoolId)
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    url: data.url,
    summaryMapping: (data.summary_mapping ?? {}) as SummaryMapping,
    lastSyncedAt: data.last_synced_at,
    lastStatus: data.last_status,
    lastError: data.last_error,
  }
}

export async function saveFeedUrl(schoolId: string, url: string): Promise<string> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from('ics_sources')
    .select('id')
    .eq('school_id', schoolId)
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing) {
    const { error } = await supabase.from('ics_sources').update({ url }).eq('id', existing.id)
    if (error) throw error
    return existing.id
  }

  const { data: created, error: createError } = await supabase
    .from('ics_sources')
    .insert({ school_id: schoolId, url, is_active: true })
    .select('id')
    .single()
  if (createError || !created) throw createError ?? new Error('Could not save the feed URL.')
  return created.id
}

// Merges one summary's mapping into the jsonb column rather than
// replacing the whole object — two admins editing different summaries
// around the same time shouldn't be able to clobber each other's saves,
// and re-fetching first (rather than a blind read-modify-write against a
// client-held copy) keeps that true.
export async function saveSummaryMapping(sourceId: string, summary: string, entry: SummaryMappingEntry): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data: source, error: fetchError } = await supabase
    .from('ics_sources')
    .select('summary_mapping')
    .eq('id', sourceId)
    .single()
  if (fetchError) throw fetchError

  const mapping = { ...((source.summary_mapping ?? {}) as SummaryMapping), [summary]: entry }

  const { error } = await supabase.from('ics_sources').update({ summary_mapping: mapping }).eq('id', sourceId)
  if (error) throw error
}

export type BatchSummary = {
  id: string
  status: ImportStatus
  createdAt: string
  entryCount: number
  unmappedCount: number
  conflictCount: number
}

export async function getRecentBatches(schoolId: string, limit = 10): Promise<BatchSummary[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ics_import_batches')
    .select('id, status, created_at, diff')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row) => {
    const diff = row.diff as StoredDiff
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      entryCount: diff.entries.length,
      unmappedCount: diff.unmappedSummaries.length,
      conflictCount: diff.entries.filter((e) => e.conflictsWithManual).length,
    }
  })
}
