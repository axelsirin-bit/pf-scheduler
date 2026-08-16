import { RequestForm } from './request-form'

// Public, no session required — see decisions.md, "Excluded: self-serve
// school registration." This is the request only; approval is manual
// (scripts/approve-school-request.ts), verified against the Tabroom URL.
export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold">Request access</h1>
        <p className="mt-2 text-sm text-neutral-600">
          There&apos;s no self-serve sign-up. Tell us about your team and we&apos;ll set your school up by hand,
          usually within a few days.
        </p>
      </div>
      <RequestForm />
    </main>
  )
}
