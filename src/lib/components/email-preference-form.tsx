'use client'

import { useActionState } from 'react'
import { saveEmailPreference, type ActionResult } from '@/app/(app)/settings/actions'

export function EmailPreferenceForm({ current }: { current: 'all' | 'my_rounds' }) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const preference = formData.get('preference') as 'all' | 'my_rounds'
    return saveEmailPreference(preference)
  }, null)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 text-sm">
      <fieldset className="flex flex-col gap-2">
        <label className="flex items-start gap-2">
          <input type="radio" name="preference" value="my_rounds" defaultChecked={current === 'my_rounds'} className="mt-1" />
          <span>
            <span className="font-medium text-neutral-900">Only rounds I&apos;m in</span>
            <br />
            <span className="text-neutral-600">Confirmations, reminders, and cancellations for rounds you&apos;re actually part of.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="preference" value="all" defaultChecked={current === 'all'} className="mt-1" />
          <span>
            <span className="font-medium text-neutral-900">All rounds</span>
            <br />
            <span className="text-neutral-600">Every round confirmation, reminder, and cancellation for the whole school, not just your own.</span>
          </span>
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state && state.ok && <p className="text-xs text-green-700">Saved.</p>}
    </form>
  )
}
