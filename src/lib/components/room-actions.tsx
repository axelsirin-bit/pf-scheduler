'use client'

import { useActionState, useState } from 'react'
import { addRoom, updateRoom, setRoomActive, type ActionResult } from '@/app/(app)/admin/rooms/actions'

const initialState: ActionResult | null = null

function ErrorText({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null
  return (
    <p role="alert" className="text-xs text-red-600">
      {state.error}
    </p>
  )
}

export function AddRoomForm() {
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const name = (formData.get('name') as string) ?? ''
    const note = (formData.get('note') as string) ?? ''
    return addRoom(name, note || null)
  }, initialState)

  return (
    <form action={formAction} className="mt-2 flex max-w-sm flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span>Room name</span>
        <input
          name="name"
          type="text"
          required
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Usually free (optional)</span>
        <input
          name="note"
          type="text"
          placeholder="Mornings, and after school"
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add room'}
      </button>
      <ErrorText state={state} />
    </form>
  )
}

export function EditRoomRow({ room }: { room: { id: string; name: string; note: string | null; isActive: boolean } }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState(async (_prev: ActionResult | null, formData: FormData) => {
    const name = (formData.get('name') as string) ?? ''
    const note = (formData.get('note') as string) ?? ''
    const result = await updateRoom(room.id, name, note || null)
    if (result.ok) setEditing(false)
    return result
  }, initialState)

  const [toggleState, toggleAction, togglePending] = useActionState(
    async (_prev: ActionResult | null) => setRoomActive(room.id, !room.isActive),
    initialState
  )

  if (editing) {
    return (
      <li className="rounded border border-neutral-200 p-2 text-sm">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">Room name</span>
            <input
              name="name"
              type="text"
              defaultValue={room.name}
              required
              className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-600">Usually free</span>
            <input
              name="note"
              type="text"
              defaultValue={room.note ?? ''}
              className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Cancel
          </button>
        </form>
        <ErrorText state={state} />
      </li>
    )
  }

  return (
    <li className={`flex flex-wrap items-center gap-2 border-b border-neutral-100 py-1 text-sm ${room.isActive ? '' : 'text-neutral-400'}`}>
      <span className="flex-1">
        {room.name}
        {room.note ? ` — ${room.note}` : ''}
        {!room.isActive && ' (inactive)'}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-2 py-1 text-xs hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Edit
      </button>
      <form action={toggleAction} className="inline-block">
        <button
          type="submit"
          disabled={togglePending}
          className={`rounded px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
            room.isActive ? 'text-red-700 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'
          }`}
        >
          {togglePending ? 'Saving…' : room.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
        <ErrorText state={toggleState} />
      </form>
    </li>
  )
}
