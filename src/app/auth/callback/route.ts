import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Supabase's own auth server processes the Google OAuth round-trip and
// creates (or rejects) the auth.users row before this route ever runs — by
// the time we see a request here, the roster-gating trigger has already
// decided. A `code` means it succeeded; an `error` means it didn't (almost
// always the trigger rejecting an email that isn't on any roster, since
// this app has no other way to fail here — open sign-up doesn't exist).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=not-on-roster`)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(`${origin}/sign-in?error=not-on-roster`)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Step 15: a deactivated member's profile still exists (never
      // deleted, per task 2), so the OAuth exchange above succeeds even
      // for them — this is the check that actually stops the sign-in
      // from completing. getCurrentUser() has the matching check for a
      // session that was already live when the admin deactivated them.
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).maybeSingle()
      if (profile && !profile.is_active) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/sign-in?error=deactivated`)
      }

      // Once per real sign-in, not once per page view — "last sign-in"
      // per step 15's roster list, not a per-request presence ping.
      // Self-update via RLS (profiles_update_self_or_admin), not the
      // service role; not in the blocked-columns list on
      // profiles_restrict_self_update, so it passes for a non-admin same
      // as an admin. Best-effort: a failure here shouldn't block a real
      // sign-in from completing.
      await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
    }

    return NextResponse.redirect(origin)
  }

  return NextResponse.redirect(`${origin}/sign-in?error=not-on-roster`)
}
