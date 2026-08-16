'use client'

import { useActionState } from 'react'
import { regenerateFutureSlots, type RegenerateResult } from '@/app/(app)/admin/setup/shared-actions'

export function RegenerateSlotsButton() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: RegenerateResult | null) => regenerateFutureSlots(),
    null
  )

  return (
    <form action={formAction} className="mt-3">
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Regenerating…' : 'Regenerate future slots'}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state && state.ok && (
        <p className="mt-1 text-sm text-neutral-600">
          {state.created} created, {state.updated} updated, {state.skipped} skipped (already had a round).
        </p>
      )}
    </form>
  )
}
