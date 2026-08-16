'use client'

import { useActionState } from 'react'
import { submitSchoolRequest, type SubmitRequestResult } from './actions'

const initialState: SubmitRequestResult | null = null

export function RequestForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: SubmitRequestResult | null, formData: FormData) => {
    return submitSchoolRequest(formData)
  }, initialState)

  if (state?.ok) {
    return (
      <p className="max-w-sm text-center text-neutral-700">
        Request received. We&apos;ll be in touch at the email you gave us once it&apos;s reviewed.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">School name</span>
        <input
          name="schoolName"
          type="text"
          required
          className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Your name</span>
        <input
          name="adminName"
          type="text"
          required
          className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Institutional email</span>
        <input
          name="adminEmail"
          type="email"
          required
          className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Your Tabroom coach profile URL</span>
        <input
          name="tabroomUrl"
          type="url"
          required
          placeholder="https://www.tabroom.com/..."
          className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Anything else? (optional)</span>
        <textarea
          name="note"
          rows={3}
          className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Sending…' : 'Send request'}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
