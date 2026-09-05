import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types.ts'
import { addDays, dateInTimezone } from '../schedule/week-bounds.ts'

// "A few hours" and "two days" per the step file, left unspecified —
// same treatment as round-lifecycle.ts's own AWAITING_RESULT_AFTER_HOURS:
// a reasonable default, documented, easy to change here if wrong. These
// are a genuinely different concern from that file's 24-hour status
// transition — this is about when to *email* a nudge, not when to
// change round_status, and results.ts's own shapeResultsNeeded already
// established why status alone isn't the right signal to gate on: it
// only works once a sweep has actually run.
const RESULT_NEEDED_FIRST_HOURS = 3
const RESULT_NEEDED_SECOND_HOURS = 48

// Bounds the candidate query so it isn't an ever-growing scan of ancient
// rounds — round-lifecycle.ts's own EXPIRE_AFTER_DAYS is 7, so nothing
// past that window could still be usefully reminded about anyway.
const LOOKBACK_DAYS = 8
const LOOKAHEAD_DAYS = 3

export type ReminderCandidates = {
  roundTomorrow: string[]
  resultNeededFirst: string[]
  resultNeededSecond: string[]
}

type RawReminderRound = {
  id: string
  status: string
  confirmed_at: string | null
  slots: { starts_at: string; ends_at: string } | null
  schools: { timezone: string } | null
  round_results: { id: string }[]
}

// Pure: no database access. "Round tomorrow" only ever applies to a
// still-confirmed round (an already-completed or awaiting_result round
// isn't tomorrow's business); "result needed" checks the slot's real end
// time against now, not round_status, for the same reason
// shapeResultsNeeded does. Idempotency itself lives in notify.ts's
// claimAndSend, not here — this only decides who's *eligible* this tick,
// and a round eligible on ten consecutive ticks before its first
// successful send is expected, not a bug.
export function selectReminderCandidates(rounds: RawReminderRound[], now: Date): ReminderCandidates {
  const roundTomorrow: string[] = []
  const resultNeededFirst: string[] = []
  const resultNeededSecond: string[] = []

  for (const r of rounds) {
    if (!r.slots || !r.schools) continue
    const timeZone = r.schools.timezone
    const endsAt = new Date(r.slots.ends_at)

    if (r.status === 'confirmed' && r.confirmed_at) {
      const slotDate = dateInTimezone(r.slots.starts_at, timeZone)
      // "Today" derived from the `now` parameter, not the live system
      // clock — todayInTimezone() always reads real time, which would
      // make this function silently untestable (and, in a genuine
      // multi-timezone future, subtly wrong if `now` were ever anything
      // other than the literal instant this runs).
      const today = dateInTimezone(now.toISOString(), timeZone)
      const tomorrow = addDays(today, 1)
      const leadTimeMs = new Date(r.slots.starts_at).getTime() - new Date(r.confirmed_at).getTime()
      if (slotDate === tomorrow && leadTimeMs > 24 * 60 * 60 * 1000) {
        roundTomorrow.push(r.id)
      }
    }

    const hasResult = r.round_results.length > 0
    if (!hasResult && endsAt.getTime() < now.getTime()) {
      const hoursSinceEnd = (now.getTime() - endsAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceEnd >= RESULT_NEEDED_SECOND_HOURS) {
        resultNeededSecond.push(r.id)
      } else if (hoursSinceEnd >= RESULT_NEEDED_FIRST_HOURS) {
        resultNeededFirst.push(r.id)
      }
    }
  }

  return { roundTomorrow, resultNeededFirst, resultNeededSecond }
}

// Impure: one broad query covering both the past window (result needed)
// and the near-future window (round tomorrow) in a single pass, same
// "fetch broad, shape narrow" split as everywhere else in this codebase.
export async function getReminderCandidates(client: SupabaseClient<Database>): Promise<ReminderCandidates> {
  const now = new Date()
  const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('rounds')
    .select(
      `
      id, status, confirmed_at,
      slots!inner ( starts_at, ends_at ),
      schools ( timezone ),
      round_results ( id )
    `
    )
    .in('status', ['confirmed', 'awaiting_result'])
    .gte('slots.starts_at', from)
    .lte('slots.starts_at', to)

  if (error) throw error

  const rounds: RawReminderRound[] = (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    confirmed_at: r.confirmed_at,
    slots: r.slots ? { starts_at: r.slots.starts_at, ends_at: r.slots.ends_at } : null,
    schools: r.schools ? { timezone: r.schools.timezone } : null,
    round_results: r.round_results ?? [],
  }))

  return selectReminderCandidates(rounds, now)
}
