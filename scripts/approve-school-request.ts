// A fallback path for approving a school_requests row by hand — the
// primary path is now the one-click link sent to the operator's email
// (src/app/approve-school/[requestId], wired up when the approval flow
// moved off this script). Useful when that email didn't arrive, got
// mangled, or a specific slug needs to be chosen rather than the
// auto-generated one. Shares its actual logic with the email-link route
// via src/lib/db/school-requests.ts's approveSchoolRequest — this script
// is now just that function plus argument parsing, not a second copy of
// what it does.
//
// Usage: node --env-file=.env.local scripts/approve-school-request.ts <requestId> <slug> <reviewedBy>

import { approveSchoolRequest } from '../src/lib/db/school-requests.ts'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

async function main() {
  const [requestId, slug, reviewedBy] = process.argv.slice(2)

  if (!requestId || !slug || !reviewedBy) {
    console.error('Usage: node --env-file=.env.local scripts/approve-school-request.ts <requestId> <slug> <reviewedBy>')
    process.exit(1)
  }
  if (!SLUG_PATTERN.test(slug)) {
    console.error(`Slug "${slug}" must be lowercase letters, numbers, and hyphens only.`)
    process.exit(1)
  }

  const result = await approveSchoolRequest(requestId, reviewedBy, { slug })

  if (!result.ok) {
    throw new Error(result.error)
  }
  if (result.alreadyReviewed) {
    console.log(`Request ${requestId} was already reviewed (status: "${result.status}"). No changes made.`)
    return
  }

  console.log(
    `Approved. School "${result.school.name}" created (${result.school.id}, slug "${result.school.slug}"). ` +
      (result.emailSent
        ? 'Approval email sent.'
        : 'Approval email was not sent — check the console output above for a warning.')
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
