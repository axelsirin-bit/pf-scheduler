'use client'

import { useActionState } from 'react'

export type SetupActionResult = { ok: true } | { ok: false; error: string }

// Shared shape for every wizard step's forms: submit, show a pending state,
// show the error inline on failure. One component instead of repeating the
// same useActionState wiring on all seven /admin/setup pages.
export function SetupForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  onSuccessMessage,
  className,
}: {
  action: (formData: FormData) => Promise<SetupActionResult>
  children: React.ReactNode
  submitLabel: string
  pendingLabel?: string
  onSuccessMessage?: string
  className?: string
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: SetupActionResult | null, formData: FormData) => action(formData),
    null
  )

  return (
    <form action={formAction} className={className ?? 'flex flex-col gap-3'}>
      {children}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? (pendingLabel ?? 'Saving…') : submitLabel}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state && state.ok && onSuccessMessage && <p className="text-sm text-green-700">{onSuccessMessage}</p>}
    </form>
  )
}
