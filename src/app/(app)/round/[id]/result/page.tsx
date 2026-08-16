import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPostRoundForm, type PostRoundResult } from '@/lib/db/results'
import { ResultForm } from '@/lib/components/result-form'

function formatDateTime(startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startsAt))
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

function roundStatusLabel(status: string): string {
  switch (status) {
    case 'forming':
      return 'Forming'
    case 'confirmed':
      return 'Confirmed'
    case 'awaiting_result':
      return 'Awaiting result'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

function ResultSummary({
  result,
  debaterNames,
}: {
  result: PostRoundResult
  debaterNames: Map<string, string>
}) {
  return (
    <div className="rounded border border-neutral-200 p-3 text-sm">
      <p>
        <span className="font-medium">Winner:</span> Team {result.winningTeam}
      </p>
      <p>
        <span className="font-medium">Team 1 side:</span> {result.team1Side === 'pro' ? 'Pro' : 'Con'} (team 2 was{' '}
        {result.team1Side === 'pro' ? 'Con' : 'Pro'})
      </p>
      <p className="mt-2 whitespace-pre-wrap">{result.rfd}</p>
      {result.notes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-neutral-500">Private notes visible to you</p>
          <ul className="mt-1 flex flex-col gap-1">
            {result.notes.map((n) => (
              <li key={n.aboutUserId}>
                <span className="font-medium">{debaterNames.get(n.aboutUserId) ?? 'A debater'}:</span> {n.note}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-500">Submitted {new Date(result.submittedAt).toLocaleString()}</p>
    </div>
  )
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const form = await getPostRoundForm(id, user.id, user.roles)
  if (!form) {
    notFound()
  }

  const isJudge = form.judgeUserId === user.id
  const isAdmin = user.roles.includes('admin')
  const debaterNames = new Map(form.debaters.map((d) => [d.userId, d.displayName]))

  const canSubmitOriginal =
    isJudge &&
    !form.currentResult &&
    form.isSlotStarted &&
    (form.status === 'confirmed' || form.status === 'awaiting_result')
  const canSubmitCorrection = (isJudge || isAdmin) && form.currentResult !== null

  return (
    <>
      <h1 className="text-xl font-semibold">{form.slotLabel} — result</h1>
      <p className="mt-1 text-sm text-neutral-600">{formatDateTime(form.startsAt, form.endsAt, user.school.timezone)}</p>
      <p className="mt-1 text-sm font-medium text-neutral-700">{roundStatusLabel(form.status)}</p>

      {!form.currentResult && (
        <div className="mt-4">
          {canSubmitOriginal ? (
            <ResultForm roundId={form.roundId} debaters={form.debaters} mode="submit" />
          ) : (
            <p className="text-sm text-neutral-600">
              {isJudge && !form.isSlotStarted
                ? "You can submit a result once this slot's start time has passed."
                : 'No result has been submitted yet.'}
            </p>
          )}
        </div>
      )}

      {form.currentResult && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-neutral-900">Result</h2>
          <div className="mt-2">
            <ResultSummary result={form.currentResult} debaterNames={debaterNames} />
          </div>
          {canSubmitCorrection && (
            <ResultForm
              roundId={form.roundId}
              debaters={form.debaters}
              mode="correct"
              supersedesResultId={form.currentResult.id}
            />
          )}
        </div>
      )}

      {form.priorResults.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-neutral-900">Superseded results</h2>
          <div className="mt-2 flex flex-col gap-2">
            {form.priorResults.map((r) => (
              <ResultSummary key={r.id} result={r} debaterNames={debaterNames} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
