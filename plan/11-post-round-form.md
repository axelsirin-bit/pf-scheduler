# Step 11 — Post-round form and completion

## Goal

The judge submits a result and a reason for decision. That submission is the
only thing that marks a round complete and credits participation.

## Why the judge and not the debaters

Self-reported participation is not verification. Routing it through the judge
means the person with no stake in the count is the one who records it, and it
takes ninety seconds from someone who was otherwise idle for the whole round.
This is the mechanism that makes the leaderboard mean something, so the form has
to be short enough that judges actually fill it in.

## Tasks

1. **Form** at `/round/[id]/result`, accessible only to the judge on that round
   and only after the slot's start time has passed.

2. **Fields:**
   - winning team, required
   - which side each team was on, required, since it is needed for the archive
   - reason for decision, required, free text, minimum length enforced at
     something modest like 150 characters so it is a real RFD rather than a
     single word
   - optional per-debater note, one short field each, private to that debater
     and to admins

3. **Submission is final.** Once submitted, the form is read-only. This is
   enforced by the row level security policy from step 03, not by hiding the
   button. Confirm the policy actually blocks an update attempt.

4. **Corrections.** A judge or admin can append a correction, which creates a
   new `round_results` row with `supersedes` pointing at the original. The
   archive shows the latest and links to the superseded one. Nothing is ever
   deleted.

5. **Completion.** On submission, round status becomes `completed`, and all five
   participants become eligible for participation credit.

6. **Reminders.** If a round is confirmed and its slot ended more than a set
   number of hours ago with no result, mark it `awaiting_result` and surface it
   on the judge's own page and on the admin console. Step 17 adds the email.

7. **Abandoned rounds.** A confirmed round with no result after seven days is
   marked `expired` by a scheduled job. It credits nobody and appears in the
   admin console so a coach can see if this is happening a lot.

## Acceptance criteria

- A judge submits a result and the round shows completed for all participants.
- A debater on the round cannot open the result form.
- An attempt to update a submitted result via a direct API call fails at the
  database level. Test this explicitly with a raw request, not just by checking
  that the UI hides the control.
- A correction appears as a new row and the original remains readable.
- Participation counts increment only on completion, not on confirmation.

## Do not

- Do not add speaker points, rankings, or ratings. See
  `plan/reference/decisions.md`.
- Do not let admins edit a submitted RFD.
