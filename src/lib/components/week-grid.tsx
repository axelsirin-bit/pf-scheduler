import Link from 'next/link'
import type { GridDay, GridSlot } from '@/lib/db/week'
import { SlotCheckbox } from '@/lib/components/slot-checkbox'

// The cheapest possible matching mechanism per decisions.md: three people
// free and no round yet is worth calling out, since it's one click away
// from a full round.
const NUDGE_THRESHOLD = 3

// GridDay.date is a plain calendar date ('YYYY-MM-DD'), not an instant —
// formatting it must stay in UTC, never the school's real timezone, or a
// date near midnight could print as the wrong day. Slot start/end times ARE
// real instants (timestamptz) and do need the school's timezone.
function formatDayHeader(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${fmt.format(new Date(startsAt))}–${fmt.format(new Date(endsAt))}`
}

function statusLabel(slot: GridSlot): string {
  switch (slot.roundStatus) {
    case 'open':
      return 'Open'
    case 'forming':
      return `Forming · ${slot.roundCount} of 5`
    case 'confirmed':
      return slot.room ? `Confirmed · ${slot.room}` : 'Confirmed'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'expired':
      return 'Expired'
    default:
      return slot.roundStatus
  }
}

function SlotCard({ slot, timeZone }: { slot: GridSlot; timeZone: string }) {
  const showNudge = slot.roundStatus === 'open' && slot.availableCount === NUDGE_THRESHOLD

  return (
    <li className={`rounded border border-neutral-200 p-2 text-sm ${slot.isPast ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/slot/${slot.id}`}
          className="font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {slot.label}
        </Link>
        <span className="tabular-nums text-neutral-600">
          {formatTimeRange(slot.startsAt, slot.endsAt, timeZone)}
        </span>
      </div>
      <p className="mt-1 text-neutral-700">
        {slot.availableCount === 0
          ? 'No one available yet'
          : `${slot.availableCount} available: ${slot.availableNames.join(', ')}`}
      </p>
      <p className="mt-1 text-xs font-medium text-neutral-600">{statusLabel(slot)}</p>
      {showNudge && <p className="mt-1 text-xs font-medium text-blue-700">One more and this is a full round</p>}
      <div className="mt-2">
        <SlotCheckbox slotId={slot.id} isAvailable={slot.isAvailable} disabled={slot.isPast || !slot.isOpen} />
      </div>
    </li>
  )
}

function DayColumn({ day, timeZone, isToday }: { day: GridDay; timeZone: string; isToday: boolean }) {
  return (
    <div className="min-w-0">
      <div
        className={`rounded px-2 py-1 text-sm font-semibold ${
          isToday ? 'bg-blue-50 text-blue-900' : 'bg-neutral-50 text-neutral-900'
        }`}
      >
        {formatDayHeader(day.date)}
        {isToday && <span className="ml-1 text-xs font-normal">Today</span>}
      </div>
      {day.isSchoolDay === false ? (
        <p className="mt-2 text-sm text-neutral-500">No school{day.note ? ` — ${day.note}` : ''}.</p>
      ) : day.isSchoolDay === null ? (
        <p className="mt-2 text-sm text-neutral-500">No schedule generated for this date yet.</p>
      ) : day.slots.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No bookable slots today.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {day.slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} timeZone={timeZone} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function WeekGrid({
  days,
  timeZone,
  today,
  weekStart,
  selectedDay,
}: {
  days: GridDay[]
  timeZone: string
  today: string
  weekStart: string
  selectedDay: string
}) {
  const selected = days.find((d) => d.date === selectedDay) ?? days[0]

  return (
    <>
      {/* Desktop: days as columns, five across. */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-3">
        {days.map((day) => (
          <DayColumn key={day.date} day={day} timeZone={timeZone} isToday={day.date === today} />
        ))}
      </div>

      {/* Mobile: one day at a time — a five-column grid at 375px is unreadable. */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Day" className="flex gap-1 overflow-x-auto pb-2">
          {days.map((day) => (
            <Link
              key={day.date}
              href={`/week?start=${weekStart}&day=${day.date}`}
              role="tab"
              aria-selected={day.date === selected.date}
              className={`shrink-0 rounded px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                day.date === selected.date ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              {formatDayHeader(day.date)}
              {day.date === today ? ' •' : ''}
            </Link>
          ))}
        </div>
        <div className="mt-2">
          <DayColumn day={selected} timeZone={timeZone} isToday={selected.date === today} />
        </div>
      </div>
    </>
  )
}
