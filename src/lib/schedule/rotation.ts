// Pure logic, no database access — computes what dates are school days and
// which rotation code each one gets, for the setup wizard's manual path
// (step 12). This is NOT the anchor-plus-sequence computation decisions.md
// says was dropped from the schedule engine — generateSlots (step 07) still
// only ever reads calendar_days, never computes rotation. This is the one
// place upstream of that, populating calendar_days for a school with no
// feed to import from, the same role seed.sql's hand-written CSV import
// plays for the fake school and step 16's feed sync will eventually play
// for a real one.
//
// A "fixed weekly pattern" (task D's other option) isn't a separate code
// path — it's the same rotation with resetsWeekly true and one code per
// weekday, so Monday is always sequence[0], Tuesday always sequence[1], and
// so on, every week, with no continuity across weeks to track. Continuous
// rotation (resetsWeekly false) is the general case: position advances only
// on real school days (weekends and holidays never consume a rotation
// slot — see school-config.md), counted once across the whole term
// relative to wherever the anchor date lands in that count.
//
// Deliberately not supported: a rotation that resets at some arbitrary
// mid-term date while otherwise running continuously (the real target
// school has exactly one of these, Dec 9 -> Jan 4, per school-config.md).
// That's a hand-edit to specific calendar_days rows after the wizard, or a
// feed import (step 16), not something this function's inputs can express.

export type HolidayInput = { date: string; note?: string }

export type CalendarDayEntry = {
  date: string // 'YYYY-MM-DD'
  dayCode: string | null // null for a non-school day
  isSchoolDay: boolean
  note: string | null
}

function addDaysUTC(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// 0 = Monday .. 4 = Friday. Saturday/Sunday return null — never school days,
// matching the existing seed data's weekend-skipping and the week grid's
// five-column display.
function weekdayIndex(dateStr: string): number | null {
  const [y, m, d] = dateStr.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  if (jsDay === 0 || jsDay === 6) return null
  return jsDay - 1
}

export function rotationToCalendarDays(
  sequence: string[],
  anchorDate: string,
  termStart: string,
  termEnd: string,
  holidays: HolidayInput[],
  resetsWeekly: boolean
): CalendarDayEntry[] {
  if (sequence.length === 0) {
    throw new Error('A rotation needs at least one code in the sequence.')
  }
  if (termEnd < termStart) {
    throw new Error('termEnd must not be before termStart.')
  }
  if (anchorDate < termStart || anchorDate > termEnd) {
    throw new Error('anchorDate must fall within [termStart, termEnd].')
  }

  const holidayMap = new Map(holidays.map((h) => [h.date, h.note ?? null]))
  const length = sequence.length

  if (resetsWeekly) {
    const entries: CalendarDayEntry[] = []
    for (let date = termStart; date <= termEnd; date = addDaysUTC(date, 1)) {
      const weekday = weekdayIndex(date)
      if (weekday === null) continue

      if (holidayMap.has(date)) {
        entries.push({ date, dayCode: null, isSchoolDay: false, note: holidayMap.get(date) ?? null })
        continue
      }

      entries.push({ date, dayCode: sequence[weekday % length], isSchoolDay: true, note: null })
    }
    return entries
  }

  // Continuous rotation: first pass walks the term once, recording each
  // school day's position in a plain local array (not a mutated field on
  // the public shape, and not module state — just a same-length parallel
  // array scoped to this call).
  type Draft = { date: string; isSchoolDay: boolean; note: string | null; position: number | null }
  const draft: Draft[] = []
  let position = -1
  let anchorPosition: number | null = null

  for (let date = termStart; date <= termEnd; date = addDaysUTC(date, 1)) {
    const weekday = weekdayIndex(date)
    if (weekday === null) continue

    if (holidayMap.has(date)) {
      draft.push({ date, isSchoolDay: false, note: holidayMap.get(date) ?? null, position: null })
      continue
    }

    position += 1
    if (date === anchorDate) anchorPosition = position
    draft.push({ date, isSchoolDay: true, note: null, position })
  }

  if (anchorPosition === null) {
    // anchorDate fell on a weekend or a holiday — neither ever gets a
    // school-day position, so there's nothing to anchor against.
    throw new Error('anchorDate must be a real school day (not a weekend or a holiday).')
  }

  return draft.map(({ date, isSchoolDay, note, position: p }) => {
    if (!isSchoolDay || p === null) return { date, dayCode: null, isSchoolDay, note }
    const offset = (((p - anchorPosition!) % length) + length) % length
    return { date, dayCode: sequence[offset], isSchoolDay: true, note: null }
  })
}
