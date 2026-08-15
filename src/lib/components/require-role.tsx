import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import type { Database } from '@/lib/db/types'

type AppRole = Database['public']['Enums']['app_role']

// Wraps a page's content so the role check is one line rather than
// copy-pasted logic. Uses notFound() rather than a 403 page — the existence
// of role-gated routes shouldn't be advertised to someone who can't see
// them. Navigation hiding alone isn't protection; this is what actually
// enforces it.
export async function RequireRole({
  role,
  children,
}: {
  role: AppRole
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user.roles.includes(role)) {
    notFound()
  }

  return <>{children}</>
}
