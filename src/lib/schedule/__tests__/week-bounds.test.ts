import { describe, expect, it } from 'vitest'
import { addDays, mondayOfWeek, todayInTimezone } from '../week-bounds'

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-09-14', 4)).toBe('2026-09-18')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2026-09-28', 4)).toBe('2026-10-02')
  })

  it('supports negative offsets', () => {
    expect(addDays('2026-09-14', -7)).toBe('2026-09-07')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 4)).toBe('2027-01-03')
  })
})

describe('mondayOfWeek', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOfWeek('2026-09-14')).toBe('2026-09-14')
  })

  it('walks back to Monday from a mid-week date', () => {
    expect(mondayOfWeek('2026-09-17')).toBe('2026-09-14')
  })

  it('treats Sunday as the tail end of the previous week, not a new one', () => {
    expect(mondayOfWeek('2026-09-20')).toBe('2026-09-14')
  })
})

describe('todayInTimezone', () => {
  it('produces a YYYY-MM-DD string', () => {
    expect(todayInTimezone('America/New_York')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
