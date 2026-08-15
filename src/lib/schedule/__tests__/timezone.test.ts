import { describe, expect, it } from 'vitest'
import { zonedTimeToUtc } from '../timezone'

describe('zonedTimeToUtc', () => {
  it('converts standard time correctly (EST, UTC-5)', () => {
    expect(zonedTimeToUtc('2026-12-01', '08:00', 'America/New_York').toISOString()).toBe(
      '2026-12-01T13:00:00.000Z'
    )
  })

  it('converts daylight time correctly (EDT, UTC-4)', () => {
    expect(zonedTimeToUtc('2026-09-08', '08:00', 'America/New_York').toISOString()).toBe(
      '2026-09-08T12:00:00.000Z'
    )
  })

  it('picks the correct offset immediately before and after a DST transition', () => {
    // 2026 spring-forward is March 8. Mar 7 is still EST, Mar 9 is EDT.
    expect(zonedTimeToUtc('2026-03-07', '08:00', 'America/New_York').toISOString()).toBe(
      '2026-03-07T13:00:00.000Z'
    )
    expect(zonedTimeToUtc('2026-03-09', '08:00', 'America/New_York').toISOString()).toBe(
      '2026-03-09T12:00:00.000Z'
    )
  })

  it('handles a timezone with a non-hour UTC offset', () => {
    // India Standard Time is UTC+5:30 — a real-world check that this isn't
    // secretly assuming whole-hour offsets anywhere in the drift correction.
    expect(zonedTimeToUtc('2026-06-01', '08:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-06-01T02:30:00.000Z'
    )
  })
})
