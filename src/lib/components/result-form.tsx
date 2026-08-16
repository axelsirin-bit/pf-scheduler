'use client'

import { useActionState, useState } from 'react'
import { submitResult, submitCorrection } from '@/app/(app)/round/[id]/result/actions'
import type { SubmitResultResult } from '@/lib/db/results'

const RFD_MIN_LENGTH = 150

type Debater = { userId: string; displayName: string; team: 1 | 2 }

export function ResultForm({
  roundId,
  debaters,
  mode,
  supersedesResultId,
}: {
  roundId: string
  debaters: Debater[]
  mode: 'submit' | 'correct'
  supersedesResultId?: string
}) {
  const [rfdLength, setRfdLength] = useState(0)
  const [state, formAction, isPending] = useActionState(async (_prev: SubmitResultResult | null, formData: FormData) => {
    const winningTeam = Number(formData.get('winningTeam')) as 1 | 2
    const team1Side = formData.get('team1Side') as 'pro' | 'con'
    const rfd = (formData.get('rfd') as string) ?? ''
    const notes = debaters.map((d) => ({
      aboutUserId: d.userId,
      note: (formData.get(`note-${d.userId}`) as string) ?? '',
    }))

    if (mode === 'correct') {
      if (!supersedesResultId) return { ok: false, error: 'Missing the result being corrected.' } as const
      return submitCorrection(roundId, supersedesResultId, { winningTeam, team1Side, rfd, notes })
    }
    return submitResult(roundId, { winningTeam, team1Side, rfd, notes })
  }, null)

  const team1 = debaters.filter((d) => d.team === 1)
  const team2 = debaters.filter((d) => d.team === 2)

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-4 rounded border border-neutral-200 p-3 text-sm">
      {mode === 'correct' && (
        <p className="text-xs text-neutral-600">
          This replaces the current result. The original stays visible, linked from this one.
        </p>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-neutral-900">Winning team</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="winningTeam" value="1" defaultChecked required />
          <span>Team 1{team1.length > 0 ? ` (${team1.map((d) => d.displayName).join(', ')})` : ''}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="winningTeam" value="2" required />
          <span>Team 2{team2.length > 0 ? ` (${team2.map((d) => d.displayName).join(', ')})` : ''}</span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-neutral-900">Team 1&apos;s side</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="team1Side" value="pro" defaultChecked required />
          <span>Pro (team 2 was Con)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="team1Side" value="con" required />
          <span>Con (team 2 was Pro)</span>
        </label>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-neutral-900">Reason for decision</span>
        <textarea
          name="rfd"
          required
          rows={6}
          onChange={(e) => setRfdLength(e.target.value.trim().length)}
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <span className={rfdLength < RFD_MIN_LENGTH ? 'text-xs text-neutral-500' : 'text-xs text-green-700'}>
          {rfdLength} / {RFD_MIN_LENGTH} characters minimum
        </span>
      </label>

      {debaters.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium text-neutral-900">Private notes (optional)</legend>
          <p className="text-xs text-neutral-600">Visible only to that debater and to admins.</p>
          {debaters.map((d) => (
            <label key={d.userId} className="flex flex-col gap-1">
              <span>{d.displayName}</span>
              <input
                type="text"
                name={`note-${d.userId}`}
                className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </label>
          ))}
        </fieldset>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Submitting…' : mode === 'correct' ? 'Submit correction' : 'Submit result'}
      </button>

      {state && !state.ok && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state && state.ok && state.notesWarning && (
        <p role="alert" className="text-xs text-amber-700">
          {state.notesWarning}
        </p>
      )}
    </form>
  )
}
