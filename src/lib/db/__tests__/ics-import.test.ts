import { describe, expect, it } from 'vitest'
import { resolveCalendarDays, computeDiff, type ExistingCalendarDay, type SummaryMapping } from '../ics-import'
import type { ParsedIcsEvent } from '../../schedule/ics'

function existingDay(overrides: Partial<ExistingCalendarDay> = {}): ExistingCalendarDay {
  return {
    date: '2026-09-10',
    isSchoolDay: true,
    dayTypeCode: 'Day 3',
    variantId: 'variant-standard',
    variantName: 'Standard',
    manuallySet: false,
    totalSlots: 5,
    protectedRounds: 0,
    ...overrides,
  }
}

describe('resolveCalendarDays', () => {
  it('maps an event to a school day using the day type and variant from the mapping', () => {
    const events: ParsedIcsEvent[] = [{ date: '2026-09-10', summary: 'Day 3', isAllDay: true }]
    const mapping: SummaryMapping = { 'Day 3': { action: 'school_day', dayTypeCode: 'Day 3', variantId: 'variant-standard' } }
    const { resolved, unmappedSummaries } = resolveCalendarDays(events, mapping)
    expect(resolved).toEqual([
      { date: '2026-09-10', isSchoolDay: true, dayTypeCode: 'Day 3', variantId: 'variant-standard', note: null },
    ])
    expect(unmappedSummaries).toEqual([])
  })

  it('maps an event to no_school, carrying the summary as the note', () => {
    const events: ParsedIcsEvent[] = [{ date: '2026-11-26', summary: 'Thanksgiving Break', isAllDay: true }]
    const mapping: SummaryMapping = { 'Thanksgiving Break': { action: 'no_school' } }
    const { resolved } = resolveCalendarDays(events, mapping)
    expect(resolved).toEqual([
      { date: '2026-11-26', isSchoolDay: false, dayTypeCode: null, variantId: null, note: 'Thanksgiving Break' },
    ])
  })

  it('drops ignored events entirely', () => {
    const events: ParsedIcsEvent[] = [{ date: '2026-09-10', summary: 'Staff Birthday', isAllDay: true }]
    const mapping: SummaryMapping = { 'Staff Birthday': { action: 'ignore' } }
    const { resolved } = resolveCalendarDays(events, mapping)
    expect(resolved).toEqual([])
  })

  it('surfaces a summary with no mapping entry as unmapped, not guessed', () => {
    const events: ParsedIcsEvent[] = [{ date: '2026-09-10', summary: 'Mystery Event', isAllDay: true }]
    const { resolved, unmappedSummaries } = resolveCalendarDays(events, {})
    expect(resolved).toEqual([])
    expect(unmappedSummaries).toEqual(['Mystery Event'])
  })

  it('lets the later event win when two mapped events land on the same date', () => {
    const events: ParsedIcsEvent[] = [
      { date: '2026-09-10', summary: 'Day 3', isAllDay: true },
      { date: '2026-09-10', summary: 'Half-Day', isAllDay: true },
    ]
    const mapping: SummaryMapping = {
      'Day 3': { action: 'school_day', dayTypeCode: 'Day 3', variantId: 'variant-standard' },
      'Half-Day': { action: 'school_day', dayTypeCode: 'Day 3', variantId: 'variant-half-day' },
    }
    const { resolved } = resolveCalendarDays(events, mapping)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].variantId).toBe('variant-half-day')
  })
})

describe('computeDiff', () => {
  const variantNames = new Map([
    ['variant-standard', 'Standard'],
    ['variant-half-day', 'Half-Day'],
  ])
  // A wide span covering everything these tests care about, with the
  // relevant date(s) marked as having an event — the default for tests
  // that aren't specifically about the span/coverage boundary itself.
  const wideSpan = { start: '2026-09-01', end: '2026-09-30' }

  it('reports a date with no existing row as added', () => {
    const resolved = [{ date: '2026-09-15', isSchoolDay: true, dayTypeCode: 'Day 1', variantId: 'variant-standard', note: null }]
    const entries = computeDiff(resolved, [], variantNames, wideSpan, new Set(['2026-09-15']))
    expect(entries).toEqual([
      {
        date: '2026-09-15',
        kind: 'added',
        before: null,
        after: { isSchoolDay: true, dayTypeCode: 'Day 1', variantId: 'variant-standard', variantName: 'Standard', note: null },
        conflictsWithManual: false,
        openSlotsAffected: 0,
        protectedRounds: 0,
      },
    ])
  })

  it('reports a variant change as changed, with plain-language before/after', () => {
    const resolved = [{ date: '2026-09-10', isSchoolDay: true, dayTypeCode: 'Day 3', variantId: 'variant-half-day', note: null }]
    const existing = [existingDay({ variantId: 'variant-standard', variantName: 'Standard' })]
    const entries = computeDiff(resolved, existing, variantNames, wideSpan, new Set(['2026-09-10']))
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('changed')
    expect(entries[0].before?.variantName).toBe('Standard')
    expect(entries[0].after?.variantName).toBe('Half-Day')
  })

  it('does not report a date as changed when nothing actually differs', () => {
    const resolved = [{ date: '2026-09-10', isSchoolDay: true, dayTypeCode: 'Day 3', variantId: 'variant-standard', note: null }]
    const existing = [existingDay()]
    const entries = computeDiff(resolved, existing, variantNames, wideSpan, new Set(['2026-09-10']))
    expect(entries).toEqual([])
  })

  it('reports a date dropped from the feed as removed when it falls inside the feed span with no event', () => {
    const existing = [existingDay({ totalSlots: 5, protectedRounds: 1 })]
    const entries = computeDiff([], existing, variantNames, wideSpan, new Set())
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('removed')
    expect(entries[0].after).toMatchObject({ isSchoolDay: false })
    expect(entries[0].openSlotsAffected).toBe(4)
    expect(entries[0].protectedRounds).toBe(1)
  })

  it('does not report a removal for a date outside the feed span — the feed never reached that far', () => {
    const existing = [existingDay({ date: '2026-11-01' })]
    const entries = computeDiff([], existing, variantNames, wideSpan, new Set())
    expect(entries).toEqual([])
  })

  it('does not report a removal when there is no feed span at all (an empty feed)', () => {
    const existing = [existingDay()]
    const entries = computeDiff([], existing, variantNames, null, new Set())
    expect(entries).toEqual([])
  })

  it('does not report a removal for a date the feed still has an event on, even if unmapped', () => {
    const existing = [existingDay()]
    const entries = computeDiff([], existing, variantNames, wideSpan, new Set(['2026-09-10']))
    expect(entries).toEqual([])
  })

  it('does not report a removal for a date that was already no-school', () => {
    const existing = [existingDay({ isSchoolDay: false, dayTypeCode: null, variantId: null, totalSlots: 0 })]
    const entries = computeDiff([], existing, variantNames, wideSpan, new Set())
    expect(entries).toEqual([])
  })

  it('flags a changed/removed entry as conflicting when the existing row was manually set', () => {
    const resolved = [{ date: '2026-09-10', isSchoolDay: false, dayTypeCode: null, variantId: null, note: 'Snow day' }]
    const existing = [existingDay({ manuallySet: true })]
    const entries = computeDiff(resolved, existing, variantNames, wideSpan, new Set(['2026-09-10']))
    expect(entries[0].conflictsWithManual).toBe(true)
  })

  it('does not flag an added entry as conflicting — there is nothing manual to conflict with', () => {
    const resolved = [{ date: '2026-09-20', isSchoolDay: true, dayTypeCode: 'Day 1', variantId: 'variant-standard', note: null }]
    const entries = computeDiff(resolved, [], variantNames, wideSpan, new Set(['2026-09-20']))
    expect(entries[0].conflictsWithManual).toBe(false)
  })

  it('clamps openSlotsAffected to zero when every existing slot is protected', () => {
    const existing = [existingDay({ totalSlots: 2, protectedRounds: 2 })]
    const entries = computeDiff([], existing, variantNames, wideSpan, new Set())
    expect(entries[0].openSlotsAffected).toBe(0)
  })
})
