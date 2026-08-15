// Catches genuinely unmatched URLs outside the authenticated shell (e.g. a
// typo hit before Next.js can resolve any route at all). Kept minimal and
// shell-less on purpose — this is the one 404 case where we can't assume an
// authenticated session exists yet, so it doesn't call getCurrentUser().
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-neutral-600">That page doesn&apos;t exist.</p>
    </main>
  )
}
