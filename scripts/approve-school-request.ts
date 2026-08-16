// One-off, run by hand by whoever is monitoring school_requests (there's no
// "platform operator" role in app_role yet — decisions.md flags this as
// undecided, so approval stays a script rather than a UI gated behind a
// role that doesn't exist). Creates the school (status = 'pending', so
// /admin/setup shows for its first admin) and that admin's roster_invites
// row, then stamps the request as reviewed. Emailing the admin is step 17's
// job, not this script's — same deferral as every other notification in
// this build so far.
//
// Usage: node --env-file=.env.local scripts/approve-school-request.ts <requestId> <slug> <reviewedBy>

import { createAdminClient } from '../src/lib/supabase/admin.ts'

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

  const supabase = createAdminClient()

  const { data: request, error: requestError } = await supabase
    .from('school_requests')
    .select('id, school_name, admin_name, admin_email, status')
    .eq('id', requestId)
    .single()

  if (requestError || !request) {
    throw new Error(`Could not find request ${requestId}: ${requestError?.message}`)
  }
  if (request.status !== 'pending') {
    throw new Error(`Request ${requestId} is already "${request.status}", not pending.`)
  }

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .insert({ name: request.school_name, slug })
    .select('id')
    .single()

  if (schoolError || !school) {
    throw new Error(`Could not create school: ${schoolError?.message}`)
  }

  const { error: inviteError } = await supabase.from('roster_invites').insert({
    school_id: school.id,
    email: request.admin_email,
    roles: ['admin'],
    age_confirmed: true,
  })

  if (inviteError) {
    throw new Error(`Could not create the first admin invite: ${inviteError.message}`)
  }

  const { error: updateError } = await supabase
    .from('school_requests')
    .update({ status: 'approved', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) {
    throw new Error(`Could not mark the request reviewed: ${updateError.message}`)
  }

  console.log(
    `Approved. School "${request.school_name}" created (${school.id}, slug "${slug}"). ` +
      `${request.admin_name} <${request.admin_email}> can now sign in with Google and will land on the setup wizard.`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
