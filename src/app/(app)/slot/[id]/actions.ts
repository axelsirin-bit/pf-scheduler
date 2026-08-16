'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true; roundId?: string } | { ok: false; error: string }

function revalidateRoundViews(slotId: string) {
  revalidatePath(`/slot/${slotId}`)
  revalidatePath('/week')
  revalidatePath('/judging')
  revalidatePath('/my-rounds')
}

// Find-or-create: joins the slot's existing forming round if one exists,
// otherwise starts a fresh one and adds the caller as its first
// participant — task 2 ("start") and task 3 ("join") in the step file are
// the same underlying operation from the database's point of view. Slot
// id, role, and an optional team are the only inputs; the user themselves
// always comes from the session, never a parameter.
//
// Capacity, the one-judge cap, and the same-slot/same-round exclusivity
// rules are enforced by the round_participants triggers (see
// 20260817000000_round_formation.sql), not here — this only adds the
// guards that need fresh data the trigger doesn't have (slot timing) or
// that are cheaper to reject before ever reaching the database (role
// eligibility). "Never trust client timing" applies the same way it did to
// toggleAvailability in step 09: the slot is re-fetched fresh, not taken
// from whatever the client's copy of the grid says.
export async function joinRound(
  slotId: string,
  role: 'debater' | 'judge',
  team?: 1 | 2
): Promise<ActionResult> {
  const user = await getCurrentUser()

  if (role === 'judge' && !user.roles.includes('judge')) {
    return { ok: false, error: 'You need the judge role to join as a judge.' }
  }
  if (role === 'debater' && team !== 1 && team !== 2) {
    return { ok: false, error: 'Choose team 1 or team 2.' }
  }

  const supabase = await createClient()

  const { data: slot, error: slotError } = await supabase
    .from('slots')
    .select('id, school_id, starts_at, is_open')
    .eq('id', slotId)
    .maybeSingle()

  if (slotError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!slot || slot.school_id !== user.school_id) return { ok: false, error: "That slot doesn't exist." }
  if (new Date(slot.starts_at).getTime() < Date.now()) {
    return { ok: false, error: 'This slot has already started.' }
  }
  if (!slot.is_open) return { ok: false, error: "This slot isn't open for signup." }

  const { data: existingRound, error: existingRoundError } = await supabase
    .from('rounds')
    .select('id')
    .eq('slot_id', slotId)
    .eq('status', 'forming')
    .maybeSingle()

  if (existingRoundError) return { ok: false, error: 'Something went wrong. Try again.' }

  let roundId: string
  let createdNewRound = false

  if (existingRound) {
    roundId = existingRound.id
  } else {
    const { data: newRound, error: createError } = await supabase
      .from('rounds')
      .insert({ school_id: user.school_id, slot_id: slotId, created_by: user.id })
      .select('id')
      .single()

    if (createError || !newRound) {
      return { ok: false, error: 'Could not start a round here. Try again.' }
    }
    roundId = newRound.id
    createdNewRound = true
  }

  const { error: participantError } = await supabase.from('round_participants').insert({
    school_id: user.school_id,
    round_id: roundId,
    user_id: user.id,
    role,
    team: role === 'debater' ? team : null,
  })

  if (participantError) {
    // Already in this exact round — the desired end state is already true,
    // so this is a no-op success, not an error (same reasoning as
    // toggleAvailability's 23505 handling in step 09).
    if (participantError.code === '23505') {
      return { ok: true, roundId }
    }

    // The round was just created for this join and the join itself failed
    // (most likely: the caller turned out to already be in another live
    // round on this slot) — don't leave an empty orphaned round behind.
    if (createdNewRound) {
      await supabase.from('rounds').delete().eq('id', roundId)
    }

    return { ok: false, error: participantError.message || 'Could not join this round. Try again.' }
  }

  revalidateRoundViews(slotId)
  return { ok: true, roundId }
}

// Allowed only while the round is still forming — round_participants'
// RLS delete policy already scopes to (self, round is forming), so a
// round that's already confirmed simply deletes zero rows rather than
// erroring; fetching the round first lets this return a clear message
// instead of a silent no-op.
export async function leaveRound(roundId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, slot_id, status')
    .eq('id', roundId)
    .maybeSingle()

  if (roundError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!round) return { ok: false, error: "That round doesn't exist." }
  if (round.status !== 'forming') {
    return { ok: false, error: 'Once confirmed, leaving requires cancelling the round instead.' }
  }

  const { error: deleteError } = await supabase
    .from('round_participants')
    .delete()
    .eq('round_id', roundId)
    .eq('user_id', user.id)

  if (deleteError) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRoundViews(round.slot_id)
  return { ok: true }
}

// Restricted to the round's creator or an admin — narrower than the RLS
// policy itself (any participant), a deliberate app-level tightening.
// Notifying the other participants is step 17's job, not this one.
export async function cancelRound(roundId: string, reason?: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, slot_id, status, created_by')
    .eq('id', roundId)
    .maybeSingle()

  if (roundError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!round) return { ok: false, error: "That round doesn't exist." }

  const isAdmin = user.roles.includes('admin')
  if (!isAdmin && round.created_by !== user.id) {
    return { ok: false, error: 'Only the round creator or an admin can cancel it.' }
  }
  if (round.status === 'cancelled' || round.status === 'completed' || round.status === 'expired') {
    return { ok: false, error: 'This round is already finished.' }
  }

  const { error: updateError } = await supabase
    .from('rounds')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason?.trim() || null })
    .eq('id', roundId)

  if (updateError) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRoundViews(round.slot_id)
  return { ok: true }
}

// Only once confirmed — before that there's nothing to "ready" yet.
// Relies on RLS (rounds_update_participant_or_admin: any participant or
// admin) rather than a narrower app-level check like cancelRound has,
// since any of the five people are equally entitled to pick the room, not
// just whoever happened to complete the round.
export async function setRoundRoom(
  roundId: string,
  roomId: string | null,
  roomFreetext: string | null
): Promise<ActionResult> {
  if (!roomId && !roomFreetext?.trim()) {
    return { ok: false, error: 'Pick a room or type one in.' }
  }

  // No getCurrentUser() call needed here — nothing below reads it. RLS
  // (via the session cookies createClient() already reads) is what
  // actually decides whether this update is allowed.
  const supabase = await createClient()

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, slot_id, status')
    .eq('id', roundId)
    .maybeSingle()

  if (roundError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!round) return { ok: false, error: "That round doesn't exist." }
  if (round.status !== 'confirmed') {
    return { ok: false, error: 'A room can only be set once the round is confirmed.' }
  }

  const { error: updateError, count } = await supabase
    .from('rounds')
    .update({ room_id: roomId, room_freetext: roomFreetext?.trim() || null }, { count: 'exact' })
    .eq('id', roundId)

  if (updateError) return { ok: false, error: "Couldn't set the room. Try again." }
  if (!count) return { ok: false, error: 'Only a participant or admin can set the room.' }

  revalidateRoundViews(round.slot_id)
  return { ok: true }
}
