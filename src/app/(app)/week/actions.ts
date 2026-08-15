'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ToggleAvailabilityResult = { ok: true; isAvailable: boolean } | { ok: false; error: string }

// Takes only a slot id, never a desired state — it reads what's actually in
// the database and flips it, so it can't be told to set availability for
// someone else or to a value that's already stale by the time it runs. The
// user themselves is derived from the session, never accepted as a
// parameter, for the same reason.
export async function toggleAvailability(slotId: string): Promise<ToggleAvailabilityResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // Re-fetch the slot fresh rather than trusting whatever the client's copy
  // of the grid says — that copy could be minutes old by the time a click
  // lands.
  const { data: slot, error: slotError } = await supabase
    .from('slots')
    .select('id, school_id, starts_at, is_open')
    .eq('id', slotId)
    .maybeSingle()

  if (slotError) {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
  if (!slot || slot.school_id !== user.school_id) {
    return { ok: false, error: "That slot doesn't exist." }
  }
  if (new Date(slot.starts_at).getTime() < Date.now()) {
    return { ok: false, error: 'This slot has already started.' }
  }
  if (!slot.is_open) {
    return { ok: false, error: "This slot isn't open for signup." }
  }

  const { data: existing, error: existingError } = await supabase
    .from('availabilities')
    .select('id')
    .eq('slot_id', slotId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }

  if (existing) {
    return unmark(supabase, user, slotId)
  }
  return mark(supabase, user, slotId)
}

type Supabase = Awaited<ReturnType<typeof createClient>>
type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>

async function mark(supabase: Supabase, user: CurrentUser, slotId: string): Promise<ToggleAvailabilityResult> {
  const { error } = await supabase
    .from('availabilities')
    .insert({ school_id: user.school_id, slot_id: slotId, user_id: user.id })

  // 23505 = unique_violation on (slot_id, user_id) — a race with another
  // request that inserted the same row a moment ago. The end state (marked
  // available) is exactly what this call wanted anyway, so it's a no-op
  // success, not an error to surface.
  if (error && error.code !== '23505') {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }

  revalidatePath('/week')
  revalidatePath('/my-rounds')
  return { ok: true, isAvailable: true }
}

async function unmark(supabase: Supabase, user: CurrentUser, slotId: string): Promise<ToggleAvailabilityResult> {
  // Not enforced by RLS — availabilities has no idea about round_participants
  // — so this is the one guard that has to live here rather than in a
  // policy. Blocks removal only for a *confirmed* round; a forming round's
  // participant can still uncheck.
  const { data: confirmedRound, error: confirmedError } = await supabase
    .from('rounds')
    .select('id, round_participants!inner(user_id)')
    .eq('school_id', user.school_id)
    .eq('slot_id', slotId)
    .eq('status', 'confirmed')
    .eq('round_participants.user_id', user.id)
    .maybeSingle()

  if (confirmedError) {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
  if (confirmedRound) {
    return { ok: false, error: "You're confirmed for a round in this slot — leave the round first." }
  }

  const { error } = await supabase.from('availabilities').delete().eq('slot_id', slotId).eq('user_id', user.id)

  if (error) {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }

  revalidatePath('/week')
  revalidatePath('/my-rounds')
  return { ok: true, isAvailable: false }
}
