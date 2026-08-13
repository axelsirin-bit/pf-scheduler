# Step 16 — Calendar feed import

## Goal

An admin links their school's calendar feed. The system imports which day type
each date is, which days are not in session, and which days are shortened, and
keeps that current without anyone maintaining it by hand.

## What a feed realistically gives you

Most school systems, including Veracross, Blackbaud, PowerSchool, and Google
Calendar, expose an ICS subscription URL. What comes through reliably is dated
events and all-day events, which usually carry the rotation day label, holidays,
early dismissals, and exam blocks. What almost never comes through is period
start and end times in machine-readable form.

So the honest design is: the feed supplies the calendar, the admin supplies the
period templates once by hand in step 12, and a mapping screen connects the two.
Do not attempt to infer period times from a feed. It will work for one school
and fail silently for the next.

## Tasks

1. **Feed configuration** at `/admin/schedule/feed`: paste an ICS URL, test it,
   see what came back.

2. **Parser** in `src/lib/schedule/ics.ts`. Use a maintained ICS library rather
   than writing a parser. Extract date, summary, all-day flag, and any
   recurrence.

3. **Mapping screen.** Show the distinct event summaries found in the feed and
   let the admin map each one to a day type **and** a schedule variant
   (Standard, Half-Day, Special, Community), to "no school," or to "ignore."
   The variant is what actually selects a period template — see
   `plan/reference/decisions.md` — so a summary like "Upper School Half-Day
   Schedule - Day 2" must resolve to both `Day 2` and `Half-Day`, not day type
   alone. Save the mapping so future syncs apply it automatically, and surface
   any new unmapped summary as an item needing attention rather than guessing.

4. **Preview and diff.** Every import produces an `ics_import_batches` row with
   a computed diff: dates added, dates changed, dates removed. **Nothing is
   written to `calendar_days` until an admin approves the batch.** Show the diff
   in plain terms: "March 14 changes from O3 to no school, which cancels 6 open
   slots and affects 1 confirmed round."

5. **Origin tracking.** Every `calendar_days` row records whether it came from
   the feed or was set manually. A sync never overwrites a manual entry
   silently. It flags the conflict in the diff and lets the admin choose.

6. **Failure behavior.** If the feed is unreachable or unparseable, keep the
   last known good calendar, record the failure on `ics_sources`, and show the
   admin a clear message with the time of the last successful sync. Never show
   an empty week because a sync failed, since an empty week reads as the app
   being broken and destroys trust faster than a stale one.

7. **Scheduled sync** daily via Vercel cron, producing a pending batch. If the
   diff is empty, do nothing and do not notify. If it is not, email the admins
   that a change is waiting for approval.

## Acceptance criteria

- A real ICS feed imports and the mapping screen shows its distinct summaries.
- Approving a batch updates calendar days and regenerates affected future slots.
- Rejecting a batch changes nothing.
- A manual override survives the next sync.
- Unplugging the feed URL leaves the existing calendar intact.
- A diff that would cancel a confirmed round says so explicitly before approval.

## Do not

- Do not auto-apply imports without approval, even when the diff looks trivial.
- Do not attempt to parse period times out of event descriptions.
