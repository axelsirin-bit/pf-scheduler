import { getCurrentUser } from '@/lib/auth'
import { getCalendarSource } from '@/lib/db/onboarding'
import { SetupForm } from '@/lib/components/setup-form'
import { saveFeedUrl } from './actions'

export default async function CalendarSourceStep() {
  const user = await getCurrentUser()
  const source = await getCalendarSource(user.school_id)

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Calendar source</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Set the calendar up by hand now, or link your school&apos;s calendar feed. Neither is the lesser
        option — a feed can be linked later at any time without redoing any manual work, and both write to
        the same tables underneath.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-neutral-200 p-3">
          <h3 className="font-medium text-neutral-900">Set it up manually</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Enter your rotation and any holidays directly in the next step. Good if you don&apos;t have a
            calendar feed handy, or want to get started right away.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {source === 'manual' ? 'This is the current setting.' : 'Continue to the rotation step to use this.'}
          </p>
        </div>

        <div className="rounded border border-neutral-200 p-3">
          <h3 className="font-medium text-neutral-900">Link a calendar feed</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Paste your school&apos;s ICS calendar URL. Nothing syncs automatically yet in this build — that
            comes later — but saving the URL here means it&apos;s ready to go the moment it does.
          </p>
          {source === 'feed' ? (
            <p className="mt-2 text-sm text-green-700">A feed is already linked.</p>
          ) : (
            <SetupForm action={saveFeedUrl} submitLabel="Save feed URL" className="mt-3 flex flex-col gap-2">
              <input
                name="feedUrl"
                type="url"
                required
                placeholder="https://..."
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </SetupForm>
          )}
        </div>
      </div>
    </>
  )
}
