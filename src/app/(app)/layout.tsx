import { getCurrentUser, signOut } from '@/lib/auth'
import { Nav } from '@/lib/components/nav'

// Wraps every authenticated page. Sign-in and the OAuth callback live
// outside this route group entirely, since there's no user or school to
// show a header for at that point.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-medium">{user.school?.name}</span>
        <div className="flex items-center gap-3 text-sm">
          {/* display_name only — full names are admin-console-only, see ui-conventions.md */}
          <span>{user.display_name}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded px-2 py-1 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <Nav roles={user.roles} />
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
