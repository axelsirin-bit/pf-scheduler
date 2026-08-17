import type { Database } from './types.ts'
import { getSchoolTerms } from './onboarding.ts'
import { getParticipationBreakdown } from './leaderboard.ts'
import { dateInTimezone, mondayOfWeek, addDays, todayInTimezone } from '../schedule/week-bounds.ts'

type AppRole = Database['public']['Enums']['app_role']

// ---------------------------------------------------------------------
// Roster overview (task 1)
// ---------------------------------------------------------------------

export type OverdueRound = {
  roundId: string
  slotLabel: string
  startsAt: string
  endsAt: string
  hoursOverdue: number
}

export type RoundsSummary = {
  completedThisWeek: number
  completedThisTerm: number
  awaitingResult: OverdueRound[]
  expiredThisTerm: number
}

type RawOverviewRound = {
  id: string
  status: string
  slots: { label: string; starts_at: string; ends_at: string } | null
}

// Pure: no database access. The whole task list ("showing, for the
// current term") is scoped to the current term, including "completed
// this week" (a week that's necessarily inside it) and "expired" —
// term is null when the school has no term covering today, in which
// case everything term-scoped reads as zero rather than crashing.
export function shapeRoundsSummary(
  rounds: RawOverviewRound[],
  now: Date,
  weekStart: string,
  weekEnd: string,
  term: { startsOn: string; endsOn: string } | null,
  timeZone: string
): RoundsSummary {
  const withDates = rounds
    .filter((r): r is RawOverviewRound & { slots: NonNullable<RawOverviewRound['slots']> } => r.slots !== null)
    .map((r) => ({ ...r, dateStr: dateInTimezone(r.slots.starts_at, timeZone) }))

  const inTerm = (dateStr: string) => term !== null && dateStr >= term.startsOn && dateStr <= term.endsOn

  const completedThisWeek = withDates.filter(
    (r) => r.status === 'completed' && r.dateStr >= weekStart && r.dateStr < weekEnd
  ).length

  const completedThisTerm = withDates.filter((r) => r.status === 'completed' && inTerm(r.dateStr)).length
  const expiredThisTerm = withDates.filter((r) => r.status === 'expired' && inTerm(r.dateStr)).length

  const awaitingResult = withDates
    .filter(
      (r) =>
        (r.status === 'confirmed' || r.status === 'awaiting_result') &&
        new Date(r.slots.ends_at).getTime() < now.getTime()
    )
    .map((r) => ({
      roundId: r.id,
      slotLabel: r.slots.label,
      startsAt: r.slots.starts_at,
      endsAt: r.slots.ends_at,
      hoursOverdue: Math.floor((now.getTime() - new Date(r.slots.ends_at).getTime()) / (1000 * 60 * 60)),
    }))
    .sort((a, b) => b.hoursOverdue - a.hoursOverdue)

  return { completedThisWeek, completedThisTerm, awaitingResult, expiredThisTerm }
}

export type RosterByRole = { debater: number; judge: number; admin: number }

export type AdminOverview = {
  rounds: RoundsSummary
  rosterByRole: RosterByRole
  zeroRoundMembers: { userId: string; fullName: string }[]
  currentTermName: string | null
}

// Impure. Fetches every round+slot for the school rather than pre-filtering
// to the term in SQL — same "fetch broad, shape narrow" reasoning as
// archive.ts, and this dataset is the same size as that one.
export async function getAdminOverview(schoolId: string): Promise<AdminOverview> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const [{ data: school, error: schoolError }, terms, { data: roundRows, error: roundsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('schools').select('timezone').eq('id', schoolId).single(),
      getSchoolTerms(schoolId),
      supabase.from('rounds').select('id, status, slots ( label, starts_at, ends_at )').eq('school_id', schoolId),
      supabase.from('profiles').select('roles').eq('school_id', schoolId).eq('is_active', true),
    ])

  if (schoolError) throw schoolError
  if (roundsError) throw roundsError
  if (profilesError) throw profilesError

  const timeZone = school?.timezone ?? 'America/New_York'
  const today = todayInTimezone(timeZone)
  const currentTerm = terms.find((t) => t.startsOn <= today && today <= t.endsOn) ?? null

  const rawRounds: RawOverviewRound[] = (roundRows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    slots: r.slots ? { label: r.slots.label, starts_at: r.slots.starts_at, ends_at: r.slots.ends_at } : null,
  }))

  const weekStart = mondayOfWeek(today)
  const weekEnd = addDays(weekStart, 7)

  const rounds = shapeRoundsSummary(
    rawRounds,
    new Date(),
    weekStart,
    weekEnd,
    currentTerm ? { startsOn: currentTerm.startsOn, endsOn: currentTerm.endsOn } : null,
    timeZone
  )

  const rosterByRole: RosterByRole = { debater: 0, judge: 0, admin: 0 }
  for (const p of profiles ?? []) {
    for (const role of p.roles as AppRole[]) {
      if (role in rosterByRole) rosterByRole[role as keyof RosterByRole] += 1
    }
  }

  const { entries } = await getParticipationBreakdown(schoolId, currentTerm?.id ?? null)
  const zeroRoundMembers = entries.filter((e) => e.totalRounds === 0).map((e) => ({ userId: e.userId, fullName: e.fullName }))

  return { rounds, rosterByRole, zeroRoundMembers, currentTermName: currentTerm?.name ?? null }
}

// ---------------------------------------------------------------------
// Roster members (task 2)
// ---------------------------------------------------------------------

export type RosterMember = {
  userId: string
  fullName: string
  email: string
  roles: AppRole[]
  isActive: boolean
  lastSeenAt: string | null
}

// Admin-only (page-level RequireRole gates this) — full_name and every
// member regardless of is_active, the one place both belong, same
// reasoning as getParticipationBreakdown.
export async function getRosterMembers(schoolId: string): Promise<RosterMember[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, roles, is_active, last_seen_at')
    .eq('school_id', schoolId)
    .order('full_name')

  if (error) throw error
  return (data ?? []).map((p) => ({
    userId: p.id,
    fullName: p.full_name,
    email: p.email,
    roles: p.roles as AppRole[],
    isActive: p.is_active,
    lastSeenAt: p.last_seen_at,
  }))
}

// ---------------------------------------------------------------------
// Rooms (task 5)
// ---------------------------------------------------------------------

export type RoomSummary = { id: string; name: string; note: string | null; isActive: boolean }

// Unlike rounds.ts's getActiveRooms (the room picker on a confirmed
// round, which should only ever offer active rooms), this includes
// inactive ones too — the admin console needs to show and reactivate them.
export async function getAllRooms(schoolId: string): Promise<RoomSummary[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase.from('rooms').select('id, name, note, is_active').eq('school_id', schoolId).order('name')

  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, note: r.note, isActive: r.is_active }))
}

// ---------------------------------------------------------------------
// Audit log (task 6) — read-only from this file's point of view; every
// row is written by the triggers in 20260820000000_admin_console.sql,
// never by application code.
// ---------------------------------------------------------------------

export type AuditLogEntry = {
  id: number
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export async function getAuditLog(schoolId: string, limit = 200): Promise<AuditLogEntry[]> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, before, after, created_at, profiles ( full_name )')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    actorName: row.profiles?.full_name ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: row.before,
    after: row.after,
    createdAt: row.created_at,
  }))
}
