import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getJudgingQueue } from '@/lib/db/rounds'
import { ClaimJudgeButton } from '@/lib/components/round-actions'

function formatSlotTime(startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startsAt))
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

// A separate async component so its query only ever runs once RequireRole
// has already decided this viewer holds the judge role — RequireRole calls
// notFound() before this subtree is ever rendered, not just before it's
// displayed, so a non-judge never triggers this fetch at all.
async function JudgingList() {
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const queue = await getJudgingQueue(user.school_id, user.id)

  if (queue.length === 0) {
    return (
      <p className="mt-4 text-neutral-600">
        No rounds need a judge right now. Check back once availability lines up.
      </p>
    )
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {queue.map((item) => (
        <li key={item.roundId} className="rounded border border-neutral-200 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <Link href={`/slot/${item.slotId}`} className="font-medium underline">
                {item.slotLabel}
              </Link>
              <span className="ml-2 tabular-nums text-neutral-600">
                {formatSlotTime(item.startsAt, item.endsAt, user.school!.timezone)}
              </span>
            </div>
            <span className="text-neutral-600">{item.debaterCount} of 4 debaters</span>
          </div>
          <ClaimJudgeButton slotId={item.slotId} />
        </li>
      ))}
    </ul>
  )
}

export default function JudgingPage() {
  return (
    <RequireRole role="judge">
      <h1 className="text-xl font-semibold">Judging</h1>
      <JudgingList />
    </RequireRole>
  )
}
