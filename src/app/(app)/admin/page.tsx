import { RequireRole } from '@/lib/components/require-role'

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mt-4 text-neutral-600">
        Nothing to manage yet. Roster, rooms, and the audit log will live
        here.
      </p>
    </RequireRole>
  )
}
