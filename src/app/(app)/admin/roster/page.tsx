import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getRosterMembers } from '@/lib/db/admin'
import { getRosterInvites } from '@/lib/db/onboarding'
import { RosterForm } from '@/app/(app)/admin/setup/roster/roster-form'
import {
  DeactivateMemberButton,
  ReactivateMemberButton,
  RevokeInviteButton,
  ApproveInviteButton,
} from '@/lib/components/roster-actions'

function formatLastSeen(lastSeenAt: string | null): string {
  return lastSeenAt ? new Date(lastSeenAt).toLocaleString() : 'Never signed in'
}

export default function AdminRosterPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Roster</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Every current member, pending invites, and revoked ones stay off this list entirely.
      </p>
      <RosterContent />
    </RequireRole>
  )
}

// Queries deferred to this nested component so RequireRole's notFound()
// decides before any of this runs — same reasoning as /judging (step 10)
// and /admin/participation (step 13).
async function RosterContent() {
  const user = await getCurrentUser()
  const [members, invites] = await Promise.all([getRosterMembers(user.school_id), getRosterInvites(user.school_id)])

  const unclaimedInvites = invites.filter((i) => !i.claimedAt)

  return (
    <>
      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Members</h2>
      {members.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No one has joined yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2">Email</th>
                <th className="py-1 pr-2">Roles</th>
                <th className="py-1 pr-2">Last sign-in</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className={`border-b border-neutral-100 ${m.isActive ? '' : 'text-neutral-400'}`}>
                  <td className="py-1 pr-2">{m.fullName}</td>
                  <td className="py-1 pr-2">{m.email}</td>
                  <td className="py-1 pr-2">{m.roles.join(', ')}</td>
                  <td className="py-1 pr-2">{formatLastSeen(m.lastSeenAt)}</td>
                  <td className="py-1 pr-2">{m.isActive ? 'Active' : 'Deactivated'}</td>
                  <td className="py-1">
                    {m.isActive ? <DeactivateMemberButton userId={m.userId} /> : <ReactivateMemberButton userId={m.userId} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Pending invites</h2>
      {unclaimedInvites.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No unclaimed invites.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {unclaimedInvites.map((i) => {
            const isPendingApproval = i.needsApproval && !i.approvedBy
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-2 border-b border-neutral-100 py-1">
                <span>
                  {i.email} — {i.roles.join(', ')}
                  {isPendingApproval && <span className="ml-1 text-amber-700">(awaiting a second admin&apos;s approval)</span>}
                </span>
                {isPendingApproval && <ApproveInviteButton inviteId={i.id} />}
                <RevokeInviteButton inviteId={i.id} />
              </li>
            )
          })}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Invite people</h2>
      <RosterForm />
    </>
  )
}
