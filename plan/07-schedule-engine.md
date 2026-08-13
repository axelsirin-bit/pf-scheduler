# Step 07 — Schedule engine

## Goal

Given a date range, the system produces the correct slots for every school day,
from the period templates, calendar days, and schedule variants. This is pure
logic with tests, no UI.

## Why this is its own step

Every feature after this reads slots. If slot generation is wrong, every screen
is wrong in a way that looks like a UI bug. Getting it correct and tested in
isolation is worth the extra step.

## The model

Day codes and schedule variants are not computed, they are imported. The
authoritative source for a date's day code, whether it's a school day, and its
schedule variant (Standard, Half-Day, Special, Community, or whatever a given
school calls its own) is `calendar_days`. Where those rows come from depends
on the school: step 04's seed script writes fake ones for the fictional
development school this step is built and tested against; a real school gets
its rows from an admin clicking through the setup wizard (step 12) and, from
step 16 onward, from that school's live feed. Generation itself does not care
which path populated the table. There is no anchor-plus-sequence rotation walk
in this codebase — that approach was considered and dropped once an
authoritative per-date calendar became the design, for every school, not just
the first one. See `plan/reference/decisions.md` for why.

What generation actually does, per date in `calendar_days`:

    calendar_days.is_school_day   false, or no row for the date -> no slots
    calendar_days.variant_id      -> schedule_variants.template_id
                                   -> template_blocks where is_bookable
    for each bookable block: one slot, starts_at/ends_at computed in the
    school's timezone and stored as UTC

`calendar_days.day_type_id` (the Day 1-4 label) is carried along for display
and audit only. It never selects a template — `variant_id` does that. See
`plan/reference/school-config.md`, "Schedule variants," for which blocks are
valid under each one.

## Tasks

1. **`src/lib/schedule/generate.ts`** — given a set of calendar days (already
   populated) and their variant templates, produce the slot rows: for each
   school day, for each bookable block in that day's variant template, one
   slot with `starts_at` and `ends_at` computed in the school's timezone and
   stored as UTC. Pure function, no database access — take calendar days and
   templates as arguments so it's testable without a database.

2. **`src/lib/db/slots.ts`** — persist generated slots idempotently. Running
   generation twice for the same range must not duplicate slots. Use the unique
   constraint on `(calendar_day_id, block_id)` and an upsert.

3. **Regeneration safety.** If a slot already has availabilities or a round
   attached, regeneration must never delete it. If an exception now says that
   day is cancelled, mark the slot `is_open = false` and flag the affected
   rounds for admin attention rather than deleting anything.

4. **A scheduled job** that generates slots four weeks ahead, run as a Vercel
   cron hitting a route handler at `/api/cron/generate-slots`. Protect the route
   with a secret header checked against an environment variable.

5. **Tests** in `src/lib/schedule/__tests__/`. Install Vitest. Cover:
   - a plain week, all Standard
   - a week containing a Half-Day, confirming Block 5 onward is dropped
   - a week containing a Special or Community day, confirming all 8 blocks
     still generate
   - a date range with a non-school day (holiday or weekend) in the middle,
     confirming no slots on that date and no effect on neighboring dates
   - daylight saving time transition dates, confirming the stored UTC times
     still render as the correct local times

## Acceptance criteria

- All tests pass.
- Generating slots for the fake school's seeded month and comparing against
  the fixture data shows zero mismatches on schedule variant or time. (The
  same check against a real published calendar happens later, at the wizard's
  preview step and again in the step 18 verification checklist, once a real
  school exists.)
- Running generation twice produces the same row count.
- Marking a day as cancelled after rounds exist does not delete the rounds.

## Common failure modes

- Timezone conversion done with the server's local time rather than the school's
  timezone. The server runs in UTC on Vercel. Always convert explicitly.
- Daylight saving. A 7:30 AM block is 11:30 UTC in winter and 12:30 UTC in
  summer. If tests do not cover a transition date, this ships broken and is
  discovered in March.
- A date missing from `calendar_days` silently produces no slots. That's
  correct for a holiday, but wrong if it's actually a school day the import
  missed. Worth a report of gaps against the expected term date range rather
  than trusting silence.

## Do not

- Do not build UI in this step.
- Do not add the ICS import here. That is step 16 and it writes into the same
  tables through a different path.
- Do not resurrect an anchor-plus-sequence rotation calculator. The calendar
  import is the source of truth for day codes and variants now.
