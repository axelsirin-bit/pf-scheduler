import { createAdminClient } from '../supabase/admin.ts'
import type { Database } from './types.ts'

type RoundStatus = Database['public']['Enums']['round_status']

// Runs as the service role — same reasoning as upsertSlotsForRange in
// slots.ts: this is a background sweep with no user session, not a page a
// signed-in person is viewing. Not wired to a cron route yet (mirrors step
// 07's cron route, also deferred) — this exists so that piece can be added
// later without building the transition logic itself at the same time.

// "A set number of hours" per the step file, left unspecified — 24 is a
// reasonable default (long enough that a judge who submits same-day never
// sees it, short enough to be a real nudge) and easy to change here if
// wrong.
const AWAITING_RESULT_AFTER_HOURS = 24
const EXPIRE_AFTER_DAYS = 7

export type SweepResult = {
  markedAwaitingResult: number
  markedExpired: number
}

// Two passes, run in order: a round the first pass just moved to
// awaiting_result is eligible for the second pass's status filter too (each
// pass queries fresh, after the previous one's update has committed), so a
// round stale enough for both thresholds goes straight to expired in one
// sweep rather than needing two separate runs.
export async function sweepStaleRounds(): Promise<SweepResult> {
  const supabase = createAdminClient()
  const now = Date.now()

  const awaitingCutoff = new Date(now - AWAITING_RESULT_AFTER_HOURS * 60 * 60 * 1000).toISOString()
  const expireCutoff = new Date(now - EXPIRE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const markedAwaitingResult = await markStale(supabase, {
    statuses: ['confirmed'],
    dateColumn: 'slots.ends_at',
    cutoff: awaitingCutoff,
    newStatus: 'awaiting_result' satisfies RoundStatus,
  })

  const markedExpired = await markStale(supabase, {
    statuses: ['confirmed', 'awaiting_result'] satisfies RoundStatus[],
    dateColumn: 'confirmed_at',
    cutoff: expireCutoff,
    newStatus: 'expired' satisfies RoundStatus,
  })

  return { markedAwaitingResult, markedExpired }
}

type AdminClient = ReturnType<typeof createAdminClient>

async function markStale(
  supabase: AdminClient,
  opts: { statuses: RoundStatus[]; dateColumn: 'slots.ends_at' | 'confirmed_at'; cutoff: string; newStatus: RoundStatus }
): Promise<number> {
  const query =
    opts.dateColumn === 'slots.ends_at'
      ? supabase.from('rounds').select('id, slots!inner(ends_at)').in('status', opts.statuses).lt('slots.ends_at', opts.cutoff)
      : supabase.from('rounds').select('id').in('status', opts.statuses).lt('confirmed_at', opts.cutoff)

  const { data: candidates, error: candidatesError } = await query
  if (candidatesError) throw candidatesError
  if (!candidates || candidates.length === 0) return 0

  const candidateIds = candidates.map((r) => r.id)

  const { data: withResults, error: resultsError } = await supabase
    .from('round_results')
    .select('round_id')
    .in('round_id', candidateIds)
  if (resultsError) throw resultsError

  const hasResult = new Set((withResults ?? []).map((r) => r.round_id))
  const toUpdate = candidateIds.filter((id) => !hasResult.has(id))
  if (toUpdate.length === 0) return 0

  const { error: updateError } = await supabase.from('rounds').update({ status: opts.newStatus }).in('id', toUpdate)
  if (updateError) throw updateError

  return toUpdate.length
}
