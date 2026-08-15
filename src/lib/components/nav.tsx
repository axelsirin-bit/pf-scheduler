import Link from 'next/link'
import type { Database } from '@/lib/db/types'

type AppRole = Database['public']['Enums']['app_role']

const NAV_ITEMS: { label: string; href: string; role?: AppRole }[] = [
  { label: 'This week', href: '/' },
  { label: 'My rounds', href: '/my-rounds' },
  { label: 'Judging', href: '/judging', role: 'judge' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Archive', href: '/archive' },
  { label: 'Admin', href: '/admin', role: 'admin' },
]

// Hiding a link here is a UX nicety, not protection — RequireRole on the
// page itself is what actually enforces access.
export function Nav({ roles }: { roles: AppRole[] }) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.role || roles.includes(item.role))

  return (
    <nav aria-label="Main" className="flex flex-wrap gap-4 border-b px-4 py-2 text-sm">
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded px-1 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
