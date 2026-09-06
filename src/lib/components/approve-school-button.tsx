'use client'

import { useActionState } from 'react'
import { approveSchoolRequestAction, type ApproveActionResult } from '@/app/approve-school/[requestId]/actions'

const initialState: ApproveActionResult | null = null

// A confirm button behind a real form submit (POST), not the link itself
// performing the approval on GET — an email client's own link-scanning
// (Gmail, Outlook Safe Links, corporate security gateways commonly
// pre-fetch links to check for phishing) would otherwise silently approve
// a school before a human ever clicked anything, defeating the whole
// point of a manual review step.
export function ApproveSchoolButton({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ApproveActionResult | null) => approveSchoolRequestAction(requestId),
    initialState
  )

  if (state?.ok && !state.alreadyReviewed) {
    return (
      <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        Approved. &quot;{state.schoolName}&quot; is set up (slug &quot;{state.slug}&quot;).{' '}
        {state.emailSent
          ? 'A sign-in email was sent to the admin.'
          : "The sign-in email couldn't be sent — let the admin know to try /register's contact directly, or resend by hand."}
      </p>
    )
  }

  if (state?.ok && state.alreadyReviewed) {
    return (
      <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        This request was already reviewed (status: {state.status}). No changes made.
      </p>
    )
  }

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Approving…' : 'Approve this school'}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}
