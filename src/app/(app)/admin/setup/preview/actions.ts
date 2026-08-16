'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { upsertSlotsForRange } from '@/lib/db/slots'
import { getSchoolTerms } from '@/lib/db/onboarding'
import { todayInTimezone, addDays } from '@/lib/schedule/week-bounds'

export type ConfirmResult = { ok: true } | { ok: false; error: string }

// The wizard's one real commit: writes real slots (nothing before this
// point ever has — see saveRotation's comment in onboarding.ts) and flips
// schools.status to 'active', which is what stops /admin/setup from being
// the forced landing point. Uses the admin's own session, not the service
// role, same reasoning as regenerateFutureSlots.
export async function confirmSetup(): Promise<ConfirmResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (!user.school) return { ok: false, error: 'No school found.' }

  const supabase = await createClient()
  const today = todayInTimezone(user.school.timezone)

  const terms = await getSchoolTerms(user.school_id)
  if (terms.length === 0) {
    return { ok: false, error: 'Add at least one term before confirming.' }
  }
  const to = terms.reduce((max, t) => (t.endsOn > max ? t.endsOn : max), terms[0].endsOn)

  try {
    await upsertSlotsForRange(user.school_id, today, to, { client: supabase })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not generate slots. Try again.' }
  }

  const { error: statusError } = await supabase.from('schools').update({ status: 'active' }).eq('id', user.school_id)
  if (statusError) {
    return { ok: false, error: 'Slots were generated, but could not mark setup complete. Try again.' }
  }

  revalidatePath('/week')
  revalidatePath('/admin')
  redirect('/')
}

export type PreviewResult = { ok: true; schoolDays: number; slotsGenerated: number } | { ok: false; error: string }

// Read-only — a dry run of the exact same function confirmSetup calls for
// real, so the preview can never drift from what actually gets committed
// (task 3's acceptance criterion is trivially true by construction, not by
// keeping two implementations in sync by hand).
export async function getPreview(): Promise<
  | { ok: true; schoolDays: number; slotsGenerated: number; days: { date: string; slots: { label: string; startsAt: string; endsAt: string }[] }[] }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user.school) return { ok: false, error: 'No school found.' }

  const supabase = await createClient()
  const today = todayInTimezone(user.school.timezone)
  const previewEnd = addDays(today, 13)

  const result = await upsertSlotsForRange(user.school_id, today, previewEnd, { dryRun: true, client: supabase })

  const byDate = new Map<string, { label: string; startsAt: string; endsAt: string }[]>()
  for (const slot of result.slots ?? []) {
    const date = slot.startsAt.slice(0, 10)
    const list = byDate.get(date) ?? []
    list.push({ label: slot.label, startsAt: slot.startsAt, endsAt: slot.endsAt })
    byDate.set(date, list)
  }

  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({ date, slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }))

  return { ok: true, schoolDays: result.schoolDays, slotsGenerated: result.slotsGenerated, days }
}
