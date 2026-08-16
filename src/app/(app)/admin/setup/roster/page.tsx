import { getCurrentUser } from '@/lib/auth'
import { getRosterInvites } from '@/lib/db/onboarding'
import { RosterForm } from './roster-form'

export default async function RosterStep() {
  const user = await getCurrentUser()
  const invites = await getRosterInvites(user.school_id)

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Roster</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        This is the minimal version — listing, deactivation, and revoking an invite live in the admin
        console later. For now, this just sends invites.
      </p>

      {invites.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No one invited yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-neutral-700">
          {invites.map((i) => (
            <li key={i.email}>
              {i.email} — {i.roles.join(', ')} {i.claimedAt ? '(joined)' : '(pending)'}
            </li>
          ))}
        </ul>
      )}

      <RosterForm />
    </>
  )
}
