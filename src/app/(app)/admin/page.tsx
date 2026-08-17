import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getOnboardingChecklist } from '@/lib/db/onboarding'
import { getAdminOverview } from '@/lib/db/admin'

async function OnboardingChecklist() {
  const user = await getCurrentUser()
  const items = await getOnboardingChecklist(user.school_id)
  const requiredRemaining = items.filter((i) => i.required && !i.done)

  if (requiredRemaining.length === 0 && items.every((i) => i.done)) {
    return null
  }

  return (
    <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">Setup checklist</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item.label} className={item.done ? 'text-neutral-500 line-through' : 'text-neutral-800'}>
            {item.done ? '✓' : item.required ? '•' : '·'}{' '}
            {item.done ? (
              item.label
            ) : (
              <Link href={item.href} className="underline">
                {item.label}
              </Link>
            )}
            {!item.required && !item.done && <span className="text-neutral-500"> (optional)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Admin</h1>

      <nav className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/roster" className="underline">
          Roster
        </Link>
        <Link href="/admin/rooms" className="underline">
          Rooms
        </Link>
        <Link href="/admin/audit" className="underline">
          Audit log
        </Link>
        <Link href="/admin/participation" className="underline">
          Participation breakdown
        </Link>
      </nav>

      <OnboardingChecklist />
      <Overview />
    </RequireRole>
  )
}

// Queries deferred to this nested component so RequireRole's notFound()
// decides before any of this runs — same reasoning as /judging (step 10).
async function Overview() {
  const user = await getCurrentUser()
  const overview = await getAdminOverview(user.school_id)

  return (
    <>
      <p className="mt-6 text-sm text-neutral-600">
        {overview.currentTermName ? `Current term: ${overview.currentTermName}` : 'No term is active right now.'}
      </p>

      {overview.zeroRoundMembers.length > 0 && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Zero rounds this term</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-900">
            {overview.zeroRoundMembers.map((m) => (
              <li key={m.userId}>{m.fullName}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-neutral-200 p-3 text-sm">
          <p className="text-xs font-semibold text-neutral-500">Rounds this week</p>
          <p className="text-lg font-medium">{overview.rounds.completedThisWeek}</p>
        </div>
        <div className="rounded border border-neutral-200 p-3 text-sm">
          <p className="text-xs font-semibold text-neutral-500">Rounds this term</p>
          <p className="text-lg font-medium">{overview.rounds.completedThisTerm}</p>
        </div>
        <div className="rounded border border-neutral-200 p-3 text-sm">
          <p className="text-xs font-semibold text-neutral-500">Expired without a result (this term)</p>
          <p className="text-lg font-medium">{overview.rounds.expiredThisTerm}</p>
        </div>
        <div className="rounded border border-neutral-200 p-3 text-sm">
          <p className="text-xs font-semibold text-neutral-500">Roster size by role</p>
          <p>
            {overview.rosterByRole.debater} debaters · {overview.rosterByRole.judge} judges · {overview.rosterByRole.admin} admins
          </p>
        </div>
      </div>

      <h2 className="mt-4 text-sm font-semibold text-neutral-900">Awaiting a result</h2>
      {overview.rounds.awaitingResult.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">Nothing overdue.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {overview.rounds.awaitingResult.map((r) => (
            <li key={r.roundId}>
              <Link href={`/round/${r.roundId}/result`} className="underline">
                {r.slotLabel}
              </Link>{' '}
              — {r.hoursOverdue}h overdue
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
