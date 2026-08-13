import { createBrowserClient } from '@supabase/ssr'

// Client Components. Uses the anon key, which is safe to expose in the
// browser — row level security is what actually protects the data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
