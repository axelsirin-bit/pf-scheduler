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

    return NextResponse.redirect(origin)
  }

  return NextResponse.redirect(`${origin}/sign-in?error=not-on-roster`)
}
