import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'

const STEPS = [
  { href: '/admin/setup/basics', label: 'Basics' },
  { href: '/admin/setup/calendar-source', label: 'Calendar source' },
  { href: '/admin/setup/templates', label: 'Templates' },
  { href: '/admin/setup/rotation', label: 'Rotation' },
  { href: '/admin/setup/rooms', label: 'Rooms' },
  { href: '/admin/setup/roster', label: 'Roster' },
  { href: '/admin/setup/preview', label: 'Preview & confirm' },
]

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">School setup</h1>
      <nav aria-label="Setup steps" className="mt-3 flex flex-wrap gap-3 border-b pb-3 text-sm">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {step.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4">{children}</div>
    </RequireRole>
  )
}
