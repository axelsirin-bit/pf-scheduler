import type { Database } from './types.ts'

type AppRole = Database['public']['Enums']['app_role']
type RoundStatus = Database['public']['Enums']['round_status']

export type GridSlot = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  isPast: boolean
  availableCount: number
  availableNames: string[]
  roundStatus: 'open' | RoundStatus
  roundCount: number | null
  room: string | null
}

export type GridDay = {
  date: string // 'YYYY-MM-DD'
  // null means no calendar_days row exists at all for this date (nothing
  // generated yet), as opposed to a real school day that's a holiday
  // (is_school_day = false, usually with a note).
  isSchoolDay: boolean | null
  note: string | null
  slots: GridSlot[]
}

// Plain input types for the pure shaping function below, mirroring
// generate.ts/slots.ts: the impure query maps Supabase's response into
// these before handing off, so shapeWeekGrid never touches a live client
// or Supabase-generated types and can be unit tested without a database.
type RawRoundParticipant = { user_id: string }
type RawRound = {
  id: string
  status: string
  room_freetext: string | null
  created_at: string
  rooms: { name: string } | null
  round_participants: RawRoundParticipant[]
}
type RawSlot = {
  id: string
  label: string
  starts_at: string
  ends_at: string
  availabilities: { profiles: { display_name: string } | null }[]
  rounds: RawRound[]
}
export type RawCalendarDay = {
  date: string
  is_school_day: boolean
  note: string | null
  slots: RawSlot[]
}

// Pure: no database access. weekdayDates is exactly the dates being
// displayed (Monday-Friday); calendarDays is whatever the query actually
// found for that range, which may be missing a date entirely (nothing
// generated yet) as well as include a real school day later marked a
// holiday. Room stripping happens in here, in shapeSlot — the raw
// `rooms`/`room_freetext` fields never survive past this function for
// anyone who isn't a participant or admin.
export function shapeWeekGrid(
  weekdayDates: string[],
  calendarDays: RawCalendarDay[],
  userId: string,
  roles: AppRole[],
  now: Date
): GridDay[] {
  const isAdmin = roles.includes('admin')
  const byDate = new Map(calendarDays.map((d) => [d.date, d]))

  return weekdayDates.map((date) => {
    const day = byDate.get(date)
    if (!day) {
      return { date, isSchoolDay: null, note: null, slots: [] }
    }

    const slots = [...day.slots]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((slot) => shapeSlot(slot, userId, isAdmin, now))

    return { date, isSchoolDay: day.is_school_day, note: day.note, slots }
  })
}

function shapeSlot(slot: RawSlot, userId: string, isAdmin: boolean, now: Date): GridSlot {
  const availableNames = slot.availabilities
    .map((a) => a.profiles?.display_name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b))

  const round = pickRelevantRound(slot.rounds)
  const isParticipant = round ? round.round_participants.some((p) => p.user_id === userId) : false
  const roomVisible = round !== null && round.status === 'confirmed' && (isAdmin || isParticipant)

  return {
    id: slot.id,
    label: slot.label,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    isPast: new Date(slot.starts_at).getTime() < now.getTime(),
    availableCount: availableNames.length,
    availableNames,
    roundStatus: (round?.status as RoundStatus | undefined) ?? 'open',
    roundCount: round ? round.round_participants.length : null,
    room: roomVisible ? (round?.rooms?.name ?? round?.room_freetext ?? null) : null,
  }
}

// No unique constraint on rounds.slot_id (see the slots table) — more than
// one round row can technically exist for the same slot. Prefers a
// non-terminal round (not cancelled/expired) over a dead one, most
// recently created first, since that's the one worth showing on the grid.
function pickRelevantRound(rounds: RawRound[]): RawRound | null {
  if (rounds.length === 0) return null
  const live = rounds.filter((r) => r.status !== 'cancelled' && r.status !== 'expired')
  const pool = live.length > 0 ? live : rounds
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

// Impure: one query for the whole week, joining calendar_days -> slots ->
// availabilities -> profiles and slots -> rounds -> round_participants ->
// rooms. Starting from calendar_days rather than slots is what lets a
// holiday render as "no school" instead of a silently empty column: a
// holiday still has a calendar_days row (is_school_day = false, usually
// with a note), it just has no slots underneath it.
//
// Regular RLS-respecting client, not the admin one — same reasoning as
// getSlotsForRange in slots.ts. server.ts is imported dynamically for the
// same reason too: it pulls in next/headers, which can't resolve outside
// Next's runtime even at import time, and shapeWeekGrid above needs to stay
// loadable by Vitest without dragging that dependency in.
export async function getWeekGrid(
  schoolId: string,
  userId: string,
  roles: AppRole[],
  startOfWeek: string
): Promise<GridDay[]> {
  const { createClient } = await import('../supabase/server.ts')
  const { addDays } = await import('../schedule/week-bounds.ts')
  const supabase = await createClient()

  const weekdayDates = [0, 1, 2, 3, 4].map((i) => addDays(startOfWeek, i))
  const endDate = weekdayDates[weekdayDates.length - 1]

  const { data, error } = await supabase
    .from('calendar_days')
    .select(
      `
      date,
      is_school_day,
      note,
      slots (
        id,
        label,
        starts_at,
        ends_at,
        availabilities ( profiles ( display_name ) ),
        rounds ( id, status, room_freetext, created_at, rooms ( name ), round_participants ( user_id ) )
      )
    `
    )
    .eq('school_id', schoolId)
    .gte('date', startOfWeek)
    .lte('date', endDate)
    .order('starts_at', { foreignTable: 'slots' })

  if (error) throw error

  const rawDays: RawCalendarDay[] = (data ?? []).map((d) => ({
    date: d.date,
    is_school_day: d.is_school_day,
    note: d.note,
    slots: (d.slots ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      availabilities: (s.availabilities ?? []).map((a) => ({
        profiles: a.profiles ? { display_name: a.profiles.display_name } : null,
      })),
      rounds: (s.rounds ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        room_freetext: r.room_freetext,
        created_at: r.created_at,
        rooms: r.rooms ? { name: r.rooms.name } : null,
        round_participants: (r.round_participants ?? []).map((p) => ({ user_id: p.user_id })),
      })),
    })),
  }))

  return shapeWeekGrid(weekdayDates, rawDays, userId, roles, new Date())
}
