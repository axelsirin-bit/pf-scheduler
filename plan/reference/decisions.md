# Decisions and deliberate exclusions

Read this before adding any feature. Everything here was considered and left out
on purpose. If a feature on this list seems obviously useful, that is expected,
because most of them are useful. They are excluded for reasons that are not
visible from inside the code.

If the human asks for something on this list, say that it is on the exclusion
list and why, then do what they decide. This file is a check against drift, not
a veto over the person building the thing.

---

## Excluded: automatic room assignment

Assigning rooms requires knowing which rooms are booked, which lives in the
school's facilities system, and no API access to it is available. Any workaround
guesses, and a schedule tool that sends two teams to an occupied room once is a
schedule tool nobody trusts again.

Instead: a maintained list of rooms usually free during each block, plus a free
text field. Same result, no failure mode.

## Excluded: file uploads of any kind

Storing round video means hosting costs, upload failures on school wifi, and
holding an index of recorded minors across institutions. Google Drive already
solves permissions correctly and the school already runs on it.

Links only, restricted to Google Drive and Docs domains. This is not negotiable
and does not become acceptable "just for speech docs."

## Excluded: automatic partner and opponent matching

People choose who they debate. Every version of automated pairing produces
matches people decline, which is worse than no suggestion at all. The app shows
who is available and makes joining one click. That is the entire matching
feature.

## Excluded: speaker points, records, win rates, and rankings

The participation board measures showing up. Adding performance metrics turns it
into a ranking of who is good, which changes who is willing to sign up, in the
wrong direction. The archive records who won a practice round because it is
useful context for the RFD, and that number appears nowhere aggregated.

## Excluded: a single ranked leaderboard

A pure ranking tells the bottom two thirds of the team that they are losing at
practicing, and those are the people the schedule exists to reach. The board has
an on-track line most people can be above, plus a short top list. See step 13.

## Excluded: editing or deleting a submitted result

Append-only, enforced by row level security rather than by hiding the button.
Corrections are new rows that supersede. An admin who can quietly rewrite an RFD
is a hole in the only verification mechanism the system has.

## Excluded: self-serve school registration

Approval is manual, verified against the requesting admin's Tabroom coach
profile. At the realistic scale, a few schools in year one, five minutes of
human checking per school is the strongest available control and costs almost
nothing.

## Decision: v1 is school-agnostic starting at step 04

Early in the build, steps 04 through 14 (old numbering) were going to be
seeded and verified directly against this project's real target school —
real bell schedule, real rotation, real rooms, hand-typed into a seed script
and migrations. That's reversed now. Starting at step 04, nothing in the app
is built or tested against any real school's facts. Steps 04 through 11, and
13 through 15, build and verify against a fictional fake school invented for
the purpose (see step 04). The only path any school's real data — including
the real school this app is ultimately for — ever enters the system is the
setup wizard (step 12), used the same way by every school, including the
first one.

This is why the wizard moved from its original position at the end of the
build, after the admin console, to right after step 11, as soon as the core
round flow works. It used to be framed as multi-school machinery that could
wait indefinitely; it is now the only onboarding path there is, for the
first school as much as any later one, so it can't sit behind features
(leaderboard, archive, admin console) that a real school doesn't strictly
need before it can be used.

A consequence: `plan/reference/school-config.md` no longer gates step 04.
Real facts already gathered there (bell schedule, the 2026-27 calendar CSV,
an unconfirmed guess at Half-Day/Special/Community cutoffs) are notes for
whoever runs the wizard for that real school later, not inputs to any
migration or seed script.

## Excluded: users under 13

Enforced at the invite, where an admin affirms it, rather than at sign-in where
a student would self-report. Users under 13 bring COPPA into play, which is a
real regime with real requirements that this project is not equipped to meet.

## Excluded: realtime updates

Refresh is sufficient at this scale. Supabase realtime adds a category of bug
that is not worth it for a tool with a few dozen concurrent users.

## Excluded: SMS, digests, and promotional email

Four transactional emails, listed in step 17. Every additional message is a
reason to mute the app.

## Excluded: comments, discussion threads, and direct messaging

The team already has somewhere to talk. Adding a second place splits the
conversation and creates moderation obligations.

## Excluded: a marketing site, billing, and plans

Not a business. If it ever becomes one, that is a different project with
different obligations.

---

## Deferred, not excluded

These may be worth building later. Do not build them without asking.

- Attendance patterns over time, per person, for coaches
- Exporting a term's participation to CSV
- A view of who has never debated whom, to spread out matchups
- Integration with Tabroom for tournament roster context

## Open questions to resolve with the human

- Who is the adult data owner once the app leaves the first school? This has to
  have a name before a second school is onboarded.
- `round_notes` privacy model — see below.
- `school_requests` access control — see below.

---

## Deferred to step 12: round_notes and school_requests access control

Step 03 enabled row level security on every table, including these two, but
deliberately did not give either a real policy set — both need a decision
that belongs with step 12's registration/onboarding work, not with the
generic RLS pass.

**`round_notes`.** A note "about" a specific user (`about_user`), attached to
a round result. Not clear yet whether the person the note is about should be
able to read it themselves, or whether it's judge/admin-only feedback that
never reaches the debater it's about. Current policy: admins can read
(scoped to their school), nobody can write through the API at all — writes
will need a real path once this is decided, probably alongside the post-round
form (step 11) or the wizard (step 12).

**`school_requests`.** Has no `school_id` column by design — it exists
before any school does, filled out by a visitor with no account and no
session. The standard "own school" RLS pattern doesn't apply. Current state:
RLS enabled, zero policies, meaning only the service role can touch it.
Step 12 needs to define who can insert one (presumably: anyone, unauthenticated,
through a public form — probably a server route using the service role rather
than a client-side insert policy, to avoid exposing an open anonymous-insert
policy on a table with no rate limiting) and who can read the queue (there is
no "platform operator" role in `app_role` today — that may need to be a new
concept, or handled entirely outside the app for now).

---

## Resolved: rotation continuity (2026-08-12)

The rotation runs continuously across every normal weekend and holiday,
wrapping Day 4 to Day 1 as usual. `rotation_resets_weekly` on `schools` is
`false`. There is exactly one deliberate reset in the 2026-27 calendar:
December 9, 2026 is Day 2, and the next school day, January 4, 2027, restarts
at Day 1 instead of continuing to Day 3, because winter break is long enough
that the school resets the cycle at the start of second semester. This is a
one-time exception baked into the 2026-27 calendar data
(`plan/reference/re-upper-school-calendar-2026-27.csv`), not a rule the
schedule engine computes — see the next entry. This is a fact about the real
school, for whenever it's onboarded through the wizard (step 12); step 04's
fake school has its own made-up calendar and does not use this CSV.

## Correction: PF blocks are not tied to the day-type rotation

Early drafts assumed each rotation code (O1..E4 / Day 1-4) needed its own
period template, because the block times looked like they were following the
bell schedule. They are not. The eight PF time blocks (07:30-08:20 through
17:10-18:10) are fixed windows chosen for debate practice, not literal class
periods, and availability is self-reported per person regardless of what
class happens to be running in that window for them.

So there is one fixed period template ("Standard") applied to every school
day, plus one variant template each for Half-Day, Special, and Community
schedules. The Day 1-4 rotation label matters only for whether a date is a
school day at all (via the calendar import), never for choosing a template.
What changes the template is the schedule variant on a given date, carried
per-date in the calendar CSV/feed alongside the day code. See
`plan/reference/school-config.md`, "Schedule variants," for which blocks are
valid under each one.

A consequence: since an authoritative per-date calendar is always the source
(the fake school's seeded calendar during steps 04-11, a real school's wizard
entry or live feed from step 12/16 onward), the schedule engine does not
compute day codes from an anchor plus a rotation sequence. It reads them.
`day_types.sequence_pos` and the anchor-walk described in the original step
07 draft were dropped for this reason — see step 07 for the corrected model.
