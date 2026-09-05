import Link from 'next/link'

// Public, no session required, same as /sign-in and /privacy. Kept short and
// generic — see CLAUDE.md, "v1 is school-agnostic starting at step 04."
export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8 text-sm leading-relaxed text-neutral-800">
      <div>
        <Link href="/sign-in" className="text-xs underline">
          ← Back to sign in
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Terms</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Who can use this</h2>
        <p>
          You must be at least 13 years old to use this app. You need an invitation from your school&apos;s admin — there
          is no self-serve sign-up. Your account is for your own use only; don&apos;t share your sign-in with anyone else.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">What this app is for</h2>
        <p>
          This app schedules Public Forum practice debate rounds for your school&apos;s team: marking availability,
          matching debaters and judges into rounds, and recording results. It is a scheduling and record-keeping tool,
          not a substitute for your coach&apos;s judgment about who should debate or how a round should be run.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Your responsibilities</h2>
        <ul className="list-disc pl-5">
          <li>Use the app honestly — mark yourself available when you mean it, and submit results and reasons for decision truthfully.</li>
          <li>Only link video or documents you have the right to share with your team.</li>
          <li>Don&apos;t attempt to access another school&apos;s data or another person&apos;s account.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">No warranty</h2>
        <p>
          This app is provided as-is, without warranty of any kind. It is built and maintained on a best-effort basis. We
          try to keep it running and your data intact, but we don&apos;t guarantee uninterrupted availability.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Account deactivation</h2>
        <p>
          Your school&apos;s admin can deactivate your account at any time, for example when you graduate or leave the
          team. See our <Link href="/privacy" className="underline">privacy page</Link> for what happens to your data
          when that happens.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Changes</h2>
        <p>These terms may change as the app changes. Continued use after a change means you accept the updated terms.</p>
      </section>
    </main>
  )
}
