// One-off runner for src/lib/db/round-lifecycle.ts against the real remote
// database. Not wired to a schedule yet — mirrors scripts/generate-slots.ts,
// which stood in for the (still unbuilt) slot-generation cron route in step
// 07. This is what a future cron route would call.
//
// Usage: node --env-file=.env.local scripts/sweep-stale-rounds.ts

import { sweepStaleRounds } from '../src/lib/db/round-lifecycle.ts'

async function main() {
  const result = await sweepStaleRounds()
  console.log(
    `Marked ${result.markedAwaitingResult} round(s) awaiting_result, ${result.markedExpired} round(s) expired.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
