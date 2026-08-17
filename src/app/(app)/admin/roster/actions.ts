'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateRosterViews() {
  revalidatePath('/admin/roster')
  revalidatePath('/admin/setup/roster')
  revalidatePath('/admin')
}

// Never a delete — "never delete a profile, because deleting it orphans
// completed rounds" (task 2). Deactivating just flips is_active; RLS
// (profiles_update_self_or_admin) already lets an admin update any
// profile at their own school.
export async function deactivateMember(userId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (userId === user.id) return { ok: false, error: "You can't deactivate your own account." }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', userId)
  if (error) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRosterViews()
  return { ok: true }
}

export async function reactivateMember(userId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', userId)
  if (error) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRosterViews()
  return { ok: true }
}

// Unclaimed only — re-fetched fresh, never trusting what the page's copy
// of the list said, same reasoning as every prior step's actions.
export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const { data: invite, error: fetchError } = await supabase
    .from('roster_invites')
    .select('id, claimed_at')
    .eq('id', inviteId)
    .maybeSingle()

  if (fetchError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!invite) return { ok: false, error: "That invite doesn't exist." }
  if (invite.claimed_at) return { ok: false, error: 'This invite has already been claimed — revoking no longer applies.' }

  const { error: deleteError } = await supabase.from('roster_invites').delete().eq('id', inviteId)
  if (deleteError) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRosterViews()
  return { ok: true }
}

// The database enforces the "different admin" rule too
// (roster_invites_approve_check_trigger) — this is the friendlier
// message for the same case, checked before ever reaching that trigger.
export async function approveInvite(inviteId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const { data: invite, error: fetchError } = await supabase
    .from('roster_invites')
    .select('id, needs_approval, approved_by, invited_by')
    .eq('id', inviteId)
    .maybeSingle()

  if (fetchError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!invite) return { ok: false, error: "That invite doesn't exist." }
  if (!invite.needs_approval) return { ok: false, error: "This invite doesn't need approval." }
  if (invite.approved_by) return { ok: false, error: 'Already approved.' }
  if (invite.invited_by === user.id) {
    return { ok: false, error: 'A different admin than the one who created this invite has to approve it.' }
  }

  const { error: updateError } = await supabase.from('roster_invites').update({ approved_by: user.id }).eq('id', inviteId)
  if (updateError) return { ok: false, error: updateError.message || 'Something went wrong. Try again.' }

  revalidateRosterViews()
  return { ok: true }
}
