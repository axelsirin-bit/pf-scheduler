import type { Database } from './types.ts'
import { rotationToCalendarDays, type HolidayInput } from '../schedule/rotation.ts'

// Every write in this file goes through the regular RLS-respecting client,
// never the service role — the wizard is always a real signed-in admin's
// own action on their own school, and period_templates/template_blocks/
// day_types/schedule_variants/calendar_days/rooms/roster_invites/
// school_terms/ics_sources all already have working "admin, own school"
// policies from step 03. There's no reason to bypass RLS for any of this.
//
// server.ts is imported dynamically throughout, same reasoning as
// week.ts/rounds.ts/results.ts: keeps this file loadable by Vitest without
// dragging in next/headers at import time.

// ---------------------------------------------------------------------
// Step A: basics
// ---------------------------------------------------------------------

export type SchoolBasics = {
  id: string
  name: string
  slug: string
  timezone: string
  status: Database['public']['Enums']['school_status']
  expectedRoundsPerTerm: number
}

export async function getSchoolBasics(schoolId: string): Promise<SchoolBasics | null> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, timezone, status, expected_rounds_per_term')
    .eq('id', schoolId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    status: data.status,
    expectedRoundsPerTerm: data.expected_rounds_per_term,
  }
}

export async function updateSchoolBasics(
  schoolId: string,
  input: { name: string; slug: string; timezone: string; expectedRoundsPerTerm: number }
): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase
    .from('schools')
    .update({
      name: input.name,
      slug: input.slug,
      timezone: input.timezone,
      expected_rounds_per_term: input.expectedRoundsPerTerm,
    })
    .eq('id', schoolId)

  if (error) throw error
}

export type SchoolTerm = { id: string; name: string; startsOn: string; endsOn: string }

export async function getSchoolTerms(schoolId: string): Promise<SchoolTerm[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('school_terms')
    .select('id, name, starts_on, ends_on')
    .eq('school_id', schoolId)
    .order('starts_on')

  if (error) throw error
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, startsOn: t.starts_on, endsOn: t.ends_on }))
}

export async function addSchoolTerm(
  schoolId: string,
  input: { name: string; startsOn: string; endsOn: string }
): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase
    .from('school_terms')
    .insert({ school_id: schoolId, name: input.name, starts_on: input.startsOn, ends_on: input.endsOn })

  if (error) throw error
}

// ---------------------------------------------------------------------
// Step B: calendar source
// ---------------------------------------------------------------------

// No dedicated column tracks this choice — it's inferred from whether an
// ics_sources row exists, avoiding a second source of truth that could
// drift from the actual data.
export async function getCalendarSource(schoolId: string): Promise<'manual' | 'feed'> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('ics_sources')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)

  if (error) throw error
  return count && count > 0 ? 'feed' : 'manual'
}

// Only ever touches ics_sources — switching a manually configured school to
// a linked feed must not alter existing templates or calendar_days (see
// step 12's acceptance criteria), and this function structurally can't,
// since it's the only table it writes to. Real parsing/sync is step 16;
// this just records the URL.
export async function linkCalendarFeed(schoolId: string, url: string): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase.from('ics_sources').insert({ school_id: schoolId, url, is_active: true })

  if (error) throw error
}

// ---------------------------------------------------------------------
// Step C: period templates
// ---------------------------------------------------------------------

export type TemplateBlockInput = {
  label: string
  startTime: string
  endTime: string
  isBookable: boolean
  sortOrder: number
}

export type PeriodTemplateWithBlocks = {
  id: string
  name: string
  blocks: (TemplateBlockInput & { id: string })[]
}

export async function getPeriodTemplates(schoolId: string): Promise<PeriodTemplateWithBlocks[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('period_templates')
    .select(
      'id, name, template_blocks ( id, label, start_time, end_time, is_bookable, sort_order )'
    )
    .eq('school_id', schoolId)
    .order('name')

  if (error) throw error

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    blocks: (t.template_blocks ?? [])
      .map((b) => ({
        id: b.id,
        label: b.label,
        startTime: b.start_time,
        endTime: b.end_time,
        isBookable: b.is_bookable,
        sortOrder: b.sort_order,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

// Creates the template, its blocks, and a matching schedule_variants row in
// one call — calendar_days points at a variant, not a template directly,
// and the wizard's simple case is always one variant per template, named
// the same. Used for both first-time creation and adding another template
// later (task 4's "editing" only ever adds to or edits blocks in place —
// see updateTemplateBlock/addTemplateBlock below — never deletes a
// template, so this is the only creation path needed).
export async function createPeriodTemplate(
  schoolId: string,
  name: string,
  blocks: TemplateBlockInput[]
): Promise<{ templateId: string; variantId: string }> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data: template, error: templateError } = await supabase
    .from('period_templates')
    .insert({ school_id: schoolId, name })
    .select('id')
    .single()

  if (templateError || !template) throw new Error(templateError?.message ?? 'Could not create template.')

  if (blocks.length > 0) {
    const { error: blocksError } = await supabase.from('template_blocks').insert(
      blocks.map((b) => ({
        school_id: schoolId,
        template_id: template.id,
        label: b.label,
        start_time: b.startTime,
        end_time: b.endTime,
        is_bookable: b.isBookable,
        sort_order: b.sortOrder,
      }))
    )
    if (blocksError) throw blocksError
  }

  const { data: variant, error: variantError } = await supabase
    .from('schedule_variants')
    .insert({ school_id: schoolId, name, template_id: template.id })
    .select('id')
    .single()

  if (variantError || !variant) throw new Error(variantError?.message ?? 'Could not create schedule variant.')

  return { templateId: template.id, variantId: variant.id }
}

// "Duplicate an existing template as a starting point" (task C) — copies
// the blocks, not the id, so editing the copy never touches the original.
export async function duplicatePeriodTemplate(
  schoolId: string,
  sourceTemplateId: string,
  newName: string
): Promise<{ templateId: string; variantId: string }> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data: sourceBlocks, error: sourceError } = await supabase
    .from('template_blocks')
    .select('label, start_time, end_time, is_bookable, sort_order')
    .eq('template_id', sourceTemplateId)
    .order('sort_order')

  if (sourceError) throw sourceError

  return createPeriodTemplate(
    schoolId,
    newName,
    (sourceBlocks ?? []).map((b) => ({
      label: b.label,
      startTime: b.start_time,
      endTime: b.end_time,
      isBookable: b.is_bookable,
      sortOrder: b.sort_order,
    }))
  )
}

// Editing later (task 4): changes an existing block's own fields in place.
// Never deletes a block — template_blocks.id is referenced by
// slots.block_id with "on delete restrict", so a block that already has
// slots generated from it can't be removed anyway; this sidesteps that
// entirely by only ever offering add-or-edit, never delete, in this step's
// UI.
export async function updateTemplateBlock(blockId: string, input: TemplateBlockInput): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase
    .from('template_blocks')
    .update({
      label: input.label,
      start_time: input.startTime,
      end_time: input.endTime,
      is_bookable: input.isBookable,
      sort_order: input.sortOrder,
    })
    .eq('id', blockId)

  if (error) throw error
}

export async function addTemplateBlock(
  schoolId: string,
  templateId: string,
  input: TemplateBlockInput
): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase.from('template_blocks').insert({
    school_id: schoolId,
    template_id: templateId,
    label: input.label,
    start_time: input.startTime,
    end_time: input.endTime,
    is_bookable: input.isBookable,
    sort_order: input.sortOrder,
  })

  if (error) throw error
}

export async function getScheduleVariants(schoolId: string): Promise<{ id: string; name: string }[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schedule_variants')
    .select('id, name')
    .eq('school_id', schoolId)
    .order('name')

  if (error) throw error
  return data ?? []
}

// ---------------------------------------------------------------------
// Step D: rotation (manual calendar-source path only)
// ---------------------------------------------------------------------

export type SaveRotationInput = {
  sequence: string[]
  anchorDate: string
  termStart: string
  termEnd: string
  holidays: HolidayInput[]
  resetsWeekly: boolean
  defaultVariantId: string
}

export type SaveRotationResult = { schoolDays: number; holidayDays: number }

// Computes the calendar with the pure rotationToCalendarDays, then writes
// day_types (find-or-create per distinct code) and calendar_days
// (upserted by the existing unique (school_id, date) index — resubmitting
// this form after fixing a wrong anchor updates rows in place rather than
// duplicating them). Deliberately does NOT touch slots — see
// upsertSlotsForRange, called separately at the wizard's confirm step, so
// "nothing is written to slots until they confirm" (task 3) holds exactly.
export async function saveRotation(schoolId: string, input: SaveRotationInput): Promise<SaveRotationResult> {
  const entries = rotationToCalendarDays(
    input.sequence,
    input.anchorDate,
    input.termStart,
    input.termEnd,
    input.holidays,
    input.resetsWeekly
  )

  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const codes = [...new Set(entries.map((e) => e.dayCode).filter((c): c is string => c !== null))]

  const { data: existingDayTypes, error: dayTypesSelectError } = await supabase
    .from('day_types')
    .select('id, code')
    .eq('school_id', schoolId)
    .in('code', codes.length > 0 ? codes : [''])

  if (dayTypesSelectError) throw dayTypesSelectError

  const codeToId = new Map((existingDayTypes ?? []).map((d) => [d.code, d.id]))
  const missingCodes = codes.filter((c) => !codeToId.has(c))

  if (missingCodes.length > 0) {
    const { data: createdDayTypes, error: dayTypesInsertError } = await supabase
      .from('day_types')
      .insert(missingCodes.map((code) => ({ school_id: schoolId, code })))
      .select('id, code')

    if (dayTypesInsertError) throw dayTypesInsertError
    for (const d of createdDayTypes ?? []) codeToId.set(d.code, d.id)
  }

  const rows = entries.map((e) => ({
    school_id: schoolId,
    date: e.date,
    day_type_id: e.dayCode ? (codeToId.get(e.dayCode) ?? null) : null,
    variant_id: e.isSchoolDay ? input.defaultVariantId : null,
    is_school_day: e.isSchoolDay,
    note: e.note,
    source: 'manual' as const,
    manually_set: true,
  }))

  const { error: upsertError } = await supabase.from('calendar_days').upsert(rows, { onConflict: 'school_id,date' })
  if (upsertError) throw upsertError

  return {
    schoolDays: entries.filter((e) => e.isSchoolDay).length,
    holidayDays: entries.filter((e) => !e.isSchoolDay).length,
  }
}

// ---------------------------------------------------------------------
// Step E: rooms
// ---------------------------------------------------------------------

export async function createRoom(schoolId: string, name: string, note: string | null): Promise<void> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { error } = await supabase.from('rooms').insert({ school_id: schoolId, name, note })
  if (error) throw error
}

// ---------------------------------------------------------------------
// Step F: roster (minimal — step 15 adds listing, deactivation, revoke,
// and the invite rate limit on top of this)
// ---------------------------------------------------------------------

export type RosterEntryInput = { email: string; roles: Database['public']['Enums']['app_role'][] }
export type RosterInviteOutcome = { email: string; ok: boolean; error?: string; needsApproval?: boolean }

// One insert per row rather than a single bulk insert — roster_invites has
// a unique (school_id, lower(email)) index, and a bulk insert would fail
// the whole batch on the first duplicate. This gives per-email feedback
// instead, which matters for a pasted list where a few emails are often
// already invited. needs_approval is read back (not computed here) since
// step 15's roster_invites_rate_limit trigger is what actually decides it
// — this function doesn't duplicate that logic, just reports what happened.
export async function inviteRosterMembers(schoolId: string, entries: RosterEntryInput[]): Promise<RosterInviteOutcome[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const results: RosterInviteOutcome[] = []
  for (const entry of entries) {
    const { data, error } = await supabase
      .from('roster_invites')
      .insert({
        school_id: schoolId,
        email: entry.email,
        roles: entry.roles,
        age_confirmed: true,
      })
      .select('needs_approval')
      .single()

    if (error) {
      results.push({
        email: entry.email,
        ok: false,
        error: error.code === '23505' ? 'Already invited.' : error.message,
      })
    } else {
      results.push({ email: entry.email, ok: true, needsApproval: data?.needs_approval ?? false })
    }
  }

  return results
}

export type RosterInviteSummary = {
  id: string
  email: string
  roles: string[]
  claimedAt: string | null
  needsApproval: boolean
  approvedBy: string | null
  invitedBy: string | null
}

export async function getRosterInvites(schoolId: string): Promise<RosterInviteSummary[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roster_invites')
    .select('id, email, roles, claimed_at, needs_approval, approved_by, invited_by')
    .eq('school_id', schoolId)
    .order('email')

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    roles: r.roles,
    claimedAt: r.claimed_at,
    needsApproval: r.needs_approval,
    approvedBy: r.approved_by,
    invitedBy: r.invited_by,
  }))
}

// ---------------------------------------------------------------------
// Onboarding checklist (task 5) — data presence, not a stored "current
// step" pointer, so it can never drift from what's actually configured.
// ---------------------------------------------------------------------

export type OnboardingChecklistItem = { label: string; done: boolean; required: boolean; href: string }

export async function getOnboardingChecklist(schoolId: string): Promise<OnboardingChecklistItem[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const [{ count: termCount }, { count: templateCount }, { count: calendarCount }, { count: roomCount }, { count: adminInviteCount }, { data: school }] =
    await Promise.all([
      supabase.from('school_terms').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('period_templates').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('calendar_days').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabase
        .from('roster_invites')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .contains('roles', ['admin']),
      supabase.from('schools').select('status').eq('id', schoolId).single(),
    ])

  return [
    { label: 'Term dates added', done: (termCount ?? 0) > 0, required: true, href: '/admin/setup/basics' },
    { label: 'At least one period template', done: (templateCount ?? 0) > 0, required: true, href: '/admin/setup/templates' },
    { label: 'Calendar generated (manual or feed)', done: (calendarCount ?? 0) > 0, required: true, href: '/admin/setup/rotation' },
    { label: 'A room on the list', done: (roomCount ?? 0) > 0, required: false, href: '/admin/setup/rooms' },
    { label: 'A second admin invited', done: (adminInviteCount ?? 0) >= 2, required: false, href: '/admin/setup/roster' },
    { label: 'Setup confirmed', done: school?.status === 'active', required: true, href: '/admin/setup/preview' },
  ]
}
