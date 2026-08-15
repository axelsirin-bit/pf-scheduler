import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/db/types'

// Client Components. Uses the anon key, which is safe to expose in the
// browser — row level security is what actually protects the data.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
