import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getOnboardingChecklist } from '@/lib/db/onboarding'

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
      <p className="mt-4 text-neutral-600">
        Nothing to manage yet. Roster, rooms, and the audit log will live here.
      </p>
      <OnboardingChecklist />
    </RequireRole>
  )
}
