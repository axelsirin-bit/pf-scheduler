'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ResultFormInput, SubmitResultResult } from '@/lib/db/results'

// Shared by both exported actions below — original submission (supersedes
// null) and a correction (supersedes an existing result) differ only in
// who's allowed to submit and what supersedes gets set to; everything else
// is identical.
async function submitRoundResult(
  roundId: string,
  supersedes: string | null,
  input: ResultFormInput
): Promise<SubmitResultResult> {
  // The database enforces the real 150-character minimum regardless
  // (round_results.rfd's check constraint) — this is just a friendlier
  // message than a raw constraint-violation error.
  if (input.rfd.trim().length < 150) {
    return { ok: false, error: 'The reason for decision needs to be at least 150 characters.' }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  // Re-fetch fresh — never trust client timing or a stale copy of the
  // roster, same reasoning as toggleAvailability (step 09) and joinRound
  // (step 10).
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, slot_id, status, slots ( starts_at ), round_participants ( user_id, role )')
    .eq('id', roundId)
    .maybeSingle()

  if (roundError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!round) return { ok: false, error: "That round doesn't exist." }

  const isJudge = round.round_participants.some((p) => p.user_id === user.id && p.role === 'judge')
  const isAdmin = user.roles.includes('admin')

  if (supersedes === null) {
    if (!isJudge) return { ok: false, error: 'Only the judge for this round can submit a result.' }
  } else if (!isJudge && !isAdmin) {
    return { ok: false, error: 'Only the judge or an admin can submit a correction.' }
  }

  if (!round.slots || new Date(round.slots.starts_at).getTime() > Date.now()) {
    return { ok: false, error: "This slot hasn't started yet." }
  }

  const validAboutUsers = new Set(
    round.round_participants.filter((p) => p.role === 'debater').map((p) => p.user_id)
  )
  for (const note of input.notes) {
    if (note.note.trim() && !validAboutUsers.has(note.aboutUserId)) {
      return { ok: false, error: 'Notes can only be added for debaters in this round.' }
    }
  }

  const { data: insertedResult, error: insertError } = await supabase
    .from('round_results')
    .insert({
      school_id: user.school_id,
      round_id: roundId,
      submitted_by: user.id,
      winning_team: input.winningTeam,
      team1_side: input.team1Side,
      rfd: input.rfd.trim(),
      supersedes,
    })
    .select('id')
    .single()

  if (insertError || !insertedResult) {
    return { ok: false, error: insertError?.message || 'Could not submit the result. Try again.' }
  }

  const notesToInsert = input.notes
    .filter((n) => n.note.trim())
    .map((n) => ({
      school_id: user.school_id,
      result_id: insertedResult.id,
      about_user: n.aboutUserId,
      note: n.note.trim(),
    }))

  let notesWarning: string | undefined
  if (notesToInsert.length > 0) {
    const { error: notesError } = await supabase.from('round_notes').insert(notesToInsert)
    // The result itself is already recorded and irreversible — a notes
    // failure is a secondary, recoverable problem, not a reason to imply
    // the whole submission failed.
    if (notesError) {
      notesWarning = "The result was recorded, but the per-debater notes couldn't be saved."
    }
  }

  revalidatePath(`/round/${roundId}/result`)
  revalidatePath(`/slot/${round.slot_id}`)
  revalidatePath('/judging')

  return { ok: true, resultId: insertedResult.id, notesWarning }
}

export async function submitResult(roundId: string, input: ResultFormInput): Promise<SubmitResultResult> {
  return submitRoundResult(roundId, null, input)
}

export async function submitCorrection(
  roundId: string,
  supersedesResultId: string,
  input: ResultFormInput
): Promise<SubmitResultResult> {
  return submitRoundResult(roundId, supersedesResultId, input)
}
