import { describe, expect, it } from 'vitest'
import { shapeRoundsSummary } from '../admin'

const TZ = 'America/New_York'
const TERM = { startsOn: '2026-08-24', endsOn: '2026-12-18' }
const WEEK_START = '2026-09-07'
const WEEK_END = '2026-09-14'
const NOW = new Date('2026-09-10T20:00:00Z')

function round(overrides: {
  id?: string
  status?: string
  startsAt?: string
  endsAt?: string
} = {}) {
  return {
    id: overrides.id ?? 'r1',
    status: overrides.status ?? 'completed',
    slots: { label: 'P3', starts_at: overrides.startsAt ?? '2026-09-08T17:00:00Z', ends_at: overrides.endsAt ?? '2026-09-08T18:00:00Z' },
  }
}

describe('shapeRoundsSummary', () => {
  it('counts completed rounds within the given week', () => {
    const rounds = [
      round({ id: 'in-week', status: 'completed', startsAt: '2026-09-08T17:00:00Z' }),
      round({ id: 'out-of-week', status: 'completed', startsAt: '2026-09-20T17:00:00Z' }),
    ]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.completedThisWeek).toBe(1)
  })

  it('counts completed rounds within the current term, not just the week', () => {
    const rounds = [
      round({ id: 'week', status: 'completed', startsAt: '2026-09-08T17:00:00Z' }),
      round({ id: 'later-in-term', status: 'completed', startsAt: '2026-11-01T17:00:00Z' }),
      round({ id: 'before-term', status: 'completed', startsAt: '2026-08-01T17:00:00Z' }),
    ]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.completedThisTerm).toBe(2)
  })

  it('excludes non-completed rounds from the completed counts', () => {
    const rounds = [round({ status: 'cancelled', startsAt: '2026-09-08T17:00:00Z' })]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.completedThisWeek).toBe(0)
    expect(result.completedThisTerm).toBe(0)
  })

  it('counts expired rounds within the current term only', () => {
    const rounds = [
      round({ id: 'in-term', status: 'expired', startsAt: '2026-09-08T17:00:00Z' }),
      round({ id: 'out-of-term', status: 'expired', startsAt: '2027-01-01T17:00:00Z' }),
    ]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.expiredThisTerm).toBe(1)
  })

  it('lists confirmed/awaiting_result rounds whose slot has already ended as awaiting result', () => {
    const rounds = [
      round({ id: 'overdue', status: 'confirmed', endsAt: '2026-09-10T18:00:00Z' }),
      round({ id: 'not-yet-ended', status: 'confirmed', endsAt: '2026-09-15T18:00:00Z' }),
      round({ id: 'completed', status: 'completed', endsAt: '2026-09-08T18:00:00Z' }),
    ]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.awaitingResult.map((r) => r.roundId)).toEqual(['overdue'])
  })

  it('computes hoursOverdue and sorts most-overdue first', () => {
    const rounds = [
      round({ id: 'less-overdue', status: 'awaiting_result', endsAt: '2026-09-10T18:00:00Z' }), // 2h before NOW
      round({ id: 'more-overdue', status: 'awaiting_result', endsAt: '2026-09-09T18:00:00Z' }), // 26h before NOW
    ]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.awaitingResult.map((r) => r.roundId)).toEqual(['more-overdue', 'less-overdue'])
    expect(result.awaitingResult[0].hoursOverdue).toBe(26)
    expect(result.awaitingResult[1].hoursOverdue).toBe(2)
  })

  it('treats everything term-scoped as zero when there is no current term', () => {
    const rounds = [round({ status: 'completed', startsAt: '2026-09-08T17:00:00Z' })]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, null, TZ)
    expect(result.completedThisTerm).toBe(0)
    expect(result.expiredThisTerm).toBe(0)
    // Week is independent of term, so this still counts.
    expect(result.completedThisWeek).toBe(1)
  })

  it('ignores rounds with no slot embed', () => {
    const rounds = [{ id: 'orphan', status: 'completed', slots: null }]
    const result = shapeRoundsSummary(rounds, NOW, WEEK_START, WEEK_END, TERM, TZ)
    expect(result.completedThisWeek).toBe(0)
    expect(result.completedThisTerm).toBe(0)
  })
})
