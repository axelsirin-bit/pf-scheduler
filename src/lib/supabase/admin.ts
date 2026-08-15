import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

// Service role client. Bypasses row level security entirely.
//
// This file must NEVER be imported into a Client Component or any code that
// can run in the browser. It belongs only in server-side route handlers, and
// only where a step file explicitly calls for it.
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase/admin.ts was imported into browser code. This must never happen — it exposes the service role key.'
  )
}

export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
