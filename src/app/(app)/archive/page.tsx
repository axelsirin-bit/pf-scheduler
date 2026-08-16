import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getArchive, shapeArchive, type ArchiveRound } from '@/lib/db/archive'

function formatDate(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(startsAt)
  )
}

function sideLabel(team: 1 | 2, team1Side: 'pro' | 'con' | null): string {
  if (!team1Side) return ''
  const side = team === 1 ? team1Side : team1Side === 'pro' ? 'con' : 'pro'
  return side === 'pro' ? 'Pro' : 'Con'
}

function ArchiveCard({ round, timeZone }: { round: ArchiveRound; timeZone: string }) {
  const team1 = round.debaters.filter((d) => d.team === 1)
  const team2 = round.debaters.filter((d) => d.team === 2)

  return (
    <li className="rounded border border-neutral-200 p-3 text-sm">
      <p className="font-medium text-neutral-900">
        {formatDate(round.startsAt, timeZone)} · {round.slotLabel}
        {round.termName ? ` · ${round.termName}` : ''}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold text-neutral-500">
            Team 1{round.team1Side ? ` (${sideLabel(1, round.team1Side)})` : ''}
            {round.winningTeam === 1 ? ' — won' : ''}
          </p>
          {team1.length === 0 ? (
            <p className="text-neutral-500">—</p>
          ) : (
            team1.map((d) => <p key={d.userId}>{d.displayName}</p>)
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-500">
            Team 2{round.team1Side ? ` (${sideLabel(2, round.team1Side)})` : ''}
            {round.winningTeam === 2 ? ' — won' : ''}
          </p>
          {team2.length === 0 ? (
            <p className="text-neutral-500">—</p>
          ) : (
            team2.map((d) => <p key={d.userId}>{d.displayName}</p>)
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-neutral-500">Judge</p>
          <p>{round.judge?.displayName ?? '—'}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        {round.hasVideo ? 'Video attached' : 'No video yet'} · {round.hasSpeechDoc ? 'Speech doc attached' : 'No speech doc yet'}
      </p>

      {round.rfd && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700">Reason for decision</summary>
          <p className="mt-1 whitespace-pre-wrap text-neutral-700">{round.rfd}</p>
        </details>
      )}

      <Link href={`/round/${round.id}`} className="mt-2 inline-block text-xs underline">
        View round
      </Link>
    </li>
  )
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; term?: string; video?: string; q?: string }>
}) {
  const { person, term, video, q } = await searchParams
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const { rounds, terms, people } = await getArchive(user.school_id)
  const filtered = shapeArchive(rounds, { person, term, video: video === '1', q })
  const hasActiveFilters = Boolean(person || term || video || q)

  return (
    <>
      <h1 className="text-xl font-semibold">Archive</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Completed rounds, newest first — RFDs, sides, and any linked video or speech docs.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">Person</span>
          <select
            name="person"
            defaultValue={person ?? ''}
            className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">Term</span>
          <select
            name="term"
            defaultValue={term ?? ''}
            className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" name="video" value="1" defaultChecked={video === '1'} />
          <span className="text-xs text-neutral-600">Has video</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">Search RFD</span>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="e.g. topicality"
            className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Filter
        </button>
        {hasActiveFilters && (
          <Link href="/archive" className="text-xs underline">
            Clear filters
          </Link>
        )}
      </form>

      {filtered.length === 0 ? (
        <p className="mt-4 text-neutral-600">
          {rounds.length === 0
            ? 'No completed rounds yet. Finished rounds and their links will show up here.'
            : 'No rounds match those filters.'}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {filtered.map((r) => (
            <ArchiveCard key={r.id} round={r} timeZone={user.school!.timezone} />
          ))}
        </ul>
      )}
    </>
  )
}
