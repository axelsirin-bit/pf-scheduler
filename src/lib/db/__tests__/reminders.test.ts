import { describe, expect, it } from 'vitest'
import { selectReminderCandidates } from '../reminders'

const TZ = 'America/New_York'
// "Now" fixed at noon Eastern on 2026-09-09 (Wednesday). Tomorrow is
// 2026-09-10.
const NOW = new Date('2026-09-09T16:00:00Z')

function round(overrides: {
  id?: string
  status?: string
  confirmedAt?: string | null
  startsAt?: string
  endsAt?: string
  hasResult?: boolean
} = {}) {
  return {
    id: overrides.id ?? 'r1',
    status: overrides.status ?? 'confirmed',
    confirmed_at: overrides.confirmedAt ?? '2026-09-07T16:00:00Z',
    slots: { starts_at: overrides.startsAt ?? '2026-09-10T17:00:00Z', ends_at: overrides.endsAt ?? '2026-09-10T18:00:00Z' },
    schools: { timezone: TZ },
    round_results: overrides.hasResult ? [{ id: 'res1' }] : [],
  }
}

describe('selectReminderCandidates — round tomorrow', () => {
  it('includes a confirmed round whose slot is tomorrow and confirmed well in advance', () => {
    const result = selectReminderCandidates([round()], NOW)
    expect(result.roundTomorrow).toEqual(['r1'])
  })

  it('excludes a round whose slot is not tomorrow', () => {
    const result = selectReminderCandidates([round({ startsAt: '2026-09-15T17:00:00Z', endsAt: '2026-09-15T18:00:00Z' })], NOW)
    expect(result.roundTomorrow).toEqual([])
  })

  it('excludes a round confirmed less than a day before its own start time', () => {
    // Confirmed at 2026-09-10T00:00:00Z, starts 2026-09-10T17:00:00Z — 17h lead time.
    const result = selectReminderCandidates(
      [round({ confirmedAt: '2026-09-10T00:00:00Z' })],
      NOW
    )
    expect(result.roundTomorrow).toEqual([])
  })

  it('excludes a round that is not confirmed (e.g. awaiting_result)', () => {
    const result = selectReminderCandidates([round({ status: 'awaiting_result' })], NOW)
    expect(result.roundTomorrow).toEqual([])
  })

  it('ignores a round with no slot or school embed rather than crashing', () => {
    const broken = { id: 'r1', status: 'confirmed', confirmed_at: null, slots: null, schools: null, round_results: [] }
    const result = selectReminderCandidates([broken], NOW)
    expect(result.roundTomorrow).toEqual([])
  })
})

describe('selectReminderCandidates — result needed', () => {
  it('flags a round as needing a first reminder 3+ hours after its slot ended, with no result', () => {
    // Ended 2026-09-09T12:00:00Z, now is 16:00Z — 4 hours ago.
    const r = round({ status: 'awaiting_result', startsAt: '2026-09-09T11:00:00Z', endsAt: '2026-09-09T12:00:00Z' })
    const result = selectReminderCandidates([r], NOW)
    expect(result.resultNeededFirst).toEqual(['r1'])
    expect(result.resultNeededSecond).toEqual([])
  })

  it('does not flag a round that ended less than 3 hours ago', () => {
    const r = round({ status: 'awaiting_result', startsAt: '2026-09-09T14:30:00Z', endsAt: '2026-09-09T15:00:00Z' })
    const result = selectReminderCandidates([r], NOW)
    expect(result.resultNeededFirst).toEqual([])
  })

  it('flags a round as needing the second reminder once 48+ hours have passed, not the first', () => {
    const r = round({ status: 'awaiting_result', startsAt: '2026-09-07T10:00:00Z', endsAt: '2026-09-07T11:00:00Z' })
    const result = selectReminderCandidates([r], NOW)
    expect(result.resultNeededSecond).toEqual(['r1'])
    expect(result.resultNeededFirst).toEqual([])
  })

  it('never flags a round that already has a result', () => {
    const r = round({ status: 'awaiting_result', startsAt: '2026-09-07T10:00:00Z', endsAt: '2026-09-07T11:00:00Z', hasResult: true })
    const result = selectReminderCandidates([r], NOW)
    expect(result.resultNeededFirst).toEqual([])
    expect(result.resultNeededSecond).toEqual([])
  })

  it('never flags a round whose slot has not ended yet', () => {
    const r = round({ status: 'confirmed', startsAt: '2026-09-10T17:00:00Z', endsAt: '2026-09-10T18:00:00Z' })
    const result = selectReminderCandidates([r], NOW)
    expect(result.resultNeededFirst).toEqual([])
    expect(result.resultNeededSecond).toEqual([])
  })
})
