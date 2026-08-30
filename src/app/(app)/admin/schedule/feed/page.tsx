import Link from 'next/link'
import { RequireRole } from '@/lib/components/require-role'
import { getCurrentUser } from '@/lib/auth'
import { getIcsSource, getRecentBatches } from '@/lib/db/ics-import'
import { getDayTypes, getScheduleVariants } from '@/lib/db/onboarding'
import { FeedManager } from '@/lib/components/feed-manager'

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

export default function AdminScheduleFeedPage() {
  return (
    <RequireRole role="admin">
      <h1 className="text-xl font-semibold">Calendar feed</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Link your school&apos;s ICS calendar feed. The feed supplies the calendar; the period templates from setup
        supply the times — this page connects the two.
      </p>
      <FeedContent />
    </RequireRole>
  )
}

async function FeedContent() {
  const user = await getCurrentUser()
  const [source, dayTypes, variants] = await Promise.all([
    getIcsSource(user.school_id),
    getDayTypes(user.school_id),
    getScheduleVariants(user.school_id),
  ])
  const batches = source ? await getRecentBatches(user.school_id) : []

  return (
    <>
      {source && (
        <p className="mt-3 text-sm text-neutral-600">
          {source.lastStatus === 'failed' ? (
            <>
              {source.lastSyncedAt
                ? `Last successful sync: ${new Date(source.lastSyncedAt).toLocaleString()}. `
                : 'No sync has ever succeeded. '}
              The calendar shown is unchanged since then — the most recent attempt failed
              {source.lastError ? `: ${source.lastError}` : '.'}
            </>
          ) : source.lastSyncedAt ? (
            `Last synced ${new Date(source.lastSyncedAt).toLocaleString()} — succeeded.`
          ) : (
            'Never synced yet.'
          )}
        </p>
      )}

      <div className="mt-4">
        <FeedManager
          sourceId={source?.id ?? null}
          initialUrl={source?.url ?? ''}
          existingMapping={source?.summaryMapping ?? {}}
          dayTypeCodes={dayTypes.map((d) => d.code)}
          variants={variants}
        />
      </div>

      {batches.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-900">Recent syncs</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 border-b border-neutral-100 py-1">
                <Link href={`/admin/schedule/feed/batches/${b.id}`} className="underline">
                  {new Date(b.createdAt).toLocaleString()}
                </Link>
                <span className="text-neutral-600">
                  {statusLabel(b.status)} · {b.entryCount} change(s)
                  {b.conflictCount > 0 ? `, ${b.conflictCount} conflict(s)` : ''}
                  {b.unmappedCount > 0 ? `, ${b.unmappedCount} unmapped summary/summaries` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
