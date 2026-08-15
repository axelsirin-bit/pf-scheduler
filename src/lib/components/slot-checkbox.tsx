'use client'

import { useId, useOptimistic, useState, useTransition } from 'react'
import { toggleAvailability } from '@/app/(app)/week/actions'

// The only interactive piece of the week grid — everything else in
// week-grid.tsx stays a Server Component. `useOptimistic` derives its value
// from `isAvailable` on every render, so when the server action's
// `revalidatePath('/week')` brings a fresh copy of that prop back down: a
// successful toggle already matches the optimistic guess (no visible
// change), and a failed one snaps back to whatever was actually in the
// database, which is the "revert" the step asked for — not something coded
// by hand here.
export function SlotCheckbox({
  slotId,
  isAvailable,
  disabled,
}: {
  slotId: string
  isAvailable: boolean
  disabled?: boolean
}) {
  const id = useId()
  const [optimisticAvailable, setOptimisticAvailable] = useOptimistic(isAvailable)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange() {
    setError(null)
    startTransition(async () => {
      setOptimisticAvailable(!optimisticAvailable)
      const result = await toggleAvailability(slotId)
      if (!result.ok) {
        setError(result.error)
      }
    })
  }

  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={optimisticAvailable}
          disabled={disabled || isPending}
          onChange={handleChange}
          className="h-4 w-4 rounded border-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
        />
        <span>{optimisticAvailable ? "You're available" : 'Mark available'}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
