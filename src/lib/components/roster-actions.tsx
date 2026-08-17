'use client'

import { useActionState } from 'react'
import {
  deactivateMember,
  reactivateMember,
  revokeInvite,
  approveInvite,
  type ActionResult,
} from '@/app/(app)/admin/roster/actions'

const initialState: ActionResult | null = null

function ErrorText({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null
  return (
    <p role="alert" className="text-xs text-red-600">
      {state.error}
    </p>
  )
}

export function DeactivateMemberButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => deactivateMember(userId),
    initialState
  )
  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={isPending}
        className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Deactivating…' : 'Deactivate'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function ReactivateMemberButton({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => reactivateMember(userId),
    initialState
  )
  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={isPending}
        className="rounded px-2 py-1 text-xs text-green-700 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Reactivating…' : 'Reactivate'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => revokeInvite(inviteId),
    initialState
  )
  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={isPending}
        className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Revoking…' : 'Revoke'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function ApproveInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => approveInvite(inviteId),
    initialState
  )
  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Approving…' : 'Approve'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}
