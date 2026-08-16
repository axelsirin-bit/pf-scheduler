import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getSchoolTerms } from '@/lib/db/onboarding'
import { getLeaderboard, type ShapedEntry } from '@/lib/db/leaderboard'
import { todayInTimezone } from '@/lib/schedule/week-bounds'

function EntryLine({ entry, expected }: { entry: ShapedEntry; expected: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span>{entry.displayName}</span>
      <span className="tabular-nums text-neutral-600">
        {entry.totalRounds} of {expected} · {entry.debateRounds} debate, {entry.judgeRounds} judge
      </span>
    </div>
  )
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const { term } = await searchParams
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const terms = await getSchoolTerms(user.school_id)
  const today = todayInTimezone(user.school.timezone)
  const currentTerm = terms.find((t) => t.startsOn <= today && today <= t.endsOn) ?? null

  const selectedTerm = (term ? terms.find((t) => t.id === term) : null) ?? currentTerm ?? null

  return (
    <>
      <h1 className="text-xl font-semibold">Leaderboard</h1>

      {terms.length === 0 ? (
        <p className="mt-4 text-neutral-600">No terms configured yet — check back once the school year is set up.</p>
      ) : (
        <>
          <nav aria-label="Term" className="mt-3 flex flex-wrap gap-2 text-sm">
            {terms.map((t) => (
              <Link
                key={t.id}
                href={`/leaderboard?term=${t.id}`}
                aria-current={t.id === selectedTerm?.id ? 'true' : undefined}
                className={`rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  t.id === selectedTerm?.id ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100'
                }`}
              >
                {t.name}
                {t.id === currentTerm?.id ? ' (current)' : ''}
              </Link>
            ))}
          </nav>

          {!selectedTerm ? (
            <p className="mt-4 text-neutral-600">
              No term is active right now. Pick one above to see how it went.
            </p>
          ) : (
            <LeaderboardBoard schoolId={user.school_id} userId={user.id} termId={selectedTerm.id} termName={selectedTerm.name} />
          )}
        </>
      )}
    </>
  )
}

async function LeaderboardBoard({
  schoolId,
  userId,
  termId,
  termName,
}: {
  schoolId: string
  userId: string
  termId: string
  termName: string
}) {
  const board = await getLeaderboard(schoolId, termId, userId)

  return (
    <>
      <p className="mt-3 text-sm text-neutral-600">
        {termName}: {board.expectedRoundsPerTerm} completed rounds expected this term.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Your progress</h2>
      {board.currentUser ? (
        <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <EntryLine entry={board.currentUser} expected={board.expectedRoundsPerTerm} />
          <p className="mt-1 text-xs text-blue-900">
            {board.currentUser.onTrack
              ? "You're on track for this term."
              : `${Math.max(board.expectedRoundsPerTerm - board.currentUser.totalRounds, 0)} more to be on track.`}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">You&apos;re not on this school&apos;s roster for this term.</p>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Top five</h2>
      {board.topFive.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No completed rounds yet this term.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-neutral-500">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 pr-2 text-right">Debate</th>
                <th className="py-1 pr-2 text-right">Judge</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {board.topFive.map((entry, i) => (
                <tr key={entry.userId} className={entry.userId === userId ? 'bg-blue-50' : ''}>
                  <td className="py-1 pr-2 tabular-nums text-neutral-500">{i + 1}</td>
                  <td className="py-1 pr-2">{entry.displayName}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{entry.debateRounds}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{entry.judgeRounds}</td>
                  <td className="py-1 text-right tabular-nums font-medium">{entry.totalRounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">On track</h2>
      {board.onTrack.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">
          No one has hit the expected count yet this term. Check the slots you&apos;re free for on This week.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {board.onTrack.map((entry) => (
            <li key={entry.userId} className={entry.userId === userId ? 'rounded bg-blue-50 px-1' : ''}>
              <EntryLine entry={entry} expected={board.expectedRoundsPerTerm} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
