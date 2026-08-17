'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { inviteRosterMembers, type RosterInviteOutcome } from '@/lib/db/onboarding'
import type { Database } from '@/lib/db/types'

type AppRole = Database['public']['Enums']['app_role']

export type ActionResult = { ok: true; outcomes: RosterInviteOutcome[] } | { ok: false; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function inviteRoster(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const ageConfirmed = formData.get('ageConfirmed') !== null
  if (!ageConfirmed) {
    return { ok: false, error: 'You must confirm every invitee is 13 or older.' }
  }

  const roles = (['admin', 'judge', 'debater'] as AppRole[]).filter((r) => formData.get(`role-${r}`) !== null)
  if (roles.length === 0) {
    return { ok: false, error: 'Pick at least one role for this batch.' }
  }

  const emailsRaw = (formData.get('emails') as string) ?? ''
  const emails = [...new Set(emailsRaw.split(/[\n,]/).map((e) => e.trim()).filter(Boolean))]
  if (emails.length === 0) {
    return { ok: false, error: 'Paste at least one email address.' }
  }
  const invalid = emails.filter((e) => !EMAIL_PATTERN.test(e))
  if (invalid.length > 0) {
    return { ok: false, error: `Not a valid email: ${invalid.join(', ')}` }
  }

  const outcomes = await inviteRosterMembers(
    user.school_id,
    emails.map((email) => ({ email, roles }))
  )

  revalidatePath('/admin/setup/roster')
  // RosterForm (this action) is reused directly on /admin/roster (step
  // 15) rather than duplicated — revalidate that path too so it reflects
  // an invite sent from there without a manual refresh.
  revalidatePath('/admin/roster')
  revalidatePath('/admin')
  return { ok: true, outcomes }
}
