'use client'

// App-level error boundary. Kept shell-less like not-found.tsx, for the
// same reason: an error here could be getCurrentUser() itself failing, so
// this can't safely assume a session exists to render a header/nav around.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">This page hit a problem</h1>
      <p className="text-neutral-600">Try again, or come back in a moment.</p>
      <button
        onClick={reset}
        className="rounded border px-3 py-1.5 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Try again
      </button>
    </main>
  )
}
