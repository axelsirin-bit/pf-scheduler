'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveEmailPreference(preference: 'all' | 'my_rounds'): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // Self-update via RLS (profiles_update_self_or_admin) — email_preference
  // isn't in profiles_restrict_self_update's blocked-columns list (roles,
  // school_id, is_active), so this passes for anyone updating their own row.
  const { error } = await supabase.from('profiles').update({ email_preference: preference }).eq('id', user.id)
  if (error) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidatePath('/settings')
  return { ok: true }
}
