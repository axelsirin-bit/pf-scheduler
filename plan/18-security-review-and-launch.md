# Step 18 — Security review, privacy, launch, and handoff

## Goal

Confirm the app is safe to put in front of the team, write the documents that
have to exist before a second school joins, and make sure the project survives
the person who built it.

## Part one: security review

Work through `plan/reference/verification-checklist.md` completely and record
the result of each item in `plan/PROGRESS.md`. Do not mark an item passed
without actually performing it.

The five that matter most, restated because they are the ones most likely to be
skimmed:

1. **Cross-tenant read.** Authenticated as a Test Academy user, attempt to read
   every table belonging to the real school by direct id. Every one returns
   nothing. Do this with raw API calls, not through the UI.

2. **Room exposure.** Confirm a confirmed round's room is absent from the
   network payload for non-participants, not merely hidden by CSS or a
   conditional render.

3. **Result immutability.** Attempt to update and delete a submitted
   `round_results` row as its author, as another judge, and as an admin. All
   three fail at the database.

4. **Service role key.** Search the entire repository and the built output for
   the key value. Confirm it appears nowhere. Confirm no file importing
   `admin.ts` is reachable from a Client Component.

5. **Roster gate.** An address not on any roster cannot create an account, and
   no orphan row remains in `auth.users` after a rejected attempt.

Also: enable Supabase's leaked password protection and rate limits, set the
Vercel deployment to production branch only, and confirm every cron route is
protected by a secret header.

## Part two: privacy documents

These have to exist before anyone outside the team uses the app.

1. **Privacy policy** at `/privacy`, linked from the sign-in page. In plain
   language: what is collected (name, school email, availability, round records,
   links to files stored elsewhere), who can see it (people at your own school
   only), what is never collected (no files, no location, no browsing), how long
   it is kept, and how to get an account deactivated.

2. **Terms** at `/terms`, short. Includes the 13-and-over requirement.

3. **A one page document for coaches** explaining what the app stores about
   their students and who can see it. This is what a coach forwards to an
   administrator when asked, and having it ready is the difference between a
   yes and a maybe.

## Part three: launch

1. Pilot with a small group first, ideally six to ten people including two
   judges, for two weeks. Fix what breaks before opening it to the squad.

2. Then the full PF squad for a semester. During that time, do not onboard
   another school.

3. Track one number: rounds completed per week. That number is the pitch to any
   other school, and without it there is no pitch.

4. Watch for the two predictable failures: people not filling in the room, and
   judges not submitting results. Both are process problems that show up as
   product problems. If the result submission rate is below about eighty
   percent, the form is too long, not the judges too lazy.

## Part four: handoff

1. **README** with local setup from a clean machine, environment variables,
   how to run migrations, how to deploy, and how to add a school.

2. **RUNBOOK** covering the things that will actually go wrong: the calendar
   feed breaking, a stuck round, a person who needs their account deactivated,
   rotating a leaked key, restoring from a Supabase backup.

3. **Access.** More than one person holds the Supabase, Vercel, and GitHub
   credentials, and at least one is an adult at the school. A tool whose
   credentials live with one graduating senior is a tool with an expiry date.

4. **Get an underclassman into the codebase before the end of the first
   semester.** Have them do a real step from this plan with supervision, not a
   walkthrough.

## Acceptance criteria

- Every item in the verification checklist is recorded with a result.
- `/privacy` and `/terms` exist and are linked from sign-in.
- The README gets a second person from clone to running locally without help.
- Credentials are held by at least two people, one of them an adult.
