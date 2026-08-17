import type { Database } from './types.ts'
import { getSchoolTerms, type SchoolTerm } from './onboarding.ts'
import { dateInTimezone } from '../schedule/week-bounds.ts'

type LinkKind = Database['public']['Enums']['link_kind']
type RoundStatus = Database['public']['Enums']['round_status']
type DebateSide = Database['public']['Enums']['debate_side']

export type ArchiveParticipant = {
  userId: string
  displayName: string
  role: 'debater' | 'judge'
  team: 1 | 2 | null
}

export type ArchiveRound = {
  id: string
  slotLabel: string
  startsAt: string
  endsAt: string
  termId: string | null
  termName: string | null
  debaters: ArchiveParticipant[]
  judge: ArchiveParticipant | null
  winningTeam: 1 | 2 | null
  team1Side: DebateSide | null
  rfd: string | null
  hasVideo: boolean
  hasSpeechDoc: boolean
}

export type ArchiveFilters = {
  person?: string
  term?: string
  video?: boolean
  q?: string
}

type RawParticipant = { user_id: string; role: string; team: number | null; profiles: { display_name: string } | null }
type RawResult = {
  id: string
  winning_team: number
  team1_side: string
  rfd: string
  supersedes: string | null
  submitted_at: string
}
export type RawArchiveRound = {
  id: string
  slots: { label: string; starts_at: string; ends_at: string } | null
  round_participants: RawParticipant[]
  round_results: RawResult[]
  round_links: { kind: string }[]
}

// Shared by archive.ts's two shaping functions — a result is the "current"
// one when nothing else's supersedes points at it. Same logic as
// results.ts's shapePostRoundForm, duplicated rather than imported since
// it's five lines and the two modules otherwise have no reason to depend
// on each other.
function pickCurrentResult<T extends { id: string; supersedes: string | null; submitted_at: string }>(
  results: T[]
): T | null {
  if (results.length === 0) return null
  const supersededIds = new Set(results.map((r) => r.supersedes).filter((id): id is string => id !== null))
  const sorted = [...results].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  return sorted.find((r) => !supersededIds.has(r.id)) ?? null
}

// Pure: no database access. Matches the round's slot to a term by date
// range in the school's own timezone — there's no stored term_id
// anywhere in the schema (same date-range approach step 13's leaderboard
// and participation pages use), so this has to be recomputed here too.
export function shapeArchiveRound(raw: RawArchiveRound, terms: SchoolTerm[], timeZone: string): ArchiveRound | null {
  if (!raw.slots) return null

  const participants = raw.round_participants
    .map((p) => ({
      userId: p.user_id,
      displayName: p.profiles?.display_name,
      role: p.role as 'debater' | 'judge',
      team: p.team as 1 | 2 | null,
    }))
    .filter((p): p is ArchiveParticipant => Boolean(p.displayName))

  const debaters = participants
    .filter((p) => p.role === 'debater')
    .sort((a, b) => (a.team ?? 0) - (b.team ?? 0) || a.displayName.localeCompare(b.displayName))
  const judge = participants.find((p) => p.role === 'judge') ?? null

  const currentResult = pickCurrentResult(raw.round_results)

  const dateStr = dateInTimezone(raw.slots.starts_at, timeZone)
  const term = terms.find((t) => t.startsOn <= dateStr && dateStr <= t.endsOn) ?? null

  const linkKinds = new Set(raw.round_links.map((l) => l.kind))

  return {
    id: raw.id,
    slotLabel: raw.slots.label,
    startsAt: raw.slots.starts_at,
    endsAt: raw.slots.ends_at,
    termId: term?.id ?? null,
    termName: term?.name ?? null,
    debaters,
    judge,
    winningTeam: currentResult ? (currentResult.winning_team as 1 | 2) : null,
    team1Side: currentResult ? (currentResult.team1_side as DebateSide) : null,
    rfd: currentResult?.rfd ?? null,
    hasVideo: linkKinds.has('video'),
    hasSpeechDoc: linkKinds.has('speech_doc'),
  }
}

// Pure: filters an already-shaped list and sorts newest first. All four
// filters combine with AND — "person" matches either a debater or the
// judge, "q" is a case-insensitive substring match against the RFD only.
export function shapeArchive(rounds: ArchiveRound[], filters: ArchiveFilters): ArchiveRound[] {
  let result = rounds

  if (filters.person) {
    const personId = filters.person
    result = result.filter((r) => r.debaters.some((d) => d.userId === personId) || r.judge?.userId === personId)
  }
  if (filters.term) {
    result = result.filter((r) => r.termId === filters.term)
  }
  if (filters.video) {
    result = result.filter((r) => r.hasVideo)
  }
  if (filters.q && filters.q.trim()) {
    const needle = filters.q.trim().toLowerCase()
    result = result.filter((r) => Boolean(r.rfd?.toLowerCase().includes(needle)))
  }

  return [...result].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}

// Impure: one query for completed rounds (joining slots, round_participants
// -> profiles, round_results, and round_links' kind only — the archive
// list only ever needs to know whether a video/speech doc exists, not the
// full link details), plus school timezone, the term list, and the
// school's active-member list for the person filter's dropdown. No
// explicit filters parameter — filtering happens via the separate
// shapeArchive call, so the unfiltered list stays cacheable/reusable
// across different filter combinations in the same request if ever
// needed.
export async function getArchive(
  schoolId: string
): Promise<{ rounds: ArchiveRound[]; terms: SchoolTerm[]; people: { id: string; displayName: string }[] }> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const [{ data: school, error: schoolError }, terms, { data: rows, error: roundsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('schools').select('timezone').eq('id', schoolId).single(),
      getSchoolTerms(schoolId),
      supabase
        .from('rounds')
        .select(
          `
          id,
          slots ( label, starts_at, ends_at ),
          round_participants ( user_id, role, team, profiles ( display_name ) ),
          round_results ( id, winning_team, team1_side, rfd, supersedes, submitted_at ),
          round_links ( kind )
        `
        )
        .eq('school_id', schoolId)
        .eq('status', 'completed'),
      supabase.from('profiles').select('id, display_name').eq('school_id', schoolId).eq('is_active', true).order('display_name'),
    ])

  if (schoolError) throw schoolError
  if (roundsError) throw roundsError
  if (profilesError) throw profilesError

  const timeZone = school?.timezone ?? 'America/New_York'

  const raw: RawArchiveRound[] = (rows ?? []).map((r) => ({
    id: r.id,
    slots: r.slots ? { label: r.slots.label, starts_at: r.slots.starts_at, ends_at: r.slots.ends_at } : null,
    round_participants: (r.round_participants ?? []).map((p) => ({
      user_id: p.user_id,
      role: p.role,
      team: p.team,
      profiles: p.profiles ? { display_name: p.profiles.display_name } : null,
    })),
    round_results: (r.round_results ?? []).map((res) => ({
      id: res.id,
      winning_team: res.winning_team,
      team1_side: res.team1_side,
      rfd: res.rfd,
      supersedes: res.supersedes,
      submitted_at: res.submitted_at,
    })),
    round_links: (r.round_links ?? []).map((l) => ({ kind: l.kind })),
  }))

  const rounds = raw
    .map((r) => shapeArchiveRound(r, terms, timeZone))
    .filter((r): r is ArchiveRound => r !== null)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))

  const people = (profiles ?? []).map((p) => ({ id: p.id, displayName: p.display_name }))

  return { rounds, terms, people }
}

export type RoundLink = {
  id: string
  kind: LinkKind
  url: string
  label: string | null
  addedByDisplayName: string | null
  createdAt: string
}

export type RoundDetail = {
  id: string
  status: RoundStatus
  slotLabel: string
  startsAt: string
  endsAt: string
  termName: string | null
  debaters: ArchiveParticipant[]
  judge: ArchiveParticipant | null
  winningTeam: 1 | 2 | null
  team1Side: DebateSide | null
  rfd: string | null
  resultSubmittedAt: string | null
  links: RoundLink[]
}

type RawRoundDetail = {
  id: string
  status: string
  slots: { label: string; starts_at: string; ends_at: string } | null
  round_participants: RawParticipant[]
  round_results: RawResult[]
  round_links: {
    id: string
    kind: string
    url: string
    label: string | null
    created_at: string
    profiles: { display_name: string } | null
  }[]
}

// Pure: no database access. `round_notes` is deliberately never selected
// or passed in here — this is the public round-detail/archive view, not
// the judge-facing post-round form (results.ts), and step 11's per-debater
// note privacy rules have no place on a page every school member can
// already reach. Only the current (non-superseded) result is shown —
// correction history stays on /round/[id]/result, which already handles
// it.
export function shapeRoundDetail(raw: RawRoundDetail, terms: SchoolTerm[], timeZone: string): RoundDetail | null {
  if (!raw.slots) return null

  const participants = raw.round_participants
    .map((p) => ({
      userId: p.user_id,
      displayName: p.profiles?.display_name,
      role: p.role as 'debater' | 'judge',
      team: p.team as 1 | 2 | null,
    }))
    .filter((p): p is ArchiveParticipant => Boolean(p.displayName))

  const debaters = participants
    .filter((p) => p.role === 'debater')
    .sort((a, b) => (a.team ?? 0) - (b.team ?? 0) || a.displayName.localeCompare(b.displayName))
  const judge = participants.find((p) => p.role === 'judge') ?? null

  const currentResult = pickCurrentResult(raw.round_results)

  const dateStr = dateInTimezone(raw.slots.starts_at, timeZone)
  const term = terms.find((t) => t.startsOn <= dateStr && dateStr <= t.endsOn) ?? null

  const links: RoundLink[] = raw.round_links
    .map((l) => ({
      id: l.id,
      kind: l.kind as LinkKind,
      url: l.url,
      label: l.label,
      addedByDisplayName: l.profiles?.display_name ?? null,
      createdAt: l.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    id: raw.id,
    status: raw.status as RoundStatus,
    slotLabel: raw.slots.label,
    startsAt: raw.slots.starts_at,
    endsAt: raw.slots.ends_at,
    termName: term?.name ?? null,
    debaters,
    judge,
    winningTeam: currentResult ? (currentResult.winning_team as 1 | 2) : null,
    team1Side: currentResult ? (currentResult.team1_side as DebateSide) : null,
    rfd: currentResult?.rfd ?? null,
    resultSubmittedAt: currentResult?.submitted_at ?? null,
    links,
  }
}

// Impure. No schoolId parameter — the round's own school_id (read back
// from the row RLS already scoped to the caller's school) drives the
// follow-up term/timezone lookups, same "RLS already did the real
// filtering" reasoning as results.ts's getPostRoundForm.
export async function getRoundDetail(roundId: string): Promise<RoundDetail | null> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rounds')
    .select(
      `
      id, status, school_id,
      slots ( label, starts_at, ends_at ),
      round_participants ( user_id, role, team, profiles ( display_name ) ),
      round_results ( id, winning_team, team1_side, rfd, supersedes, submitted_at ),
      round_links ( id, kind, url, label, created_at, profiles ( display_name ) )
    `
    )
    .eq('id', roundId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const [terms, { data: school, error: schoolError }] = await Promise.all([
    getSchoolTerms(data.school_id),
    supabase.from('schools').select('timezone').eq('id', data.school_id).single(),
  ])
  if (schoolError) throw schoolError

  const raw: RawRoundDetail = {
    id: data.id,
    status: data.status,
    slots: data.slots ? { label: data.slots.label, starts_at: data.slots.starts_at, ends_at: data.slots.ends_at } : null,
    round_participants: (data.round_participants ?? []).map((p) => ({
      user_id: p.user_id,
      role: p.role,
      team: p.team,
      profiles: p.profiles ? { display_name: p.profiles.display_name } : null,
    })),
    round_results: (data.round_results ?? []).map((r) => ({
      id: r.id,
      winning_team: r.winning_team,
      team1_side: r.team1_side,
      rfd: r.rfd,
      supersedes: r.supersedes,
      submitted_at: r.submitted_at,
    })),
    round_links: (data.round_links ?? []).map((l) => ({
      id: l.id,
      kind: l.kind,
      url: l.url,
      label: l.label,
      created_at: l.created_at,
      profiles: l.profiles ? { display_name: l.profiles.display_name } : null,
    })),
  }

  return shapeRoundDetail(raw, terms, school?.timezone ?? 'America/New_York')
}
