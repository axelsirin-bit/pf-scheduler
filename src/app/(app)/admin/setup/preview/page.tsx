import { getCurrentUser } from '@/lib/auth'
import { getCalendarSource } from '@/lib/db/onboarding'
import { getPreview } from './actions'
import { ConfirmButton } from './confirm-button'

function formatDay(dateStr: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(`${dateStr}T00:00:00Z`)
  )
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export default async function PreviewStep() {
  const user = await getCurrentUser()
  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const source = await getCalendarSource(user.school_id)
  const preview = await getPreview()

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Preview</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Nothing is written to the schedule until you confirm below. Check this matches your school&apos;s
        real calendar for the next two weeks before continuing — this is what catches a wrong rotation
        anchor before it produces a month of wrong slots.
      </p>

      {!preview.ok ? (
        <p className="mt-3 text-sm text-red-600">{preview.error}</p>
      ) : preview.days.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          {source === 'feed'
            ? "This school is set to use a linked calendar feed. Nothing can be previewed yet — syncing isn't available in this build. Fill in the rotation step manually if you'd like a real preview, or confirm now and slots will appear once a feed sync exists."
            : 'Nothing to preview yet — fill in the rotation step first.'}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {preview.days.map((day) => (
            <div key={day.date} className="rounded border border-neutral-200 p-3">
              <p className="font-medium text-neutral-900">{formatDay(day.date, user.school!.timezone)}</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm text-neutral-700">
                {day.slots.map((slot) => (
                  <li key={slot.label + slot.startsAt}>
                    {slot.label} · {formatTime(slot.startsAt, user.school!.timezone)}–
                    {formatTime(slot.endsAt, user.school!.timezone)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ConfirmButton />
    </>
  )
}
