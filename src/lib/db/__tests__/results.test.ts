import { describe, expect, it } from 'vitest'
import { shapePostRoundForm, shapeResultsNeeded, type RawPostRoundRound } from '../results'

const NOW = new Date('2026-09-16T12:00:00.000Z')

function baseRound(overrides: Partial<RawPostRoundRound> = {}): RawPostRoundRound {
  return {
    id: 'round-1',
    status: 'confirmed',
    slot_id: 'slot-1',
    slots: { id: 'slot-1', label: 'Morning Block', starts_at: '2026-09-14T12:00:00.000Z', ends_at: '2026-09-14T13:00:00.000Z' },
    round_participants: [
      { user_id: 'd1', role: 'debater', team: 1, profiles: { display_name: 'D One' } },
      { user_id: 'd2', role: 'debater', team: 1, profiles: { display_name: 'D Two' } },
      { user_id: 'd3', role: 'debater', team: 2, profiles: { display_name: 'D Three' } },
      { user_id: 'd4', role: 'debater', team: 2, profiles: { display_name: 'D Four' } },
      { user_id: 'j1', role: 'judge', team: null, profiles: { display_name: 'J One' } },
    ],
    round_results: [],
    ...overrides,
  }
}

function result(overrides: Partial<RawPostRoundRound['round_results'][number]> = {}) {
  return {
    id: 'result-1',
    winning_team: 1,
    team1_side: 'pro',
    rfd: 'x'.repeat(150),
    submitted_by: 'j1',
    submitted_at: '2026-09-14T14:00:00.000Z',
    supersedes: null,
    round_notes: [],
    ...overrides,
  }
}

describe('shapePostRoundForm', () => {
  it('returns null when the slot is missing (defensive)', () => {
    expect(shapePostRoundForm(baseRound({ slots: null }), 'j1', ['judge'], NOW)).toBeNull()
  })

  it('lists debaters by team and the judge, and reports isSlotStarted', () => {
    const form = shapePostRoundForm(baseRound(), 'j1', ['judge'], NOW)!
    expect(form.judgeUserId).toBe('j1')
    expect(form.debaters).toHaveLength(4)
    expect(form.debaters.filter((d) => d.team === 1).map((d) => d.displayName)).toEqual(['D One', 'D Two'])
    expect(form.isSlotStarted).toBe(true)
  })

  it('reports isSlotStarted false for a future slot', () => {
    const round = baseRound({
      slots: { id: 'slot-1', label: 'Morning Block', starts_at: '2026-09-20T12:00:00.000Z', ends_at: '2026-09-20T13:00:00.000Z' },
    })
    expect(shapePostRoundForm(round, 'j1', ['judge'], NOW)!.isSlotStarted).toBe(false)
  })

  it('has no current result when nothing has been submitted', () => {
    const form = shapePostRoundForm(baseRound(), 'j1', ['judge'], NOW)!
    expect(form.currentResult).toBeNull()
    expect(form.priorResults).toEqual([])
  })

  it('treats a single submitted result as the current one', () => {
    const round = baseRound({ round_results: [result()] })
    const form = shapePostRoundForm(round, 'j1', ['judge'], NOW)!
    expect(form.currentResult?.id).toBe('result-1')
    expect(form.priorResults).toEqual([])
  })

  it('moves a corrected result to prior and makes the correction current', () => {
    const original = result({ id: 'result-1', submitted_at: '2026-09-14T14:00:00.000Z' })
    const correction = result({
      id: 'result-2',
      supersedes: 'result-1',
      submitted_at: '2026-09-15T09:00:00.000Z',
      winning_team: 2,
    })
    const round = baseRound({ round_results: [original, correction] })
    const form = shapePostRoundForm(round, 'j1', ['judge'], NOW)!

    expect(form.currentResult?.id).toBe('result-2')
    expect(form.currentResult?.winningTeam).toBe(2)
    expect(form.priorResults.map((r) => r.id)).toEqual(['result-1'])
  })

  it("strips a note to everyone except the debater it's about, whoever wrote it, or an admin", () => {
    const round = baseRound({
      round_results: [
        result({
          round_notes: [
            { about_user: 'd1', note: 'Great cross-ex.' },
            { about_user: 'd2', note: 'Work on flowing.' },
          ],
        }),
      ],
    })

    const asAboutD1 = shapePostRoundForm(round, 'd1', ['debater'], NOW)!
    expect(asAboutD1.currentResult?.notes).toEqual([{ aboutUserId: 'd1', note: 'Great cross-ex.' }])

    const asOtherDebater = shapePostRoundForm(round, 'd3', ['debater'], NOW)!
    expect(asOtherDebater.currentResult?.notes).toEqual([])

    const asJudgeWhoWroteIt = shapePostRoundForm(round, 'j1', ['judge'], NOW)!
    expect(asJudgeWhoWroteIt.currentResult?.notes).toHaveLength(2)

    const asAdmin = shapePostRoundForm(round, 'admin-1', ['admin'], NOW)!
    expect(asAdmin.currentResult?.notes).toHaveLength(2)
  })

  it('never includes a note about someone else even in the payload for a stripped viewer', () => {
    const round = baseRound({
      round_results: [result({ round_notes: [{ about_user: 'd2', note: 'Secret debater feedback' }] })],
    })
    const form = shapePostRoundForm(round, 'd1', ['debater'], NOW)!
    expect(JSON.stringify(form)).not.toContain('Secret debater feedback')
  })
})

describe('shapeResultsNeeded', () => {
  function round(overrides: Partial<Parameters<typeof shapeResultsNeeded>[0][number]> = {}) {
    return {
      id: 'round-1',
      status: 'confirmed',
      slots: { id: 'slot-1', label: 'Morning Block', starts_at: '2026-09-14T12:00:00.000Z', ends_at: '2026-09-14T13:00:00.000Z' },
      round_participants: [{ user_id: 'judge-1', role: 'judge' }],
      round_results: [],
      ...overrides,
    }
  }

  it("includes a round whose slot has ended and has no result, for its judge", () => {
    const result = shapeResultsNeeded([round()], 'judge-1', NOW)
    expect(result).toHaveLength(1)
    expect(result[0].roundId).toBe('round-1')
  })

  it("excludes a round whose slot hasn't ended yet", () => {
    const future = round({ slots: { id: 's', label: 'Future', starts_at: '2026-09-20T12:00:00.000Z', ends_at: '2026-09-20T13:00:00.000Z' } })
    expect(shapeResultsNeeded([future], 'judge-1', NOW)).toEqual([])
  })

  it('excludes a round that already has a result', () => {
    const withResult = round({ round_results: [{ id: 'result-1' }] })
    expect(shapeResultsNeeded([withResult], 'judge-1', NOW)).toEqual([])
  })

  it("excludes a round where the viewer isn't the judge", () => {
    expect(shapeResultsNeeded([round()], 'someone-else', NOW)).toEqual([])
  })

  it('sorts by slot start time, soonest first', () => {
    const later = round({
      id: 'later',
      slots: { id: 's2', label: 'Later', starts_at: '2026-09-15T12:00:00.000Z', ends_at: '2026-09-15T13:00:00.000Z' },
    })
    const sooner = round({
      id: 'sooner',
      slots: { id: 's1', label: 'Sooner', starts_at: '2026-09-14T12:00:00.000Z', ends_at: '2026-09-14T13:00:00.000Z' },
    })
    const result = shapeResultsNeeded([later, sooner], 'judge-1', NOW)
    expect(result.map((r) => r.roundId)).toEqual(['sooner', 'later'])
  })
})
