import ical from 'node-ical'
import { dateInTimezone } from './week-bounds.ts'

export type ParsedIcsEvent = {
  date: string // YYYY-MM-DD
  summary: string
  isAllDay: boolean
}

// Pure: no network access, takes already-fetched ICS text. All-day events
// (VALUE=DATE) are the ones a school feed actually uses for rotation/
// holiday info (see the step file's own note on what feeds realistically
// give you) — their date is a literal calendar date with no timezone
// component, so it's read directly rather than run through timezone
// conversion. A rare timed event is converted via the school's own
// timezone, same as everywhere else timestamps get turned into "which
// school day is this."
export function parseIcsFeed(icsText: string, timeZone: string, rangeStart: string, rangeEnd: string): ParsedIcsEvent[] {
  const data = ical.sync.parseICS(icsText)
  const events: ParsedIcsEvent[] = []
  const rangeFrom = new Date(`${rangeStart}T00:00:00Z`)
  const rangeTo = new Date(`${rangeEnd}T23:59:59Z`)

  for (const key of Object.keys(data)) {
    const component = data[key]
    if (!component || component.type !== 'VEVENT') continue

    const summaryRaw = component.summary
    const summary = typeof summaryRaw === 'string' ? summaryRaw.trim() : String(summaryRaw ?? '').trim()
    if (!summary) continue

    if (component.rrule) {
      const instances = ical.expandRecurringEvent(component, { from: rangeFrom, to: rangeTo })
      for (const instance of instances) {
        events.push({
          date: toDateStr(instance.start, instance.isFullDay, timeZone),
          summary,
          isAllDay: instance.isFullDay,
        })
      }
      continue
    }

    const isAllDay = component.datetype === 'date'
    const dateStr = toDateStr(component.start, isAllDay, timeZone)
    if (dateStr >= rangeStart && dateStr <= rangeEnd) {
      events.push({ date: dateStr, summary, isAllDay })
    }
  }

  return events
}

function toDateStr(d: Date, isAllDay: boolean, timeZone: string): string {
  if (isAllDay) {
    return d.toISOString().slice(0, 10)
  }
  return dateInTimezone(d.toISOString(), timeZone)
}

export type FetchIcsResult = { ok: true; events: ParsedIcsEvent[] } | { ok: false; error: string }

// Impure: the actual network fetch, wrapped so failure (unreachable,
// non-200, unparseable body) is a typed result rather than a thrown
// error the caller has to remember to catch — task 6's "keep the last
// known good calendar" behavior depends on this never throwing past a
// caller that forgets to wrap it.
export async function fetchIcsFeed(url: string, timeZone: string, rangeStart: string, rangeEnd: string): Promise<FetchIcsResult> {
  let text: string
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      return { ok: false, error: `The feed returned ${res.status} ${res.statusText}.` }
    }
    text = await res.text()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Could not reach the feed: ${e.message}` : 'Could not reach the feed.' }
  }

  try {
    const events = parseIcsFeed(text, timeZone, rangeStart, rangeEnd)
    return { ok: true, events }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Could not parse the feed: ${e.message}` : 'Could not parse the feed.' }
  }
}
