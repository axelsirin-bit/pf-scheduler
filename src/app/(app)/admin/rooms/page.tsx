import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getAllRooms } from '@/lib/db/admin'
import { AddRoomForm, EditRoomRow } from '@/lib/components/room-actions'

export default function AdminRoomsPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Rooms</h1>
      <p className="mt-1 text-sm text-neutral-600">
        A maintained list of rooms that are usually free, not a booking system.
      </p>
      <RoomsContent />
    </RequireRole>
  )
}

async function RoomsContent() {
  const user = await getCurrentUser()
  const rooms = await getAllRooms(user.school_id)

  return (
    <>
      {rooms.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No rooms added yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {rooms.map((r) => (
            <EditRoomRow key={r.id} room={r} />
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Add a room</h2>
      <AddRoomForm />
    </>
  )
}
