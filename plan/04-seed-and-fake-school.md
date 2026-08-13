# Step 04 — Seed data and a fake school

## Goal

A fictional school's schedule structure exists in the database, plus a
repeatable seed script that resets the database to a known state for
development. Every step from here through step 15 builds and is verified
against this fake school, not against the real school this app is ultimately
for.

## Why a fake school, not the real one

v1 is school-agnostic starting now. No school-specific configuration —
bell schedule, rotation, room list, term dates — gets hardcoded into a
migration, a seed script, or application code, ever. The only path any
school's real data enters the system is the setup wizard at step 12,
clicked through by an admin like any other user of the product. Building
steps 04 through 15 against a fake school is what proves that path is real:
if the app only works because a developer hand-typed one school's facts into
`supabase/seed.sql`, the wizard would just be decoration. See
`plan/reference/decisions.md`, "School-agnostic v1," for the full reasoning.

`plan/reference/school-config.md` still holds real facts gathered about the
school this project is ultimately for, but it is no longer a prerequisite for
this step or any step before the wizard. Nothing in it blocks work here.

## Prerequisites

None. Do not ask the human for a real bell schedule, rotation, room list, or
term dates. If you find yourself wanting one of those values, that is a sign
this step or a later one has drifted back into hardcoding a real school —
stop and use a made-up value instead.

## Tasks

1. **Invent a fictional school.** Made up but internally consistent:
   - Name and slug that obviously read as fictional (something like
     "Riverbend Academy," not a real school's name or a thin disguise of one)
   - Timezone `America/New_York` (matches the real target school, harmless to
     reuse since it's just a timezone, not identifying data)
   - `expected_rounds_per_term = 8`, `weekly_credit_cap = 2` — reasonable
     defaults, not values pulled from any real school's config
   - `rotation_resets_weekly = false`

2. **Invent school terms.** Two made-up semesters with arbitrary but
   sensible-looking start/end dates (e.g. late August to December, January to
   May of some near-future year). Dates just need internal consistency — Fall
   ends before Spring starts, both are a few months long.

3. **Invent period templates.** One `Standard` template with a simple made-up
   set of blocks — it does not need eight blocks or the real school's exact
   times. Five or six labeled blocks spanning a school day is enough to
   exercise every code path (bookable and non-bookable, morning and afternoon).
   Add one shortened variant (call it `Half-Day` or similar) that drops the
   last block or two, so the variant-template machinery in the schema
   (`schedule_variants`) has more than one row to exercise.

4. **Invent day types and schedule variants.** A handful of day codes (e.g.
   `Day 1` through `Day 4`) as informational rows in `day_types`, and
   `schedule_variants` rows pointing `Standard` and the shortened variant at
   their templates.

5. **Generate a fake calendar.** Don't import any real CSV. Write a small
   generator (or hand-roll a couple months) that produces `calendar_days`
   rows for a made-up term: weekdays are school days, weekends are skipped,
   sprinkle in a few non-school days (a "holiday") and a few days using the
   shortened variant, so slot generation has real variety to be tested
   against. `source = 'manual'` for all of it.

6. **Invent rooms.** A handful of made-up room names/notes ("Room 204,
   usually free periods 2 and 5" — periods are just flavor text here, not
   modeled).

7. **Write the seed script** at `supabase/seed.sql`. It must be idempotent, run
   automatically as part of `supabase db reset`, and create:
   - the fictional school with its fictional (but internally consistent)
     schedule structure
   - a second fake school, "Test Academy," used only by the RLS test —
     distinct from the first fake school, so cross-tenant tests have two real
     rows to compare rather than one school against itself
   - four fake users at the first fake school with known emails, one of each
     role combination: admin, debater, debater-and-judge, judge-only
   - four fake users at Test Academy

8. **Write `scripts/seed-dev-data.ts`** that generates a month of slots from
   the seeded calendar days and their variant templates, so there is
   something to look at in step 08. This is development data only and must be
   clearly separated from the seed of structural data in task 1-6.

## Acceptance criteria

- `supabase db reset` produces a database with the fictional school, terms,
  templates, day types, schedule variants, calendar days, and rooms present.
- Running `scripts/seed-dev-data.ts` produces slots for a month, and spot
  checking three dates shows the correct day code and schedule variant,
  including at least one shortened-variant day.
- The RLS test from step 03 still passes with the new seed data.
- Nothing in `supabase/seed.sql`, `scripts/seed-dev-data.ts`, or any migration
  references a real school's actual name, bell times, rotation, or rooms.

## Verification the human should do

Look at the generated slots for one specific week and confirm they're
internally consistent with the fake template — right blocks, right times,
shortened variant actually shortened. There's nothing to compare against a
real calendar yet, because there shouldn't be; that comparison happens for
real at the wizard's preview step (step 12) when an actual school, including
this project's real one, is onboarded for real.
