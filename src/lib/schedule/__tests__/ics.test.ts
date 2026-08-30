import { describe, expect, it } from 'vitest'
import { parseIcsFeed } from '../ics'

const TZ = 'America/New_York'

function wrapCalendar(events: string): string {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//test//EN\r\n${events}END:VCALENDAR\r\n`
}

describe('parseIcsFeed', () => {
  it('extracts an all-day event with its date and summary', () => {
    const ics = wrapCalendar(
      'BEGIN:VEVENT\r\nUID:e1@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260910\r\nSUMMARY:Day 3\r\nEND:VEVENT\r\n'
    )
    const events = parseIcsFeed(ics, TZ, '2026-08-24', '2026-12-18')
    expect(events).toEqual([{ date: '2026-09-10', summary: 'Day 3', isAllDay: true }])
  })

  it('excludes events outside the requested date range', () => {
    const ics = wrapCalendar(
      'BEGIN:VEVENT\r\nUID:e1@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260101\r\nSUMMARY:New Year\r\nEND:VEVENT\r\n'
    )
    const events = parseIcsFeed(ics, TZ, '2026-08-24', '2026-12-18')
    expect(events).toEqual([])
  })

  it('expands a weekly RRULE into individual dated instances within range', () => {
    const ics = wrapCalendar(
      'BEGIN:VEVENT\r\nUID:e2@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260902\r\nRRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20260930\r\nSUMMARY:Half-Day Wednesday\r\nEND:VEVENT\r\n'
    )
    const events = parseIcsFeed(ics, TZ, '2026-09-01', '2026-09-30')
    expect(events.map((e) => e.date)).toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'])
    expect(events.every((e) => e.summary === 'Half-Day Wednesday' && e.isAllDay)).toBe(true)
  })

  it('parses multiple distinct events from the same feed', () => {
    const ics = wrapCalendar(
      'BEGIN:VEVENT\r\nUID:e1@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260910\r\nSUMMARY:Day 3\r\nEND:VEVENT\r\n' +
        'BEGIN:VEVENT\r\nUID:e2@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260911\r\nSUMMARY:No School - Teacher Workday\r\nEND:VEVENT\r\n'
    )
    const events = parseIcsFeed(ics, TZ, '2026-08-24', '2026-12-18')
    expect(events.map((e) => e.summary).sort()).toEqual(['Day 3', 'No School - Teacher Workday'])
  })

  it('skips non-VEVENT components (e.g. VTIMEZONE) without erroring', () => {
    const ics =
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nEND:VTIMEZONE\r\n' +
      'BEGIN:VEVENT\r\nUID:e1@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260910\r\nSUMMARY:Day 3\r\nEND:VEVENT\r\n' +
      'END:VCALENDAR\r\n'
    const events = parseIcsFeed(ics, TZ, '2026-08-24', '2026-12-18')
    expect(events).toHaveLength(1)
  })

  it('drops an event with an empty summary rather than crashing', () => {
    const ics = wrapCalendar(
      'BEGIN:VEVENT\r\nUID:e1@test\r\nDTSTAMP:20260101T000000Z\r\nDTSTART;VALUE=DATE:20260910\r\nSUMMARY:\r\nEND:VEVENT\r\n'
    )
    const events = parseIcsFeed(ics, TZ, '2026-08-24', '2026-12-18')
    expect(events).toEqual([])
  })
})
