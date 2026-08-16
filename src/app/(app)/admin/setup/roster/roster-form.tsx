'use client'

import { useActionState } from 'react'
import { inviteRoster, type ActionResult } from './actions'

export function RosterForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => inviteRoster(formData),
    null
  )

  return (
    <form action={formAction} className="mt-3 flex max-w-lg flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm">Emails, one per line (or comma-separated)</span>
        <textarea
          name="emails"
          rows={6}
          required
          placeholder={'ada@example.edu\ngrace@example.edu'}
          className="rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm">Role for this batch</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="role-debater" defaultChecked />
          <span>Debater</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="role-judge" />
          <span>Judge</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="role-admin" />
          <span>Admin</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input name="ageConfirmed" type="checkbox" required className="mt-0.5" />
        <span>I confirm every person on this list is 13 years old or older.</span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Inviting…' : 'Send invites'}
      </button>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state && state.ok && (
        <ul className="text-sm">
          {state.outcomes.map((o) => (
            <li key={o.email} className={o.ok ? 'text-green-700' : 'text-amber-700'}>
              {o.email}: {o.ok ? 'invited' : o.error}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
