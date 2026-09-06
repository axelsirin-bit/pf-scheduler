'use server'

import { approveSchoolRequest } from '@/lib/db/school-requests'
import { OPERATOR_EMAIL } from '@/lib/email/notify'

export type ApproveActionResult =
  | { ok: true; alreadyReviewed: false; schoolName: string; slug: string; emailSent: boolean }
  | { ok: true; alreadyReviewed: true; status: string }
  | { ok: false; error: string }

// The only person who can reach this route in practice is whoever holds
// the email it was sent to — see notify.ts's OPERATOR_EMAIL comment on why
// that's a hardcoded single address for now, not a real "who approved
// this" identity the way an admin session would give one.
export async function approveSchoolRequestAction(requestId: string): Promise<ApproveActionResult> {
  const result = await approveSchoolRequest(requestId, OPERATOR_EMAIL)

  if (!result.ok) return result
  if (result.alreadyReviewed) return result

  return {
    ok: true,
    alreadyReviewed: false,
    schoolName: result.school.name,
    slug: result.school.slug,
    emailSent: result.emailSent,
  }
}
