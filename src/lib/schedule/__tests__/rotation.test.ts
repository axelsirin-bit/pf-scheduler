import { describe, expect, it } from 'vitest'
import { rotationToCalendarDays } from '../rotation'

const SEQUENCE = ['Day 1', 'Day 2', 'Day 3', 'Day 4']

describe('rotationToCalendarDays — continuous rotation', () => {
  it('assigns the sequence in order across a plain school week, anchored on day one', () => {
    // 2026-09-14 is a Monday
    const entries = rotationToCalendarDays(SEQUENCE, '2026-09-14', '2026-09-14', '2026-09-18', [], false)
    expect(entries.map((e) => [e.date, e.dayCode])).toEqual([
      ['2026-09-14', 'Day 1'],
      ['2026-09-15', 'Day 2'],
      ['2026-09-16', 'Day 3'],
      ['2026-09-17', 'Day 4'],
      ['2026-09-18', 'Day 1'], // wraps
    ])
  })

  it('never generates a row for a weekend', () => {
    const entries = rotationToCalendarDays(SEQUENCE, '2026-09-14', '2026-09-12', '2026-09-20', [], false)
    const dates = entries.map((e) => e.date)
    expect(dates).not.toContain('2026-09-12') // Saturday
    expect(dates).not.toContain('2026-09-13') // Sunday
    expect(dates).not.toContain('2026-09-19') // Saturday
    expect(dates).not.toContain('2026-09-20') // Sunday
  })

  it('does not let a holiday consume a rotation position — the next school day continues the sequence', () => {
    // Without the holiday: Mon=Day1, Tue=Day2, Wed=Day3, Thu=Day4, Fri=Day1
    // With Wednesday as a holiday: Mon=Day1, Tue=Day2, [Wed=holiday], Thu=Day3, Fri=Day4
    const entries = rotationToCalendarDays(
      SEQUENCE,
      '2026-09-14',
      '2026-09-14',
      '2026-09-18',
      [{ date: '2026-09-16', note: 'Staff development day' }],
      false
    )
    const byDate = Object.fromEntries(entries.map((e) => [e.date, e]))
    expect(byDate['2026-09-14'].dayCode).toBe('Day 1')
    expect(byDate['2026-09-15'].dayCode).toBe('Day 2')
    expect(byDate['2026-09-16']).toEqual({
      date: '2026-09-16',
      dayCode: null,
      isSchoolDay: false,
      note: 'Staff development day',
    })
    expect(byDate['2026-09-17'].dayCode).toBe('Day 3')
    expect(byDate['2026-09-18'].dayCode).toBe('Day 4')
  })

  it('computes correctly when the anchor is not the first date in the range', () => {
    // Anchor Wednesday 09-16 as Day 1: Mon=Day3, Tue=Day4, Wed=Day1, Thu=Day2, Fri=Day3
    const entries = rotationToCalendarDays(SEQUENCE, '2026-09-16', '2026-09-14', '2026-09-18', [], false)
    const byDate = Object.fromEntries(entries.map((e) => [e.date, e.dayCode]))
    expect(byDate).toEqual({
      '2026-09-14': 'Day 3',
      '2026-09-15': 'Day 4',
      '2026-09-16': 'Day 1',
      '2026-09-17': 'Day 2',
      '2026-09-18': 'Day 3',
    })
  })

  it('throws when anchorDate is outside [termStart, termEnd]', () => {
    expect(() => rotationToCalendarDays(SEQUENCE, '2026-10-01', '2026-09-14', '2026-09-18', [], false)).toThrow(
      /anchorDate must fall within/
    )
  })

  it('throws when anchorDate falls on a weekend', () => {
    expect(() => rotationToCalendarDays(SEQUENCE, '2026-09-13', '2026-09-12', '2026-09-18', [], false)).toThrow(
      /real school day/
    )
  })

  it('throws when anchorDate falls on a holiday', () => {
    expect(() =>
      rotationToCalendarDays(SEQUENCE, '2026-09-14', '2026-09-14', '2026-09-18', [{ date: '2026-09-14' }], false)
    ).toThrow(/real school day/)
  })
})

describe('rotationToCalendarDays — resets weekly (fixed weekly pattern)', () => {
  it('repeats the same weekday-to-code mapping every week regardless of the anchor position', () => {
    const entries = rotationToCalendarDays(SEQUENCE, '2026-09-14', '2026-09-14', '2026-09-25', [], true)
    const byDate = Object.fromEntries(entries.map((e) => [e.date, e.dayCode]))
    // Week 1 — only 4 codes for 5 weekdays, so Friday (index 4) wraps to
    // index 0
    expect(byDate['2026-09-14']).toBe('Day 1') // Mon, index 0
    expect(byDate['2026-09-18']).toBe('Day 1') // Fri, index 4 % 4 = 0
    // Week 2 repeats identically, not continuing from week 1 — Tuesday
    // lands on index 1 both weeks rather than index 6 if it were counting
    // continuously
    expect(byDate['2026-09-15']).toBe('Day 2') // Tue, week 1
    expect(byDate['2026-09-22']).toBe('Day 2') // Tue, week 2
    expect(byDate['2026-09-25']).toBe('Day 1') // Fri, week 2, same wrap as week 1
  })

  it('a holiday is an isolated exception that does not shift any other date', () => {
    const entries = rotationToCalendarDays(
      SEQUENCE,
      '2026-09-14',
      '2026-09-14',
      '2026-09-18',
      [{ date: '2026-09-16' }],
      true
    )
    const byDate = Object.fromEntries(entries.map((e) => [e.date, e.dayCode]))
    expect(byDate['2026-09-14']).toBe('Day 1')
    expect(byDate['2026-09-15']).toBe('Day 2')
    expect(byDate['2026-09-16']).toBeNull()
    expect(byDate['2026-09-17']).toBe('Day 4') // still Thursday's own mapping, unaffected by the holiday
    expect(byDate['2026-09-18']).toBe('Day 1') // Friday, index 4 % 4 = 0
  })
})
