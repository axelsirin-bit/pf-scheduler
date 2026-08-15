import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getWeekGrid } from '@/lib/db/week'
import { addDays, mondayOfWeek, todayInTimezone } from '@/lib/schedule/week-bounds'
import { WeekGrid } from '@/lib/components/week-grid'

// Slots only exist up to the generation window (step 07 runs it four weeks
// out) — going further would render a grid of empty columns with no
// explanation, so this is checked before querying rather than after.
const WEEKS_AHEAD_LIMIT = 4

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; day?: string }>
}) {
  const { start, day } = await searchParams
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }
  const timeZone = user.school.timezone

  const today = todayInTimezone(timeZone)
  const currentWeekStart = mondayOfWeek(today)
  const maxWeekStart = addDays(currentWeekStart, WEEKS_AHEAD_LIMIT * 7)

  // A malformed or tampered ?start= falls back to the current week rather
  // than crashing the page.
  const requestedStart = start && ISO_DATE.test(start) ? mondayOfWeek(start) : currentWeekStart

  const prevStart = addDays(requestedStart, -7)
  const nextStart = addDays(requestedStart, 7)
  const isCurrentWeek = requestedStart === currentWeekStart

  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-semibold">This week</h1>
      <nav aria-label="Week" className="flex items-center gap-2 text-sm">
        <Link
          href={`/week?start=${prevStart}`}
          className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← Previous week
        </Link>
        {isCurrentWeek ? (
          <span className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-900">This week</span>
        ) : (
          <Link
            href="/week"
            className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            This week
          </Link>
        )}
        {nextStart > maxWeekStart ? (
          <span className="rounded px-2 py-1 text-neutral-400">Next week →</span>
        ) : (
          <Link
            href={`/week?start=${nextStart}`}
            className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Next week →
          </Link>
        )}
      </nav>
    </div>
  )

  if (requestedStart > maxWeekStart) {
    return (
      <>
        {header}
        <p className="text-neutral-600">
          Slots are only scheduled up to {WEEKS_AHEAD_LIMIT} weeks ahead. Try{' '}
          <Link href={`/week?start=${maxWeekStart}`} className="underline">
            the last available week
          </Link>
          .
        </p>
      </>
    )
  }

  const days = await getWeekGrid(user.school_id, user.id, user.roles, requestedStart)

  const selectedDay = day && days.some((d) => d.date === day) ? day : (days.some((d) => d.date === today) ? today : days[0].date)

  return (
    <>
      {header}
      <WeekGrid days={days} timeZone={timeZone} today={today} weekStart={requestedStart} selectedDay={selectedDay} />
    </>
  )
}
