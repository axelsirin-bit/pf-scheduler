import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refreshes the session on every request and gates every route except
// sign-in, the OAuth callback, and static assets. This is where session
// refresh has to happen — Server Components can't set cookies, so relying
// on them alone would let sessions silently expire mid-render.
//
// Named proxy.ts, not middleware.ts: Next.js 16 renamed Middleware to Proxy
// (same functionality, new convention) — the step file predates that
// rename. middleware.ts still works but logs a deprecation warning; this
// is the current convention instead.
// /admin/setup is deliberately NOT public — proxy.ts only gates on session
// presence, not school status, so the wizard already works correctly for a
// signed-in admin without being listed here. Adding it would let an
// unauthenticated visitor reach it and hit an unhandled exception in
// getCurrentUser() instead of being redirected to sign in.
//
// /api/cron IS deliberately public, for a different reason than /register:
// Vercel's own scheduler calls it with no session cookie at all, only an
// Authorization header — found live, this step's cron route was silently
// redirected to /sign-in by this same gate before its own CRON_SECRET
// check ever ran. Session presence was never the right gate for this path
// anyway; the route's own bearer-token check is the real access control,
// same pattern as /register's service-role-backed action.
const PUBLIC_PATHS = ['/sign-in', '/auth/callback', '/register', '/api/cron', '/privacy', '/terms', '/approve-school']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const signInUrl = new URL('/sign-in', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
