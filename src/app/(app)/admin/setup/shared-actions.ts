'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { upsertSlotsForRange } from '@/lib/db/slots'
import { getSchoolTerms } from '@/lib/db/onboarding'
import { todayInTimezone, addDays } from '@/lib/schedule/week-bounds'

export type RegenerateResult =
  | { ok: true; created: number; updated: number; skipped: number }
  | { ok: false; error: string }

// Task 4: "changing a template or the rotation regenerates future slots
// only." Shared by the templates and rotation steps, since both can leave
// slots stale — the templates page calls this after editing a block, and
// the rotation page after saving new calendar_days. Uses the admin's own
// RLS-respecting session, not the service role (see the comment on
// upsertSlotsForRange in slots.ts) — clamps its start date to today so a
// past slot is never even in the write set, and upsertSlotsForRange itself
// skips any slot with a live round attached regardless.
export async function regenerateFutureSlots(): Promise<RegenerateResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (!user.school) return { ok: false, error: 'No school found.' }

  const supabase = await createClient()
  const today = todayInTimezone(user.school.timezone)

  const terms = await getSchoolTerms(user.school_id)
  const to = terms.length > 0 ? terms.reduce((max, t) => (t.endsOn > max ? t.endsOn : max), terms[0].endsOn) : addDays(today, 90)

  try {
    const result = await upsertSlotsForRange(user.school_id, today, to, { client: supabase })
    revalidatePath('/week')
    revalidatePath('/admin')
    return { ok: true, created: result.created, updated: result.updated, skipped: result.skipped }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not regenerate. Try again.' }
  }
}
