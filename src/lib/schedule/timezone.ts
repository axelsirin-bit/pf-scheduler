// Converts a wall-clock date + time in `timeZone` to the correct UTC
// instant, DST included. There's no date library in this project yet, so
// this does it by formatting a UTC guess back through the target timezone
// and correcting for the drift — two passes because a single correction
// can land on the wrong side of a DST transition right at the boundary.
//
// Extracted from scripts/seed-dev-data.ts (step 04), where a real bug lived
// here: the drift check compared each pass against the *previous guess*
// instead of the fixed target, which overcorrected instead of converging.
// Fixed and verified against both EDT and EST before this was pulled out
// into a shared helper — see PROGRESS.md, step 04 deviations.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  // Fixed target: the desired wall-clock numbers, read as if they were UTC.
  // Every iteration corrects `utcGuess` against this same fixed value —
  // comparing against the previous guess instead would overcorrect on each
  // pass rather than converge.
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let utcGuess = targetAsUtc

  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(new Date(utcGuess))
        .map((p) => [p.type, p.value])
    )

    const formattedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      Number(parts.minute)
    )
    utcGuess -= formattedAsUtc - targetAsUtc
  }

  return new Date(utcGuess)
}
