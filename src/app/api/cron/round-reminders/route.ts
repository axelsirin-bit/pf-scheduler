import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getReminderCandidates } from '@/lib/db/reminders'
import { notifyRoundTomorrow, notifyResultNeeded } from '@/lib/email/notify'

// Runs hourly (vercel.json) — "round tomorrow" needs to land some evening
// before the round, "result needed" needs a few hours' precision after a
// slot ends, and a single shared cron checking both keeps the cron
// surface small, same reasoning as round-lifecycle.ts's sweepStaleRounds
// doing two passes in one function rather than two separate crons.
//
// Same public-path + CRON_SECRET pattern as step 16's sync-ics route —
// Vercel's scheduler has no session, only a bearer token, and proxy.ts
// already exempts /api/cron entirely for that reason.
//
// Idempotency is enforced downstream in notify.ts's claimAndSend, keyed
// on notifications_sent — running this route twice in the same hour (or
// twice for the same round across many hours before its first successful
// send) sends nothing extra the second time.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const candidates = await getReminderCandidates(supabase)

  for (const roundId of candidates.roundTomorrow) {
    await notifyRoundTomorrow(roundId)
  }
  for (const roundId of candidates.resultNeededFirst) {
    await notifyResultNeeded(roundId, false)
  }
  for (const roundId of candidates.resultNeededSecond) {
    await notifyResultNeeded(roundId, true)
  }

  return NextResponse.json({
    roundTomorrow: candidates.roundTomorrow.length,
    resultNeededFirst: candidates.resultNeededFirst.length,
    resultNeededSecond: candidates.resultNeededSecond.length,
  })
}
