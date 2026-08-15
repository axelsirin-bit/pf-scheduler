import { getCurrentUser } from '@/lib/auth'
import { getWeekGrid } from '@/lib/db/week'
import { mondayOfWeek, todayInTimezone } from '@/lib/schedule/week-bounds'
import { SlotCheckbox } from '@/lib/components/slot-checkbox'

// Reuses getWeekGrid rather than a second query: it already computes
// exactly what this list needs (isAvailable, label, times) in the one
// query the week grid itself uses, so there's no second data-shaping path
// to keep in sync with the first.
function formatDayTime(dateStr: string, startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(
    new Date(`${dateStr}T00:00:00Z`)
  )
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

export default async function MyRoundsPage() {
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }
  const timeZone = user.school.timezone

  const currentWeekStart = mondayOfWeek(todayInTimezone(timeZone))
  const days = await getWeekGrid(user.school_id, user.id, user.roles, currentWeekStart)

  const myAvailability = days.flatMap((day) =>
    day.slots
      .filter((slot) => slot.isAvailable)
      .map((slot) => ({ date: day.date, slot }))
  )

  return (
    <>
      <h1 className="text-xl font-semibold">My rounds</h1>
      <p className="mt-4 text-neutral-600">
        You&apos;re not signed up for any rounds yet. Check availability on This week to get matched.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Your availability this week</h2>
      {myAvailability.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">
          You haven&apos;t marked any slots this week yet. Check the ones you&apos;re free for on This week.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {myAvailability.map(({ date, slot }) => (
            <li
              key={slot.id}
              className="flex items-center justify-between gap-3 rounded border border-neutral-200 p-2 text-sm"
            >
              <div>
                <span className="font-medium">{slot.label}</span>
                <span className="ml-2 tabular-nums text-neutral-600">
                  {formatDayTime(date, slot.startsAt, slot.endsAt, timeZone)}
                </span>
              </div>
              <SlotCheckbox slotId={slot.id} isAvailable={slot.isAvailable} disabled={slot.isPast || !slot.isOpen} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
