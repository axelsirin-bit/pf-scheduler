import { createAdminClient } from '../supabase/admin.ts'
import { notifySchoolApproved } from '../email/notify.ts'

type AdminClient = ReturnType<typeof createAdminClient>

// Deliberately not in onboarding.ts alongside the wizard's own read/writes:
// that file's own header states its invariant plainly — "every write in
// this file goes through the regular RLS-respecting client, never the
// service role" — because the wizard is always a signed-in admin acting on
// their own already-existing school. Nothing here has a session at all; the
// admin invite this creates doesn't exist as a real account yet. Same
// reasoning /register's action and the original approve-school-request.ts
// script already followed — this just gives both entry points one shared
// implementation instead of two copies of the same five steps.

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'school'
}

// Collisions are expected to be rare — "a few schools in year one" per
// decisions.md — so a small bounded retry loop is simpler than reserving
// names up front, and correct regardless of how rare or common they turn
// out to be.
async function uniqueSlug(admin: AdminClient, base: string): Promise<string> {
  let candidate = base
  let suffix = 2
  for (;;) {
    const { data } = await admin.from('schools').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export type SchoolRequestForApproval = {
  id: string
  schoolName: string
  adminName: string
  adminEmail: string
  tabroomUrl: string
  note: string | null
  status: string
}

// Read-only, for the /approve-school/[requestId] page to render before
// anyone's clicked anything — same admin-client reasoning as the rest of
// this file, no session exists yet.
export async function getSchoolRequestForApproval(requestId: string): Promise<SchoolRequestForApproval | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('school_requests')
    .select('id, school_name, admin_name, admin_email, tabroom_url, note, status')
    .eq('id', requestId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    schoolName: data.school_name,
    adminName: data.admin_name,
    adminEmail: data.admin_email,
    tabroomUrl: data.tabroom_url,
    note: data.note,
    status: data.status,
  }
}

export type ApproveSchoolRequestResult =
  | { ok: true; alreadyReviewed: false; school: { id: string; name: string; slug: string }; emailSent: boolean }
  | { ok: true; alreadyReviewed: true; status: string }
  | { ok: false; error: string }

// Creates the school and its first admin invite, emails that admin a
// sign-in link (best-effort — see notifySchoolApproved's own comment on
// why this can't fail the school's creation), then marks the request
// reviewed. Safe to call more than once for the same request id — a
// request already past 'pending' returns alreadyReviewed rather than
// creating a second school, the same guard the original CLI-only version
// of this logic already had, now reusable from a route that a person
// could plausibly open twice (a re-click, a refreshed page).
//
// `status` is left at its schema default ('pending') on purpose, not set
// to 'active' here — onboarding.ts's own admin-overview checklist
// (`school?.status === 'active'`) treats 'active' as "the setup wizard has
// actually been completed," flipped by the wizard's own confirm step
// (step 12), not by approval. Setting it here would make that checklist
// falsely report a brand-new, unconfigured school as fully set up.
//
// `slug` defaults to a slugified school name with collision handling, for
// the one-click email-link path where nobody is present to type one in;
// an explicit override is still honored for the CLI script's existing
// "human picks a slug" flow.
export async function approveSchoolRequest(
  requestId: string,
  reviewedBy: string,
  options: { slug?: string } = {}
): Promise<ApproveSchoolRequestResult> {
  const admin = createAdminClient()

  const { data: request, error: requestError } = await admin
    .from('school_requests')
    .select('id, school_name, admin_name, admin_email, status')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) return { ok: false, error: requestError.message }
  if (!request) return { ok: false, error: 'not_found' }
  if (request.status !== 'pending') return { ok: true, alreadyReviewed: true, status: request.status }

  const slug = options.slug ?? (await uniqueSlug(admin, slugify(request.school_name)))

  const { data: school, error: schoolError } = await admin
    .from('schools')
    .insert({ name: request.school_name, slug })
    .select('id, name, slug')
    .single()

  if (schoolError || !school) {
    return { ok: false, error: `Could not create school: ${schoolError?.message ?? 'unknown error'}` }
  }

  const { error: inviteError } = await admin.from('roster_invites').insert({
    school_id: school.id,
    email: request.admin_email,
    roles: ['admin'],
    age_confirmed: true,
  })

  if (inviteError) {
    return { ok: false, error: `Could not create the first admin invite: ${inviteError.message}` }
  }

  let emailSent = false
  try {
    const result = await notifySchoolApproved({
      requestId: request.id,
      schoolId: school.id,
      schoolName: request.school_name,
      adminName: request.admin_name,
      adminEmail: request.admin_email,
    })
    emailSent = result.sent
  } catch {
    // Best-effort, matches every other notification hook in this
    // codebase — the school and invite already exist regardless.
  }

  const { error: updateError } = await admin
    .from('school_requests')
    .update({ status: 'approved', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)

  if (updateError) {
    return {
      ok: false,
      error: `School and invite were created, but the request could not be marked reviewed: ${updateError.message}`,
    }
  }

  return { ok: true, alreadyReviewed: false, school, emailSent }
}
