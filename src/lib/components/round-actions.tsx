'use client'

import { useActionState, useState } from 'react'
import { joinRound, leaveRound, cancelRound, setRoundRoom, type ActionResult } from '@/app/(app)/slot/[id]/actions'

const initialState: ActionResult | null = null

function ErrorText({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null
  return (
    <p role="alert" className="text-xs text-red-600">
      {state.error}
    </p>
  )
}

// Same form either starts a fresh round (none exists yet, or the caller
// isn't part of whichever one does) or joins an existing forming one —
// joinRound's find-or-create logic on the server makes these the same
// call either way. `mode` only changes the button copy.
export function JoinRoundForm({
  slotId,
  mode,
  canJudge,
  judgeTaken,
  team1Full,
  team2Full,
}: {
  slotId: string
  mode: 'start' | 'join'
  canJudge: boolean
  judgeTaken: boolean
  team1Full: boolean
  team2Full: boolean
}) {
  const [role, setRole] = useState<'debater' | 'judge'>('debater')
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const formRole = formData.get('role') as 'debater' | 'judge'
    const teamRaw = formData.get('team')
    const team = teamRaw ? (Number(teamRaw) as 1 | 2) : undefined
    return joinRound(slotId, formRole, team)
  }, initialState)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded border border-neutral-200 p-2 text-sm">
      <label className="flex items-center gap-2">
        <span>Join as</span>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'debater' | 'judge')}
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <option value="debater">a debater</option>
          {canJudge && (
            <option value="judge" disabled={judgeTaken}>
              judge{judgeTaken ? ' (already taken)' : ''}
            </option>
          )}
        </select>
      </label>
      {role === 'debater' && (
        <label className="flex items-center gap-2">
          <span>Team</span>
          <select
            name="team"
            defaultValue="1"
            className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="1" disabled={team1Full}>
              1{team1Full ? ' (full)' : ''}
            </option>
            <option value="2" disabled={team2Full}>
              2{team2Full ? ' (full)' : ''}
            </option>
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Joining…' : mode === 'start' ? 'Start a round' : 'Join this round'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

// The /judging queue's "one click to claim" — same joinRound('judge') call
// the full JoinRoundForm makes, just without a role/team form around it,
// since on this screen the role is never in question.
export function ClaimJudgeButton({ slotId }: { slotId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => joinRound(slotId, 'judge'),
    initialState
  )

  return (
    <form action={formAction} className="mt-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Claiming…' : 'Claim as judge'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function LeaveRoundButton({ roundId }: { roundId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => leaveRound(roundId),
    initialState
  )

  return (
    <form action={formAction} className="mt-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded px-3 py-1.5 text-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Leaving…' : 'Leave round'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function CancelRoundForm({ roundId }: { roundId: string }) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    return cancelRound(roundId, formData.get('reason') as string)
  }, initialState)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-1">
      <label htmlFor="cancel-reason" className="text-xs text-neutral-600">
        Reason (optional)
      </label>
      <input
        id="cancel-reason"
        name="reason"
        type="text"
        className="rounded border border-neutral-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Cancelling…' : 'Cancel round'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function SetRoomForm({ roundId, rooms }: { roundId: string; rooms: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const roomId = (formData.get('roomId') as string) || null
    const freetext = formData.get('roomFreetext') as string
    return setRoundRoom(roundId, roomId, roomId ? null : freetext)
  }, initialState)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm">
      <p className="font-medium text-blue-900">Pick a room to confirm where this round happens</p>
      <select
        name="roomId"
        defaultValue=""
        className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <option value="">Choose from the list…</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label htmlFor="room-freetext" className="text-xs text-neutral-600">
        Or type one in instead
      </label>
      <input
        id="room-freetext"
        name="roomFreetext"
        type="text"
        placeholder="e.g. Library Annex"
        className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Set room'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}
