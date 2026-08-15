import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Every Server Component that needs identity uses this rather than reading
// Supabase directly. Throws if there's no session — middleware guarantees
// every route reaching here is already authenticated, so a throw means
// something upstream is broken, not a normal "not signed in" case to handle
// gracefully.
//
// Wrapped in React's cache() so calling it from both the shell layout and a
// page in the same request only hits the database once, not twice.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('getCurrentUser() called without a session')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, school_id, email, full_name, display_name, roles, grad_year, is_active, school:schools(name, slug, timezone)')
    .eq('id', user.id)
    .single()

  // The roster-gating trigger guarantees a profile exists for every
  // auth.users row, so reaching here without one means something was
  // deleted out from under an active session, not a normal failure to
  // handle quietly.
  if (error || !profile) {
    throw new Error(`No profile found for authenticated user ${user.id}: ${error?.message}`)
  }

  return profile
})

export async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
