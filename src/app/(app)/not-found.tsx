// Rendered both for genuinely unmatched URLs under this route group and for
// RequireRole's notFound() calls on role-gated pages. Same page either way,
// deliberately — a non-admin hitting /admin must be indistinguishable from
// a typo, so the existence of admin-only routes is never confirmed.
export default function AppNotFound() {
  return (
    <>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-4 text-neutral-600">That page doesn&apos;t exist.</p>
    </>
  )
}
