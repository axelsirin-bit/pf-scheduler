'use client'

import { createClient } from '@/lib/supabase/client'

export function SignInButton() {
  const supabase = createClient()

  async function handleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button
      onClick={handleSignIn}
      className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
    >
      Sign in with Google
    </button>
  )
}
