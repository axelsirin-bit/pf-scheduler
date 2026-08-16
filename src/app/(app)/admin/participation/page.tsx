import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getSchoolTerms } from '@/lib/db/onboarding'
import { getParticipationBreakdown } from '@/lib/db/leaderboard'
import { todayInTimezone } from '@/lib/schedule/week-bounds'

async function Breakdown({ schoolId, termId, termName }: { schoolId: string; termId: string; termName: string }) {
  const { expectedRoundsPerTerm, entries } = await getParticipationBreakdown(schoolId, termId)

  return (
    <>
      <p className="mt-3 text-sm text-neutral-600">
        {termName}: {expectedRoundsPerTerm} completed rounds expected this term.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No active members found.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2 text-right">Debate</th>
                <th className="py-1 pr-2 text-right">Judge</th>
                <th className="py-1 pr-2 text-right">Total</th>
                <th className="py-1 text-right">On track</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.userId} className="border-b border-neutral-100">
                  <td className="py-1 pr-2">{e.fullName}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{e.debateRounds}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{e.judgeRounds}</td>
                  <td className="py-1 pr-2 text-right tabular-nums font-medium">{e.totalRounds}</td>
                  <td className="py-1 text-right">{e.onTrack ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function TermPicker({
  schoolId,
  terms,
  currentTermId,
  selectedTermId,
}: {
  schoolId: string
  terms: { id: string; name: string; startsOn: string; endsOn: string }[]
  currentTermId: string | null
  selectedTermId?: string
}) {
  const selectedTerm = (selectedTermId ? terms.find((t) => t.id === selectedTermId) : null) ?? terms.find((t) => t.id === currentTermId) ?? null

  if (terms.length === 0) {
    return <p className="mt-4 text-neutral-600">No terms configured yet.</p>
  }

  return (
    <>
      <nav aria-label="Term" className="mt-3 flex flex-wrap gap-2 text-sm">
        {terms.map((t) => (
          <Link
            key={t.id}
            href={`/admin/participation?term=${t.id}`}
            aria-current={t.id === selectedTerm?.id ? 'true' : undefined}
            className={`rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              t.id === selectedTerm?.id ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100'
            }`}
          >
            {t.name}
            {t.id === currentTermId ? ' (current)' : ''}
          </Link>
        ))}
      </nav>

      {!selectedTerm ? (
        <p className="mt-4 text-neutral-600">No term is active right now. Pick one above.</p>
      ) : (
        <Breakdown schoolId={schoolId} termId={selectedTerm.id} termName={selectedTerm.name} />
      )}
    </>
  )
}

export default async function AdminParticipationPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const { term } = await searchParams

  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Participation</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Full names — this is the one place they belong. Peers see{' '}
        <Link href="/leaderboard" className="underline">
          the leaderboard
        </Link>{' '}
        with first name and last initial only.
      </p>
      <ParticipationContent term={term} />
    </RequireRole>
  )
}

// A separate async component so its queries only ever run once RequireRole
// has already decided this viewer holds the admin role — same reasoning as
// /judging in step 10: notFound() happens before this subtree is ever
// rendered, not just before it's displayed.
async function ParticipationContent({ term }: { term?: string }) {
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const terms = await getSchoolTerms(user.school_id)
  const today = todayInTimezone(user.school.timezone)
  const currentTerm = terms.find((t) => t.startsOn <= today && today <= t.endsOn) ?? null

  return <TermPicker schoolId={user.school_id} terms={terms} currentTermId={currentTerm?.id ?? null} selectedTermId={term} />
}
