import { notFound } from 'next/navigation'
import { getSchoolRequestForApproval } from '@/lib/db/school-requests'
import { ApproveSchoolButton } from '@/lib/components/approve-school-button'

// Public, unauthenticated, and deliberately not nested under /admin —
// unlike every real /admin/* page, there is no signed-in admin session to
// check here (this runs before the school it's approving even exists).
// The request id itself, mailed only to the operator, is the only
// credential; see proxy.ts for why this path has to be public and
// src/lib/components/approve-school-button.tsx for why the actual mutation
// waits for a real form submit rather than firing on this page's own GET.
export default async function ApproveSchoolPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const request = await getSchoolRequestForApproval(requestId)

  if (!request) {
    notFound()
  }

  if (request.status !== 'pending') {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-8">
        <h1 className="text-xl font-semibold">Approve school registration</h1>
        <p className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          {request.schoolName} was already reviewed (status: {request.status}). No changes made.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Approve school registration</h1>

      <dl className="flex flex-col gap-2 rounded border border-neutral-200 p-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-neutral-500">School</dt>
          <dd>{request.schoolName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Admin</dt>
          <dd>
            {request.adminName} &lt;{request.adminEmail}&gt;
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500">Tabroom profile</dt>
          <dd>
            <a href={request.tabroomUrl} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">
              {request.tabroomUrl}
            </a>
          </dd>
        </div>
        {request.note && (
          <div>
            <dt className="text-xs font-semibold text-neutral-500">Note</dt>
            <dd className="whitespace-pre-wrap">{request.note}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs text-neutral-600">
        Check the Tabroom profile above is a real coach for this school before approving — this is the actual
        verification step, not the click itself.
      </p>

      <ApproveSchoolButton requestId={requestId} />
    </main>
  )
}
