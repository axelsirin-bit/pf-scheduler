import { SignInButton } from './sign-in-button'

// Note on the refusal message: the step file asks for it to name the email
// address that was tried. That turned out not to be possible with this
// design — Supabase's auth server rejects the sign-in before our own code
// ever runs, and genericizes the trigger's error to "Database error saving
// new user" with no email attached. Verified directly against the real
// auth server (not guessed) — see PROGRESS.md. The message below is honest
// about that instead of pretending to name an account it doesn't have.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {error === 'not-on-roster' && (
        <p className="max-w-sm text-center text-red-600">
          That Google account is not on any team roster. Contact your coach if
          you think this is a mistake, or try again with the Google account
          your coach invited.
        </p>
      )}
      <SignInButton />
    </main>
  )
}
