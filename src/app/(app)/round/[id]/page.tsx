import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getRoundDetail } from '@/lib/db/archive'
import { AddLinkForm } from '@/lib/components/add-link-form'

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

function linkKindLabel(kind: string): string {
  switch (kind) {
    case 'video':
      return 'Video'
    case 'speech_doc':
      return 'Speech doc'
    case 'flow':
      return 'Flow'
    default:
      return 'Other'
  }
}

export default async function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const round = await getRoundDetail(id)
  if (!round) {
    notFound()
  }

  const team1 = round.debaters.filter((d) => d.team === 1)
  const team2 = round.debaters.filter((d) => d.team === 2)

  return (
    <>
      <p className="text-sm">
        <Link href="/archive" className="underline">
          ← Archive
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">
        {round.slotLabel}
        {round.termName ? ` · ${round.termName}` : ''}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">{formatDateTime(round.startsAt, round.endsAt, user.school.timezone)}</p>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Participants</h2>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-neutral-500">Team 1{round.winningTeam === 1 ? ' — won' : ''}</p>
          {team1.length === 0 ? <p className="text-neutral-500">—</p> : team1.map((d) => <p key={d.userId}>{d.displayName}</p>)}
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-500">Team 2{round.winningTeam === 2 ? ' — won' : ''}</p>
          {team2.length === 0 ? <p className="text-neutral-500">—</p> : team2.map((d) => <p key={d.userId}>{d.displayName}</p>)}
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-500">Judge</p>
          <p>{round.judge?.displayName ?? '—'}</p>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Result</h2>
      {!round.rfd ? (
        <p className="mt-2 text-sm text-neutral-600">No result recorded yet.</p>
      ) : (
        <div className="mt-2 rounded border border-neutral-200 p-3 text-sm">
          <p>
            <span className="font-medium">Winner:</span> Team {round.winningTeam}
          </p>
          <p>
            <span className="font-medium">Team 1 side:</span> {round.team1Side === 'pro' ? 'Pro' : 'Con'} (team 2 was{' '}
            {round.team1Side === 'pro' ? 'Con' : 'Pro'})
          </p>
          <p className="mt-2 whitespace-pre-wrap">{round.rfd}</p>
          {round.resultSubmittedAt && (
            <p className="mt-2 text-xs text-neutral-500">Submitted {new Date(round.resultSubmittedAt).toLocaleString()}</p>
          )}
        </div>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Links</h2>
      {round.links.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No links added yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {round.links.map((l) => (
            <li key={l.id} className="rounded border border-neutral-200 p-2">
              <p>
                <span className="font-medium">{linkKindLabel(l.kind)}</span>
                {l.label ? ` — ${l.label}` : ''}
              </p>
              <a href={l.url} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">
                {l.url}
              </a>
              {l.addedByDisplayName && <p className="mt-1 text-xs text-neutral-500">Added by {l.addedByDisplayName}</p>}
            </li>
          ))}
        </ul>
      )}
      {round.status === 'completed' && <AddLinkForm roundId={round.id} />}
    </>
  )
}
