import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getSchoolTerms, getScheduleVariants, getCalendarSource } from '@/lib/db/onboarding'
import { SetupForm } from '@/lib/components/setup-form'
import { saveRotationConfig } from './actions'

export default async function RotationStep() {
  const user = await getCurrentUser()
  const [terms, variants, source] = await Promise.all([
    getSchoolTerms(user.school_id),
    getScheduleVariants(user.school_id),
    getCalendarSource(user.school_id),
  ])

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Rotation</h2>

      {source === 'feed' && (
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          This school is set to use a linked calendar feed, which will supply rotation days once syncing is
          available. You can still fill this in now — it&apos;s ignored once a feed sync runs, but nothing
          is lost if you switch back to manual.
        </p>
      )}

      {terms.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          Add a term first on the{' '}
          <Link href="/admin/setup/basics" className="underline">
            basics step
          </Link>
          .
        </p>
      ) : variants.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          Create a period template first on the{' '}
          <Link href="/admin/setup/templates" className="underline">
            templates step
          </Link>
          .
        </p>
      ) : (
        <SetupForm
          action={saveRotationConfig}
          submitLabel="Save rotation"
          className="mt-3 flex max-w-2xl flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm">Term</span>
            <select
              name="termId"
              required
              className="max-w-xs rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.startsOn} – {t.endsOn})
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm">Does the rotation reset every week, or run continuously?</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="resetsWeekly" value="continuous" defaultChecked />
              <span>Continuously — wraps across weekends and holidays without resetting</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="resetsWeekly" value="weekly" />
              <span>Resets weekly — the same weekday always gets the same code</span>
            </label>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Rotation codes, in order, separated by commas</span>
            <input
              name="sequence"
              type="text"
              required
              placeholder="Day 1, Day 2, Day 3, Day 4"
              className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">A date that falls on the first code in that list</span>
            <input
              name="anchorDate"
              type="date"
              required
              className="max-w-xs rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Default schedule for school days</span>
            <select
              name="defaultVariantId"
              required
              className="max-w-xs rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm">Holidays and other non-school days (optional)</span>
            <span className="text-xs text-neutral-500">One per line: YYYY-MM-DD, or YYYY-MM-DD: a short note</span>
            <textarea
              name="holidays"
              rows={4}
              placeholder={'2026-09-07: Labor Day\n2026-11-25: Thanksgiving break'}
              className="rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        </SetupForm>
      )}
    </>
  )
}
