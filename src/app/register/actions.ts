'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { notifySchoolApprovalRequest } from '@/lib/email/notify'

export type SubmitRequestResult = { ok: true } | { ok: false; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\/.+/i

// Public, unauthenticated form — school_requests has no RLS policy for
// anyone but the service role (deliberately, see decisions.md: "a server
// route using the service role rather than a client-side insert policy, to
// avoid exposing an open anonymous-insert policy on a table with no rate
// limiting"). This is that server-side path. No session exists at this
// point, so there's nothing to derive from one — every field comes from the
// form itself, which is normal here, unlike every other action in this
// codebase.
export async function submitSchoolRequest(formData: FormData): Promise<SubmitRequestResult> {
  const schoolName = (formData.get('schoolName') as string)?.trim()
  const adminName = (formData.get('adminName') as string)?.trim()
  const adminEmail = (formData.get('adminEmail') as string)?.trim()
  const tabroomUrl = (formData.get('tabroomUrl') as string)?.trim()
  const note = (formData.get('note') as string)?.trim()

  if (!schoolName || !adminName || !adminEmail || !tabroomUrl) {
    return { ok: false, error: 'Fill in every field except the note.' }
  }
  if (!EMAIL_PATTERN.test(adminEmail)) {
    return { ok: false, error: "That doesn't look like a valid email address." }
  }
  if (!URL_PATTERN.test(tabroomUrl)) {
    return { ok: false, error: 'The Tabroom link needs to be a real URL, starting with https://.' }
  }

  const supabase = createAdminClient()
  const { data: request, error } = await supabase
    .from('school_requests')
    .insert({
      school_name: schoolName,
      admin_name: adminName,
      admin_email: adminEmail,
      tabroom_url: tabroomUrl,
      note: note || null,
    })
    .select('id')
    .single()

  if (error || !request) {
    return { ok: false, error: 'Something went wrong submitting your request. Try again.' }
  }

  // Best-effort, same reasoning as every other notification hook in this
  // codebase — the request is already recorded regardless of whether this
  // email goes through, and it's still visible directly in school_requests
  // if it needs a manual nudge.
  try {
    await notifySchoolApprovalRequest({
      schoolName,
      adminName,
      adminEmail,
      tabroomUrl,
      note: note || null,
      requestId: request.id,
    })
  } catch (err) {
    console.error('Could not send the school-approval-request email:', err)
  }

  return { ok: true }
}
