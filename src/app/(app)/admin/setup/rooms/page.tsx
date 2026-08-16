import { getCurrentUser } from '@/lib/auth'
import { getActiveRooms } from '@/lib/db/rounds'
import { SetupForm } from '@/lib/components/setup-form'
import { saveRoom } from './actions'

export default async function RoomsStep() {
  const user = await getCurrentUser()
  const rooms = await getActiveRooms(user.school_id)

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Rooms</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        A maintained list of rooms that are usually free, not a booking system. Optional — a round can be
        confirmed and given a room later even with nothing on this list yet.
      </p>

      {rooms.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No rooms added yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-700">
          {rooms.map((r) => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ul>
      )}

      <SetupForm action={saveRoom} submitLabel="Add room" className="mt-3 flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Room name</span>
          <input
            name="name"
            type="text"
            required
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Usually free (optional)</span>
          <input
            name="note"
            type="text"
            placeholder="Mornings, and after school"
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
      </SetupForm>
    </>
  )
}
