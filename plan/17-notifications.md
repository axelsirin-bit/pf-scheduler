# Step 17 — Notifications and reminders

## Goal

The small number of emails that keep the loop closed, and nothing else.

## The principle

Every notification is a chance for someone to mute the app. Send only messages
that prevent a failure. There are four.

## The four emails

1. **Round confirmed.** To all five participants, immediately. Contains date,
   time, period, room, and who else is in it. This is the one that prevents
   people showing up to the wrong place.

2. **Round tomorrow.** To all five participants, the evening before. Same
   details. Only for rounds confirmed more than a day in advance.

3. **Result needed.** To the judge, a few hours after the slot ends if no result
   exists. Once, then again after two days, then never. Copy the admins on the
   second one.

4. **Round cancelled.** To the remaining participants when someone leaves a
   confirmed round or a calendar change cancels the day.

Admins additionally get: the invite rate-limit approval request from step 15,
and the pending calendar import from step 16.

## Tasks

1. Use Resend or Postmark. Add the API key as an environment variable in both
   `.env.local` and Vercel.

2. **Templates** in `src/lib/email/`. Plain text with a minimal HTML version.
   Subject lines that are readable in a notification preview: "PF round
   confirmed: Wed P3, Room 214" rather than "Notification from PF Scheduler."

3. **Sending** happens in server actions for immediate emails and in cron route
   handlers for scheduled ones. Never in a Client Component.

4. **Idempotency.** A `notifications_sent` table keyed on round, kind, and
   recipient. Check before sending. A cron that runs twice must not email twice.

5. **Per-user preference,** one toggle: all emails, or only ones about rounds I
   am in. Default to the latter for everyone except admins. Do not build a
   granular preference matrix.

6. **A development mode** that logs emails to the console instead of sending, so
   testing does not spam the team. Gate it on an environment variable, and make
   sure it is off in production, verified by a deliberate test send.

## Acceptance criteria

- Confirming a round sends exactly one email per participant.
- Running the reminder cron twice sends nothing the second time.
- A user with the restricted preference receives round emails and nothing else.
- Development mode sends nothing externally.
- All emails render legibly in a phone mail client, checked on a real phone.

## Do not

- Do not add SMS. It costs money and needs consent handling that is not worth it.
- Do not add a weekly digest, a leaderboard email, or anything promotional.
- Do not email people about rounds they are not in.
