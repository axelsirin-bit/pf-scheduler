import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RequireRole } from '@/lib/components/require-role'
import { getBatch, type DiffEntry } from '@/lib/db/ics-import'
import { createClient } from '@/lib/supabase/server'
import { ApproveRejectForm, OverrideConflictButton } from '@/lib/components/batch-actions'

function sideLabel(side: DiffEntry['before']): string {
  if (!side) return 'nothing on the calendar'
  if (!side.isSchoolDay) return 'no school'
  return side.variantName ? `${side.dayTypeCode ?? '—'} (${side.variantName})` : (side.dayTypeCode ?? '—')
}

function describeEntry(entry: DiffEntry): string {
  const before = sideLabel(entry.before)
  const after = sideLabel(entry.after)

  let base: string
  if (entry.kind === 'added') {
    base = `${entry.date} is added as ${after}.`
  } else if (entry.kind === 'removed') {
    base = `${entry.date} is no longer on the feed, reverting to ${after}.`
  } else {
    base = `${entry.date} changes from ${before} to ${after}.`
  }

  const impacts: string[] = []
  if (entry.openSlotsAffected > 0) impacts.push(`closes ${entry.openSlotsAffected} open slot(s)`)
  if (entry.protectedRounds > 0) impacts.push(`leaves ${entry.protectedRounds} round(s) in progress untouched`)

  return impacts.length > 0 ? `${base} This ${impacts.join(' and ')}.` : base
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending review'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <RequireRole role="admin">
      <p className="text-sm">
        <Link href="/admin/schedule/feed" className="underline">
          ← Calendar feed
        </Link>
      </p>
      <BatchContent id={id} />
    </RequireRole>
  )
}

async function BatchContent({ id }: { id: string }) {
  const supabase = await createClient()
  const batch = await getBatch(id, supabase)
  if (!batch) {
    notFound()
  }

  const applicable = batch.diff.entries.filter((e) => !e.conflictsWithManual)
  const conflicts = batch.diff.entries.filter((e) => e.conflictsWithManual)

  return (
    <>
      <h1 className="mt-2 text-xl font-semibold">Import batch — {new Date(batch.createdAt).toLocaleString()}</h1>
      <p className="mt-1 text-sm font-medium text-neutral-700">{statusLabel(batch.status)}</p>

      {batch.diff.unmappedSummaries.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Unmapped summaries found in this sync</p>
          <p className="mt-1 text-amber-900">
            {batch.diff.unmappedSummaries.join(', ')} — map these on the{' '}
            <Link href="/admin/schedule/feed" className="underline">
              feed page
            </Link>{' '}
            and sync again to apply them.
          </p>
        </div>
      )}

      {batch.diff.entries.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No changes — the calendar already matches the feed.</p>
      ) : (
        <>
          <h2 className="mt-4 text-sm font-semibold text-neutral-900">Changes</h2>
          {applicable.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">
              Every change in this batch conflicts with a manually-set date — see below.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {applicable.map((e) => (
                <li key={e.date} className="rounded border border-neutral-200 p-2">
                  {describeEntry(e)}
                </li>
              ))}
            </ul>
          )}

          {conflicts.length > 0 && (
            <>
              <h2 className="mt-4 text-sm font-semibold text-amber-900">Conflicts with a manually-set date</h2>
              <p className="mt-1 text-xs text-neutral-600">
                These dates were set by hand, so the sync never overwrites them automatically. Apply one only if you
                want the feed to win.
              </p>
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {conflicts.map((e) => (
                  <li key={e.date} className="rounded border border-amber-200 bg-amber-50 p-2">
                    <p>{describeEntry(e)}</p>
                    {batch.status === 'pending' && <OverrideConflictButton batchId={batch.id} date={e.date} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {batch.status === 'pending' && (
        <div className="mt-6">
          <ApproveRejectForm batchId={batch.id} />
        </div>
      )}
    </>
  )
}
