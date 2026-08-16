'use client'

import { useActionState } from 'react'
import { addRoundLink, type ActionResult, type LinkKind } from '@/app/(app)/round/[id]/actions'

const KIND_OPTIONS: { value: LinkKind; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'speech_doc', label: 'Speech doc' },
  { value: 'flow', label: 'Flow' },
  { value: 'other', label: 'Other' },
]

export function AddLinkForm({ roundId }: { roundId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const kind = formData.get('kind') as LinkKind
    const url = (formData.get('url') as string) ?? ''
    const label = (formData.get('label') as string) ?? ''
    return addRoundLink(roundId, { kind, url, label: label || undefined })
  }, null)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded border border-neutral-200 p-3 text-sm">
      <p className="font-medium text-neutral-900">Add a link</p>

      <label className="flex items-center gap-2">
        <span>Kind</span>
        <select
          name="kind"
          defaultValue="video"
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span>URL</span>
        <input
          type="url"
          name="url"
          required
          placeholder="https://drive.google.com/..."
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>Label (optional)</span>
        <input
          type="text"
          name="label"
          placeholder="e.g. Round 3 video"
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>

      <p className="text-xs text-neutral-600">
        Double check the Drive sharing setting on this file lets your team open it — links here are visible to everyone at your school.
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add link'}
      </button>

      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
