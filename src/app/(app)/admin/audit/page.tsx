import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getAuditLog, type AuditLogEntry } from '@/lib/db/admin'

function DiffCell({ entry }: { entry: AuditLogEntry }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-blue-700 underline">Before / after</summary>
      <div className="mt-1 flex flex-col gap-1 text-xs">
        <div>
          <span className="font-medium text-neutral-500">Before:</span>
          <pre className="mt-0.5 whitespace-pre-wrap break-all rounded bg-neutral-50 p-1">
            {entry.before ? JSON.stringify(entry.before, null, 2) : '—'}
          </pre>
        </div>
        <div>
          <span className="font-medium text-neutral-500">After:</span>
          <pre className="mt-0.5 whitespace-pre-wrap break-all rounded bg-neutral-50 p-1">
            {entry.after ? JSON.stringify(entry.after, null, 2) : '—'}
          </pre>
        </div>
      </div>
    </details>
  )
}

export default function AdminAuditPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Written directly by database triggers on every roster, room, and role/status change — nothing here can be
        edited or deleted, by anyone.
      </p>
      <AuditContent />
    </RequireRole>
  )
}

async function AuditContent() {
  const user = await getCurrentUser()
  const entries = await getAuditLog(user.school_id)

  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-neutral-600">Nothing logged yet.</p>
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-neutral-500">
            <th className="py-1 pr-2">When</th>
            <th className="py-1 pr-2">Actor</th>
            <th className="py-1 pr-2">Action</th>
            <th className="py-1 pr-2">Entity</th>
            <th className="py-1">Diff</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-neutral-100 align-top">
              <td className="py-1 pr-2 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
              <td className="py-1 pr-2">{e.actorName ?? 'System'}</td>
              <td className="py-1 pr-2">{e.action}</td>
              <td className="py-1 pr-2">
                {e.entityType}
                {e.entityId ? ` (${e.entityId.slice(0, 8)}…)` : ''}
              </td>
              <td className="py-1">
                <DiffCell entry={e} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
