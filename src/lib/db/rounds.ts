import type { Database } from './types.ts'

type AppRole = Database['public']['Enums']['app_role']
type RoundStatus = Database['public']['Enums']['round_status']

export type SlotParticipant = {
  userId: string
  displayName: string
  role: 'debater' | 'judge'
  team: 1 | 2 | null
}

export type SlotRound = {
  id: string
  status: RoundStatus
  createdBy: string | null
  participants: SlotParticipant[]
  // Stripped to null unless the viewer is a participant or admin — same
  // rule as week.ts, but this is a separate payload surface with its own
  // query, so it needs its own stripping rather than inheriting week.ts's.
  room: string | null
  // Confirmed (5 people attached) but nobody has picked a room yet. Not a
  // separate round_status value — "ready" is a display idea layered on top
  // of confirmed + no room, not a new database state.
  needsRoom: boolean
}

export type SlotDetail = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  isPast: boolean
  isOpen: boolean
  available: { userId: string; displayName: string }[]
  // The single most relevant round for this slot, or null if none. A slot
  // can technically have more than one round row over time (one cancelled,
  // a fresh one started later — no unique constraint on rounds.slot_id,
  // see the slots table) — this picks the live one the same way
  // week.ts's pickRelevantRound does, since a detail page only needs to
  // feature one at a time.
  round: SlotRound | null
}

type RawParticipant = {
  user_id: string
  role: string
  team: number | null
  profiles: { display_name: string } | null
}
type RawRound = {
  id: string
  status: string
  created_by: string | null
  created_at: string
  room_freetext: string | null
  rooms: { name: string } | null
  round_participants: RawParticipant[]
}
type RawAvailability = { user_id: string; profiles: { display_name: string } | null }
export type RawSlotDetail = {
  id: string
  label: string
  starts_at: string
  ends_at: string
  is_open: boolean
  availabilities: RawAvailability[]
  rounds: RawRound[]
}

// Pure: no database access.
export function shapeSlotDetail(raw: RawSlotDetail, userId: string, roles: AppRole[], now: Date): SlotDetail {
  const isAdmin = roles.includes('admin')

  const available = raw.availabilities
    .map((a) => ({ userId: a.user_id, displayName: a.profiles?.display_name }))
    .filter((a): a is { userId: string; displayName: string } => Boolean(a.displayName))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const rawRound = pickRelevantRound(raw.rounds)
  let round: SlotRound | null = null

  if (rawRound) {
    const isParticipant = rawRound.round_participants.some((p) => p.user_id === userId)
    const roomVisible = rawRound.status === 'confirmed' && (isAdmin || isParticipant)
    const hasRoom = Boolean(rawRound.rooms?.name || rawRound.room_freetext)

    const participants = rawRound.round_participants
      .map((p) => ({
        userId: p.user_id,
        displayName: p.profiles?.display_name,
        role: p.role as 'debater' | 'judge',
        team: p.team as 1 | 2 | null,
      }))
      .filter((p): p is SlotParticipant => Boolean(p.displayName))

    round = {
      id: rawRound.id,
      status: rawRound.status as RoundStatus,
      createdBy: rawRound.created_by,
      participants,
      room: roomVisible ? (rawRound.rooms?.name ?? rawRound.room_freetext ?? null) : null,
      needsRoom: rawRound.status === 'confirmed' && !hasRoom,
    }
  }

  return {
    id: raw.id,
    label: raw.label,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    isPast: new Date(raw.starts_at).getTime() < now.getTime(),
    isOpen: raw.is_open,
    available,
    round,
  }
}

// Same "prefer live over dead, most recent first" rule as week.ts's
// pickRelevantRound — duplicated rather than imported, since it's ten lines
// and importing across these two db modules for a helper this small isn't
// worth the coupling.
function pickRelevantRound(rounds: RawRound[]): RawRound | null {
  if (rounds.length === 0) return null
  const live = rounds.filter((r) => r.status !== 'cancelled' && r.status !== 'expired')
  const pool = live.length > 0 ? live : rounds
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

// Impure: one query, joining slots -> availabilities -> profiles and
// slots -> rounds -> round_participants -> profiles/rooms. Same
// RLS-respecting-client-via-dynamic-import pattern as week.ts and
// slots.ts, for the same reason: keeps the pure shaping function above
// loadable by Vitest without dragging in next/headers.
export async function getSlotDetail(
  slotId: string,
  schoolId: string,
  userId: string,
  roles: AppRole[]
): Promise<SlotDetail | null> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('slots')
    .select(
      `
      id, label, starts_at, ends_at, is_open,
      availabilities ( user_id, profiles ( display_name ) ),
      rounds (
        id, status, created_by, created_at, room_freetext,
        rooms ( name ),
        round_participants ( user_id, role, team, profiles ( display_name ) )
      )
    `
    )
    .eq('id', slotId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const raw: RawSlotDetail = {
    id: data.id,
    label: data.label,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    is_open: data.is_open,
    availabilities: (data.availabilities ?? []).map((a) => ({
      user_id: a.user_id,
      profiles: a.profiles ? { display_name: a.profiles.display_name } : null,
    })),
    rounds: (data.rounds ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      created_by: r.created_by,
      created_at: r.created_at,
      room_freetext: r.room_freetext,
      rooms: r.rooms ? { name: r.rooms.name } : null,
      round_participants: (r.round_participants ?? []).map((p) => ({
        user_id: p.user_id,
        role: p.role,
        team: p.team,
        profiles: p.profiles ? { display_name: p.profiles.display_name } : null,
      })),
    })),
  }

  return shapeSlotDetail(raw, userId, roles, new Date())
}

export type JudgingQueueItem = {
  roundId: string
  slotId: string
  slotLabel: string
  startsAt: string
  endsAt: string
  debaterCount: number
}

type RawJudgingRound = {
  id: string
  slots: { id: string; label: string; starts_at: string; ends_at: string } | null
  round_participants: { user_id: string; role: string }[]
}

// Pure. Filters out anything already in the past (a stale forming round
// nobody can still join) and anything the viewer is already a participant
// in (any role) — claiming would just fail the one-row-per-user-per-round
// constraint anyway, so there's no reason to dangle it in their own queue.
export function shapeJudgingQueue(rounds: RawJudgingRound[], userId: string, now: Date): JudgingQueueItem[] {
  return rounds
    .filter((r) => r.slots !== null && new Date(r.slots.starts_at).getTime() > now.getTime())
    .filter((r) => !r.round_participants.some((p) => p.role === 'judge'))
    .filter((r) => !r.round_participants.some((p) => p.user_id === userId))
    .map((r) => ({
      roundId: r.id,
      slotId: r.slots!.id,
      slotLabel: r.slots!.label,
      startsAt: r.slots!.starts_at,
      endsAt: r.slots!.ends_at,
      debaterCount: r.round_participants.filter((p) => p.role === 'debater').length,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

// Impure. Forming rounds only — a round can't need a judge once it's
// confirmed, cancelled, completed, or expired — filtered further (past,
// already-in-it) by the pure function above rather than in SQL, since the
// dataset (a school's currently-forming rounds) is small enough that doing
// it in JS keeps the query simple and matches the rest of this codebase's
// query-then-shape split.
export async function getJudgingQueue(schoolId: string, userId: string): Promise<JudgingQueueItem[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rounds')
    .select('id, slots ( id, label, starts_at, ends_at ), round_participants ( user_id, role )')
    .eq('school_id', schoolId)
    .eq('status', 'forming')

  if (error) throw error

  const rawRounds: RawJudgingRound[] = (data ?? []).map((r) => ({
    id: r.id,
    slots: r.slots
      ? { id: r.slots.id, label: r.slots.label, starts_at: r.slots.starts_at, ends_at: r.slots.ends_at }
      : null,
    round_participants: (r.round_participants ?? []).map((p) => ({ user_id: p.user_id, role: p.role })),
  }))

  return shapeJudgingQueue(rawRounds, userId, new Date())
}

// For the room picker on a confirmed round with no room yet — the
// maintained list, not the free-text fallback (see decisions.md,
// "Excluded: automatic room assignment").
export async function getActiveRooms(schoolId: string): Promise<{ id: string; name: string }[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}
