'use client'

import { useActionState } from 'react'
import { approveBatchAction, rejectBatchAction, overrideConflictAction, type ActionResult } from '@/app/(app)/admin/schedule/feed/batches/[id]/actions'

const initialState: ActionResult | null = null

function ErrorText({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null
  return (
    <p role="alert" className="text-xs text-red-600">
      {state.error}
    </p>
  )
}

export function ApproveRejectForm({ batchId }: { batchId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(
    async (_prev: ActionResult | null) => approveBatchAction(batchId),
    initialState
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    async (_prev: ActionResult | null) => rejectBatchAction(batchId),
    initialState
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={approveAction}>
          <button
            type="submit"
            disabled={approvePending}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {approvePending ? 'Approving…' : 'Approve batch'}
          </button>
        </form>
        <form action={rejectAction}>
          <button
            type="submit"
            disabled={rejectPending}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {rejectPending ? 'Rejecting…' : 'Reject batch'}
          </button>
        </form>
      </div>
      <ErrorText state={approveState} />
      <ErrorText state={rejectState} />
    </div>
  )
}

export function OverrideConflictButton({ batchId, date }: { batchId: string; date: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => overrideConflictAction(batchId, date),
    initialState
  )

  return (
    <form action={formAction} className="mt-1 inline-block">
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Applying…' : 'Apply this date anyway'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}
