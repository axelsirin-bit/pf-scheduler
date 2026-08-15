// Pure date-string arithmetic for the week grid (step 08). Dates here are
// plain 'YYYY-MM-DD'. Everything works in UTC internally rather than
// `new Date(dateStr)` parsed as local time, so which Monday or which
// day-of-week a date falls on doesn't depend on the Node process's own
// timezone — only `todayInTimezone` cares about a real timezone, because
// only it's answering "what day is it right now," which is genuinely
// timezone-dependent.

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Monday of the week containing dateStr. Sunday is treated as the tail end
// of the previous week, not the start of a new one.
export function mondayOfWeek(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = date.getUTCDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setUTCDate(date.getUTCDate() + diffToMonday)
  return date.toISOString().slice(0, 10)
}

// "Today" as the school actually experiences it, not the server's own
// local date — a request rendered just after midnight UTC can already be
// the next calendar date in America/New_York, or still be yesterday west
// of UTC. `en-CA` is a deliberate trick: that locale formats dates as
// YYYY-MM-DD, so no manual part-reassembly is needed.
export function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
