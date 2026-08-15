import { RequireRole } from '@/lib/components/require-role'

export default function JudgingPage() {
  return (
    <RequireRole role="judge">
      <h1 className="text-xl font-semibold">Judging</h1>
      <p className="mt-4 text-neutral-600">
        No rounds need a judge right now. Check back once availability lines
        up.
      </p>
    </RequireRole>
  )
}
