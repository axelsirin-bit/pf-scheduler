'use client'

import { useActionState } from 'react'
import { confirmSetup, type ConfirmResult } from './actions'

export function ConfirmButton() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ConfirmResult | null) => confirmSetup(),
    null
  )

  return (
    <form action={formAction} className="mt-4">
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Generating slots…' : 'Confirm and finish setup'}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
