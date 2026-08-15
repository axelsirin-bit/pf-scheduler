// One-off runner for verifying src/lib/db/slots.ts against the real
// remote database. Not a permanent script — step 07's actual production
// path is the cron route at /api/cron/generate-slots.
//
// Usage: node --env-file=.env.local scripts/generate-slots.ts

import { upsertSlotsForRange } from '../src/lib/db/slots.ts'

const SCHOOL_ID = '78098b67-695e-4349-957c-5ead073ba23b' // riverbend-academy
const FALL = { from: '2026-08-24', to: '2026-12-18' }
const SPRING = { from: '2027-01-11', to: '2027-05-21' }

async function run(label: string, range: { from: string; to: string }, dryRun: boolean) {
  const result = await upsertSlotsForRange(SCHOOL_ID, range.from, range.to, { dryRun })
  console.log(
    `${label} [${dryRun ? 'DRY RUN' : 'REAL'}] ${range.from} to ${range.to}: ${result.schoolDays} school days, ${result.slotsGenerated} slots`
  )
}

async function main() {
  await run('Fall 2026', FALL, false)
  await run('Spring 2027', SPRING, false)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
