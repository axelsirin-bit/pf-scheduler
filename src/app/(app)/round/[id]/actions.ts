'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

export type LinkKind = 'video' | 'speech_doc' | 'flow' | 'other'

// The database enforces this too (round_links' own check constraint,
// Google Drive/Docs domains only) — this is just a friendlier message
// than a raw constraint-violation error, same reasoning as
// submitRoundResult's RFD-length check in step 11.
const GOOGLE_URL_PATTERN = /^https:\/\/(drive|docs)\.google\.com\//i

export async function addRoundLink(
  roundId: string,
  input: { kind: LinkKind; url: string; label?: string }
): Promise<ActionResult> {
  const url = input.url.trim()
  if (!GOOGLE_URL_PATTERN.test(url)) {
    return {
      ok: false,
      error: 'Only Google Drive or Google Docs links are accepted (https://drive.google.com/... or https://docs.google.com/...).',
    }
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  // Re-fetch fresh rather than trusting the page the form was rendered
  // on — same reasoning as toggleAvailability (step 09) and joinRound
  // (step 10). The status check here is a friendly message; the real
  // enforcement is the round_links insert policy's own "round must be
  // completed" clause (this migration's whole point).
  const { data: round, error: roundError } = await supabase.from('rounds').select('id, status').eq('id', roundId).maybeSingle()

  if (roundError) return { ok: false, error: 'Something went wrong. Try again.' }
  if (!round) return { ok: false, error: "That round doesn't exist." }
  if (round.status !== 'completed') {
    return { ok: false, error: 'Links can only be added to a completed round.' }
  }

  const { error: insertError } = await supabase.from('round_links').insert({
    school_id: user.school_id,
    round_id: roundId,
    kind: input.kind,
    url,
    label: input.label?.trim() || null,
    added_by: user.id,
  })

  if (insertError) {
    return { ok: false, error: insertError.message || 'Could not save the link. Try again.' }
  }

  revalidatePath(`/round/${roundId}`)
  revalidatePath('/archive')

  return { ok: true }
}
