import { describe, expect, it } from 'vitest'
import { generateSlots, type ScheduleVariant, type TemplateBlock } from '../generate'

const TIME_ZONE = 'America/New_York'

// Shapes match Riverbend Academy's real seeded templates (step 04): six
// Standard blocks (one non-bookable, Advisory), Half-Day keeping only the
// first four. Community is mock-only (Riverbend doesn't actually have this
// variant) purely to exercise a full-day variant that isn't Standard, per
// the step file's test list.
const STANDARD_TEMPLATE = 'tpl-standard'
const HALF_DAY_TEMPLATE = 'tpl-half-day'
const COMMUNITY_TEMPLATE = 'tpl-community'

const standardBlocks: TemplateBlock[] = [
  { id: 'blk-morning', templateId: STANDARD_TEMPLATE, label: 'Morning Block', startTime: '08:00', endTime: '09:00', isBookable: true, sortOrder: 1 },
  { id: 'blk-advisory', templateId: STANDARD_TEMPLATE, label: 'Advisory', startTime: '09:10', endTime: '09:25', isBookable: false, sortOrder: 2 },
  { id: 'blk-midday', templateId: STANDARD_TEMPLATE, label: 'Midday Block', startTime: '09:35', endTime: '10:35', isBookable: true, sortOrder: 3 },
  { id: 'blk-lunch', templateId: STANDARD_TEMPLATE, label: 'Lunch', startTime: '11:20', endTime: '12:00', isBookable: true, sortOrder: 4 },
  { id: 'blk-afternoon', templateId: STANDARD_TEMPLATE, label: 'Afternoon Block', startTime: '12:10', endTime: '13:10', isBookable: true, sortOrder: 5 },
  { id: 'blk-after-school', templateId: STANDARD_TEMPLATE, label: 'After School', startTime: '15:00', endTime: '16:00', isBookable: true, sortOrder: 6 },
]

const halfDayBlocks: TemplateBlock[] = [
  { id: 'blk-hd-morning', templateId: HALF_DAY_TEMPLATE, label: 'Morning Block', startTime: '08:00', endTime: '09:00', isBookable: true, sortOrder: 1 },
  { id: 'blk-hd-advisory', templateId: HALF_DAY_TEMPLATE, label: 'Advisory', startTime: '09:10', endTime: '09:25', isBookable: false, sortOrder: 2 },
  { id: 'blk-hd-midday', templateId: HALF_DAY_TEMPLATE, label: 'Midday Block', startTime: '09:35', endTime: '10:35', isBookable: true, sortOrder: 3 },
  { id: 'blk-hd-lunch', templateId: HALF_DAY_TEMPLATE, label: 'Lunch', startTime: '11:20', endTime: '12:00', isBookable: true, sortOrder: 4 },
]

const communityBlocks: TemplateBlock[] = standardBlocks.map((b) => ({
  ...b,
  id: b.id.replace('blk-', 'blk-com-'),
  templateId: COMMUNITY_TEMPLATE,
}))

const variants: ScheduleVariant[] = [
  { id: 'var-standard', templateId: STANDARD_TEMPLATE },
  { id: 'var-half-day', templateId: HALF_DAY_TEMPLATE },
  { id: 'var-community', templateId: COMMUNITY_TEMPLATE },
]

const allBlocks = [...standardBlocks, ...halfDayBlocks, ...communityBlocks]

describe('generateSlots', () => {
  it('generates one slot per bookable block for a plain all-Standard week', () => {
    const week = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(
      (date, i) => ({ id: `cd-${i}`, date, isSchoolDay: true, variantId: 'var-standard' })
    )

    const slots = generateSlots(week, variants, allBlocks, TIME_ZONE)

    // 5 bookable blocks (Advisory excluded) x 5 days
    expect(slots).toHaveLength(25)
    expect(slots.every((s) => s.label !== 'Advisory')).toBe(true)
    for (const day of week) {
      const daySlots = slots.filter((s) => s.calendarDayId === day.id)
      expect(daySlots).toHaveLength(5)
    }
  })

  it('drops the afternoon blocks on a Half-Day, keeping the rest of the week normal', () => {
    const week = [
      { id: 'cd-mon', date: '2026-09-14', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-tue', date: '2026-09-15', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-wed', date: '2026-09-16', isSchoolDay: true, variantId: 'var-half-day' },
      { id: 'cd-thu', date: '2026-09-17', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-fri', date: '2026-09-18', isSchoolDay: true, variantId: 'var-standard' },
    ]

    const slots = generateSlots(week, variants, allBlocks, TIME_ZONE)

    const halfDaySlots = slots.filter((s) => s.calendarDayId === 'cd-wed')
    expect(halfDaySlots).toHaveLength(3)
    expect(halfDaySlots.map((s) => s.label).sort()).toEqual(['Lunch', 'Midday Block', 'Morning Block'])
    expect(halfDaySlots.some((s) => s.label === 'Afternoon Block' || s.label === 'After School')).toBe(false)

    // neighboring Standard days are unaffected
    expect(slots.filter((s) => s.calendarDayId === 'cd-mon')).toHaveLength(5)
    expect(slots.filter((s) => s.calendarDayId === 'cd-thu')).toHaveLength(5)
  })

  it('generates every bookable block on a full-length non-Standard variant (Community)', () => {
    const week = [
      { id: 'cd-mon', date: '2026-09-14', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-tue', date: '2026-09-15', isSchoolDay: true, variantId: 'var-community' },
    ]

    const slots = generateSlots(week, variants, allBlocks, TIME_ZONE)

    const communitySlots = slots.filter((s) => s.calendarDayId === 'cd-tue')
    // Same bookable count as Standard (5) — a full-day variant isn't
    // truncated the way Half-Day is.
    expect(communitySlots).toHaveLength(5)
  })

  it('produces no slots for a non-school day and does not affect neighboring dates', () => {
    const range = [
      { id: 'cd-mon', date: '2026-09-14', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-tue', date: '2026-09-15', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-wed-holiday', date: '2026-09-16', isSchoolDay: false, variantId: null },
      { id: 'cd-thu', date: '2026-09-17', isSchoolDay: true, variantId: 'var-standard' },
      { id: 'cd-fri', date: '2026-09-18', isSchoolDay: true, variantId: 'var-standard' },
    ]

    const slots = generateSlots(range, variants, allBlocks, TIME_ZONE)

    expect(slots.some((s) => s.calendarDayId === 'cd-wed-holiday')).toBe(false)
    expect(slots).toHaveLength(20) // 4 school days x 5 bookable blocks
    expect(slots.filter((s) => s.calendarDayId === 'cd-tue')).toHaveLength(5)
    expect(slots.filter((s) => s.calendarDayId === 'cd-thu')).toHaveLength(5)
  })

  it('stores the correct UTC instant on both sides of a daylight saving transition', () => {
    // 2026 America/New_York: DST starts Mar 8 (spring forward), ends Nov 1
    // (fall back). Same local 08:00 Morning Block, different UTC offset.
    const beforeSpringForward = { id: 'cd-est', date: '2026-03-06', isSchoolDay: true, variantId: 'var-standard' }
    const afterSpringForward = { id: 'cd-edt', date: '2026-03-09', isSchoolDay: true, variantId: 'var-standard' }

    const slots = generateSlots([beforeSpringForward, afterSpringForward], variants, allBlocks, TIME_ZONE)

    const estMorning = slots.find((s) => s.calendarDayId === 'cd-est' && s.label === 'Morning Block')!
    const edtMorning = slots.find((s) => s.calendarDayId === 'cd-edt' && s.label === 'Morning Block')!

    // EST is UTC-5: 08:00 local -> 13:00 UTC
    expect(estMorning.startsAt).toBe('2026-03-06T13:00:00.000Z')
    // EDT is UTC-4: 08:00 local -> 12:00 UTC
    expect(edtMorning.startsAt).toBe('2026-03-09T12:00:00.000Z')
  })

  it('skips a day missing a variant and a day marked as not a school day', () => {
    const range = [
      { id: 'cd-no-variant', date: '2026-09-14', isSchoolDay: true, variantId: null },
      { id: 'cd-not-school', date: '2026-09-15', isSchoolDay: false, variantId: 'var-standard' },
    ]

    const slots = generateSlots(range, variants, allBlocks, TIME_ZONE)

    expect(slots).toHaveLength(0)
  })
})
