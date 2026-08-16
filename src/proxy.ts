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
const PUBLIC_PATHS = ['/sign-in', '/auth/callback', '/register']

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
