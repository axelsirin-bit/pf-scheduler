import type { Database } from './types.ts'

type AppRole = Database['public']['Enums']['app_role']
type RoundStatus = Database['public']['Enums']['round_status']
type DebateSide = Database['public']['Enums']['debate_side']

export type PostRoundDebater = {
  userId: string
  displayName: string
  team: 1 | 2
}

export type PostRoundNote = {
  aboutUserId: string
  note: string
}

export type PostRoundResult = {
  id: string
  winningTeam: 1 | 2
  team1Side: DebateSide
  rfd: string
  submittedBy: string
  submittedAt: string
  supersedes: string | null
  // Already stripped per viewer — about_user, whoever wrote it, or an
  // admin. Nobody else, not even another debater in the same round.
  notes: PostRoundNote[]
}

export type PostRoundForm = {
  roundId: string
  slotId: string
  slotLabel: string
  startsAt: string
  endsAt: string
  status: RoundStatus
  judgeUserId: string | null
  debaters: PostRoundDebater[]
  isSlotStarted: boolean
  // The head of the supersedes chain — null if nobody has submitted yet.
  currentResult: PostRoundResult | null
  // Superseded results, oldest first — "the archive shows the latest and
  // links to the superseded one."
  priorResults: PostRoundResult[]
}

type RawParticipant = { user_id: string; role: string; team: number | null; profiles: { display_name: string } | null }
type RawNote = { about_user: string; note: string }
type RawResult = {
  id: string
  winning_team: number
  team1_side: string
  rfd: string
  submitted_by: string
  submitted_at: string
  supersedes: string | null
  round_notes: RawNote[]
}
export type RawPostRoundRound = {
  id: string
  status: string
  slot_id: string
  slots: { id: string; label: string; starts_at: string; ends_at: string } | null
  round_participants: RawParticipant[]
  round_results: RawResult[]
}

// Pure: no database access.
export function shapePostRoundForm(
  raw: RawPostRoundRound,
  userId: string,
  roles: AppRole[],
  now: Date
): PostRoundForm | null {
  if (!raw.slots) return null

  const isAdmin = roles.includes('admin')

  const debaters = raw.round_participants
    .filter((p) => p.role === 'debater')
    .map((p) => ({ userId: p.user_id, displayName: p.profiles?.display_name, team: p.team as 1 | 2 }))
    .filter((p): p is PostRoundDebater => Boolean(p.displayName))

  const judge = raw.round_participants.find((p) => p.role === 'judge') ?? null

  // A result is the current "head" of the chain when nothing else's
  // supersedes points at it.
  const supersededIds = new Set(
    raw.round_results.map((r) => r.supersedes).filter((id): id is string => id !== null)
  )
  const sorted = [...raw.round_results].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))

  function shapeResult(r: RawResult): PostRoundResult {
    return {
      id: r.id,
      winningTeam: r.winning_team as 1 | 2,
      team1Side: r.team1_side as DebateSide,
      rfd: r.rfd,
      submittedBy: r.submitted_by,
      submittedAt: r.submitted_at,
      supersedes: r.supersedes,
      notes: r.round_notes
        .filter((n) => isAdmin || n.about_user === userId || r.submitted_by === userId)
        .map((n) => ({ aboutUserId: n.about_user, note: n.note })),
    }
  }

  const currentRaw = sorted.find((r) => !supersededIds.has(r.id)) ?? null
  const priorRaw = sorted.filter((r) => r.id !== currentRaw?.id)

  return {
    roundId: raw.id,
    slotId: raw.slots.id,
    slotLabel: raw.slots.label,
    startsAt: raw.slots.starts_at,
    endsAt: raw.slots.ends_at,
    status: raw.status as RoundStatus,
    judgeUserId: judge?.user_id ?? null,
    debaters,
    isSlotStarted: new Date(raw.slots.starts_at).getTime() < now.getTime(),
    currentResult: currentRaw ? shapeResult(currentRaw) : null,
    priorResults: priorRaw.map(shapeResult),
  }
}

// Impure: one query, joining rounds -> slots, rounds -> round_participants
// -> profiles, and rounds -> round_results -> round_notes. No explicit
// school_id filter here (unlike getSlotDetail) — rounds_select and
// round_results_select RLS already scope everything to the caller's own
// school, and this function's signature (no schoolId parameter) leans on
// that rather than duplicating it.
export async function getPostRoundForm(
  roundId: string,
  userId: string,
  roles: AppRole[]
): Promise<PostRoundForm | null> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rounds')
    .select(
      `
      id, status, slot_id,
      slots ( id, label, starts_at, ends_at ),
      round_participants ( user_id, role, team, profiles ( display_name ) ),
      round_results (
        id, winning_team, team1_side, rfd, submitted_by, submitted_at, supersedes,
        round_notes ( about_user, note )
      )
    `
    )
    .eq('id', roundId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const raw: RawPostRoundRound = {
    id: data.id,
    status: data.status,
    slot_id: data.slot_id,
    slots: data.slots
      ? { id: data.slots.id, label: data.slots.label, starts_at: data.slots.starts_at, ends_at: data.slots.ends_at }
      : null,
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
      submitted_by: r.submitted_by,
      submitted_at: r.submitted_at,
      supersedes: r.supersedes,
      round_notes: (r.round_notes ?? []).map((n) => ({ about_user: n.about_user, note: n.note })),
    })),
  }

  return shapePostRoundForm(raw, userId, roles, new Date())
}

export type ResultNeededItem = {
  roundId: string
  slotId: string
  slotLabel: string
  startsAt: string
  endsAt: string
  status: RoundStatus
}

type RawResultNeededRound = {
  id: string
  status: string
  slots: { id: string; label: string; starts_at: string; ends_at: string } | null
  round_participants: { user_id: string; role: string }[]
  round_results: { id: string }[]
}

// Pure. Judges by status alone (status = 'awaiting_result') would only
// work once the not-yet-cron-wired sweep (round-lifecycle.ts) has actually
// run — this looks at the slot's real end time instead, so the judge's own
// page stays useful regardless of whether that sweep has run recently.
// 'awaiting_result' is still surfaced (via `status` on the returned item)
// as the stronger visual signal once it has.
export function shapeResultsNeeded(rounds: RawResultNeededRound[], userId: string, now: Date): ResultNeededItem[] {
  return rounds
    .filter((r): r is RawResultNeededRound & { slots: NonNullable<RawResultNeededRound['slots']> } => r.slots !== null)
    .filter((r) => new Date(r.slots.ends_at).getTime() < now.getTime())
    .filter((r) => r.round_results.length === 0)
    .filter((r) => r.round_participants.some((p) => p.user_id === userId && p.role === 'judge'))
    .map((r) => ({
      roundId: r.id,
      slotId: r.slots.id,
      slotLabel: r.slots.label,
      startsAt: r.slots.starts_at,
      endsAt: r.slots.ends_at,
      status: r.status as RoundStatus,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

// Impure. confirmed or awaiting_result rounds only — anything else either
// isn't ready for a result or already has one.
export async function getResultsNeeded(schoolId: string, userId: string): Promise<ResultNeededItem[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rounds')
    .select(
      'id, status, slots ( id, label, starts_at, ends_at ), round_participants ( user_id, role ), round_results ( id )'
    )
    .eq('school_id', schoolId)
    .in('status', ['confirmed', 'awaiting_result'])

  if (error) throw error

  const raw: RawResultNeededRound[] = (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    slots: r.slots
      ? { id: r.slots.id, label: r.slots.label, starts_at: r.slots.starts_at, ends_at: r.slots.ends_at }
      : null,
    round_participants: (r.round_participants ?? []).map((p) => ({ user_id: p.user_id, role: p.role })),
    round_results: (r.round_results ?? []).map((res) => ({ id: res.id })),
  }))

  return shapeResultsNeeded(raw, userId, new Date())
}

// submitResult/submitCorrection live in
// src/app/(app)/round/[id]/result/actions.ts, not here — Next.js won't
// allow an inline (function-level) "use server" export in a file that a
// Client Component also imports for other things (result-form.tsx needs
// ResultFormInput/SubmitResultResult from this module), so they need the
// same dedicated-file-with-file-level-"use server" shape every other
// action in this codebase already uses (week/actions.ts, slot/[id]/
// actions.ts). Found by actually trying to build, not guessed —
// see PROGRESS.md.
export type ResultNoteInput = { aboutUserId: string; note: string }
export type ResultFormInput = {
  winningTeam: 1 | 2
  team1Side: DebateSide
  rfd: string
  notes: ResultNoteInput[]
}

export type SubmitResultResult =
  | { ok: true; resultId: string; notesWarning?: string }
  | { ok: false; error: string }
