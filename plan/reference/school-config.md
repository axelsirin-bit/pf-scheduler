# School configuration

**This no longer gates any step.** v1 is school-agnostic starting at step 04
— see `plan/reference/decisions.md`, "v1 is school-agnostic starting at step
04." Steps 04 through 15 build and test against a fictional fake school, not
this one, and none of the `TODO`s below block that work.

What's here is real information gathered about the school this project is
ultimately for, kept so it's ready when that school is onboarded for real —
by clicking through the setup wizard (step 12) like any other admin, not by
Claude Code reading this file into a migration or seed script. Fill it in
whenever it's convenient before that conversation; there's no deadline tied
to a build step anymore.

---

## Basics

- School name: `TODO`
- Slug (lowercase, no spaces): `TODO`
- Timezone: `America/New_York`
- Expected completed rounds per member per term: `8` (one every two weeks)
- Weekly credit cap: `2`

## Terms

| Name | Starts | Ends |
|---|---|---|
| Fall `TODO` | `TODO` | `TODO` |
| Spring `TODO` | `TODO` | `TODO` |

## Bell schedule blocks

These times are taken from the existing practice schedule doc. Confirm them
against the school's official schedule before step 04, and correct anything that
has changed.

| Label | Start | End | Bookable |
|---|---|---|---|
| Before school | 07:30 | 08:20 | yes |
| Block 2 | 08:40 | 09:40 | yes |
| Advisory | 09:55 | 10:05 | **no** |
| Block 3 | 10:20 | 11:20 | yes |
| AAA | 11:40 | 12:05 | **no** |
| Lunch | 12:15 | 12:55 | yes |
| Block 5 | 13:05 | 14:05 | yes |
| Block 6 | 14:35 | 15:35 | yes |
| After school 1 | 16:00 | 17:00 | yes |
| After school 2 | 17:10 | 18:10 | yes |

Note: the Friday "before school" block on the current doc ends at 08:15 rather
than 08:20. Confirm whether Friday uses a different template, and if so add it
as its own template.

## Rotation

Day codes (Day 1 through Day 4, ODD/EVEN in the older hand-typed doc) come
from the school's calendar, not from a computed sequence. For 2026-27 the
authoritative source is
`plan/reference/re-upper-school-calendar-2026-27.csv`, which lists every
Upper School day with its date, day code, and schedule variant. It is
imported directly into `calendar_days` as `source = 'manual'`. Step 16
replaces manual re-imports with a live feed sync; a manually set row always
survives a sync.

**Does the rotation reset weekly, or run continuously across holidays?**
Continuously — it wraps Day 4 to Day 1 across every normal weekend and
holiday. `rotation_resets_weekly` on `schools` is `false`. There is exactly
one deliberate reset: December 9, 2026 is Day 2, and the next school day,
January 4, 2027, restarts at Day 1 rather than continuing to Day 3, because
winter break is long enough that the school resets the cycle at the start of
second semester. That reset is just data in the CSV, not a rule the app has
to know.

The day code only determines whether a date is a school day (present in the
calendar = in session). It never selects a bell template — see "Schedule
variants" below for what does. There is no per-period mapping to fill in
here: the PF blocks are fixed windows, not class periods, so which numbered
period is running inside a block never matters to the app.

## Schedule variants

The eight PF blocks are fixed windows, so the day code (Day 1-4) never
changes which blocks are offered. What changes them is the schedule variant,
also given per date in the calendar CSV/feed: `Standard`, `Half-Day`,
`Special`, or `Community`.

**`TODO` — not confirmed.** The table below is Claude Code's working
assumption, not something the human has confirmed. Nobody has supplied the
school's actual Half-Day, Special, or Community dismissal times or bell
schedule for those days. Do not build the step 04 templates from this table
until the human corrects or confirms it.

| Variant | Before school | Block 2 | Block 3 | Lunch | Block 5 | Block 6 | After school 1 | After school 2 |
|---|---|---|---|---|---|---|---|---|
| Standard | yes | yes | yes | yes | yes | yes | yes | yes |
| Half-Day | yes | yes | yes | yes | `?` | `?` | `?` | `?` |
| Special | yes | yes | yes | yes | `?` | `?` | `?` | `?` |
| Community | yes | yes | yes | yes | `?` | `?` | `?` | `?` |

Working assumption, unconfirmed: Half-Day dismisses after Lunch (12:55), so
Block 5 onward would be cut; Special and Community run full length since they
change what's happening inside a class period rather than when school lets
out. Covers 8 Half-Day, 4 Special, and 16 Community dates in the 2026-27
calendar. Get the real dismissal times / block cutoffs from the human and
replace the `?` marks before step 04.

Each variant needs its own `period_templates` row (reusing the same block
labels/times as Standard, minus whichever blocks are cut) plus a
`schedule_variants` row pointing at it. Step 04 creates these four templates
— but not until this section is confirmed.

## Rooms

Rooms that are reliably free, with when. Advisory only, not a booking system.

| Room | Usually free |
|---|---|
| `TODO` | `TODO` |

## Recurring squad practice

The current doc reserves Wednesday 07:30 to 08:20 for PF squad practice. Mark
that block as not bookable on the Wednesday template so the app does not offer
it, or leave it bookable if practice rounds during squad practice are fine.

Decision: `TODO`

## Admins

At least two, on the same institutional email domain, per the two-admin rule.

| Name | Email | Role |
|---|---|---|
| `TODO` | `TODO` | admin |
| `TODO` | `TODO` | admin |
