# Runbook

Procedures for the things most likely to actually go wrong, for whoever is
holding the Supabase/Vercel/GitHub credentials at the time. Each section
assumes you're signed in to the Supabase dashboard, the Vercel dashboard, and
have this repo checked out locally with `.env.local` set up (see `README.md`).

## Broken or stuck calendar feed

A school linked a calendar feed (`/admin/schedule/feed`) and syncing has
stopped working or produced something wrong.

1. **Check the source's status.** On `/admin/schedule/feed`, the source
   shows its `last_status` and `last_error` from the most recent sync
   attempt. A fetch failure (unreachable URL, feed taken down, auth expired
   on the school's end) shows up there directly — the sync writes nothing
   and creates no batch when the fetch itself fails, so a bad feed can't
   silently corrupt existing data.
2. **Check for a pending batch that was never approved.** A sync that
   succeeds but produces changes always waits for an admin to approve or
   reject it at `/admin/schedule/feed/batches/[id]` — nothing from a feed
   ever writes to `calendar_days` on its own. If schedule changes seem
   "stuck," look here first; it's usually an unreviewed batch, not a broken
   sync.
3. **Retry a failed sync manually.** Fix whatever's wrong on the school's
   end (a corrected URL, a feed made public again), then click "Sync now"
   on `/admin/schedule/feed` rather than waiting for the next scheduled run
   (`sync-ics` runs daily at 11:00 UTC, per `vercel.json`).
4. **Reject a bad batch.** If a sync produced a batch with wrong-looking
   changes (a misconfigured feed, a holiday miscoded as a school day),
   reject it from the batch page. Rejecting leaves every target date
   byte-for-byte unchanged — nothing is partially applied.
5. **A single date fighting the feed.** If one date needs to stay
   permanently different from what the feed says (a school-specific
   exception), open that date and mark it manually — a manually-set date is
   excluded from all future bundled approvals for that date and needs an
   explicit per-date override to change again, so the feed can't quietly
   overwrite it on a later sync.
6. **If nothing above explains it**, check `ics_sources.last_error` directly
   in the Supabase table editor for the raw error text, and check the
   `sync-ics` cron's logs in the Vercel dashboard (Deployments → the
   production deployment → Functions → `/api/cron/sync-ics`) for anything
   that happened outside a manual "Sync now" click.

## A stuck round

A round isn't progressing the way it should — no judge, no result, or
otherwise not resolving.

1. **Figure out which kind of "stuck" it is** from the round's status on
   `/slot/[id]` or `/round/[id]`:
   - **`forming`, missing a debater or judge, and no longer useful** — any
     participant or an admin can cancel it from `/slot/[id]` (the "Cancel"
     action). Cancelling from any status except `cancelled`/`completed`/
     `expired` is allowed; it credits nobody and emails the remaining
     participants.
   - **`confirmed` or `awaiting_result`, round happened, judge hasn't
     submitted a result.** Only the actual judge for that round can submit
     the *first* result — there's no admin override to submit one on their
     behalf, by design (a result is that judge's real account of what
     happened, not an administrative fact). Follow up with the judge
     directly. If the judge genuinely can't submit one (left the team,
     forgot which round, etc.), the only clean resolution is to cancel the
     round — nobody gets credit, which is the honest outcome when no result
     exists.
   - **A result was submitted wrong.** Don't try to fix this by cancelling
     or deleting anything — the judge or an admin can submit a correction
     from the same round's result page. A correction is a new row that
     supersedes the original; the original stays on record.
2. **Know this project's real limitation**: `sweepStaleRounds()`
   (`src/lib/db/round-lifecycle.ts`), which is what would normally flip an
   old `confirmed` round to `awaiting_result` after 24 hours and then to
   `expired` after 7 days with no result, **is not currently wired to any
   scheduled cron** — only the notification cron (`round-reminders`,
   hourly) runs automatically. Nothing currently ages a stale round
   forward on its own. Until that's wired up (or as a standing manual
   habit), run it by hand periodically:
   ```
   node --env-file=.env.local scripts/sweep-stale-rounds.ts
   ```
   This is a real gap worth closing properly rather than living with
   indefinitely — flagging it here so it isn't forgotten.
3. **Direct database intervention** (only if the above genuinely doesn't
   cover it) — e.g. a round wedged in a state the UI can't reach. Use the
   Supabase table editor or a one-off script with the service role key,
   change only `rounds.status` directly (a plain `UPDATE` fires no
   triggers), and write down what you changed and why — this bypasses the
   audit log, which everything else in the admin console writes to
   automatically.

## Deactivating a user

From `/admin/roster`, "Deactivate" (`deactivateMember`, admin only, can't
deactivate yourself).

**What happens immediately:**
- `profiles.is_active` is set to `false`. This can only be changed by an
  authenticated admin's own session — even the service role key is blocked
  from flipping it directly by a database trigger, so this can't happen by
  accident from a script.
- The action is written to `audit_log` automatically (who deactivated whom,
  and when) — this can't be edited or deleted afterward, by anyone,
  including another admin.
- The person is signed out of any live session on their very next page
  load and can no longer sign back in — they'll see "Your account has been
  deactivated" at `/sign-in`.

**What stays exactly as it was:**
- Every round they were ever part of — as debater or judge — stays in the
  archive and the leaderboard, with their real name still attached, the
  same way a graduated teammate's name stays on old tournament results.
- Their submitted results and reasons for decision are untouched; results
  are append-only regardless of the submitter's account status.
- Their row in `profiles` is not deleted. Nothing about them is deleted at
  all — deactivation is a flag, not a removal.

**What's reversible:** "Reactivate" on the same roster page (`reactivateMember`)
flips `is_active` back to `true` and they can sign in again immediately.
There's no data to restore, because nothing was ever removed.

## Rotating a leaked API key

Do this the moment you suspect any of these leaked (committed to git, pasted
somewhere public, an old collaborator's access you want to cut off) — don't
wait to confirm it's actually been misused.

| Key | Where it's used | How to rotate |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (local), Vercel project env vars (production). Bypasses RLS entirely — treat a leak of this one as the most urgent. | Supabase dashboard → Project Settings → API. Regenerating issues a new key immediately and invalidates the old one. Update `.env.local` and the Vercel env var, then redeploy (a new deployment is needed for Vercel to pick up the change — an env var edit alone doesn't restart the running app). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Vercel, and shipped to every browser (it's public by design — RLS is what actually protects data, not this key's secrecy). Rotate if you suspect the *project itself* is being abused, not from routine exposure. | Same dashboard screen as above; update in both places and redeploy. |
| `CRON_SECRET` | `.env.local`, Vercel project env vars. Vercel automatically sends `Authorization: Bearer <value>` on its own cron requests to any project with an env var named exactly `CRON_SECRET` — no separate cron configuration needed beyond the env var itself. | Generate a new random value (`openssl rand -hex 32` or similar), update it in Vercel, redeploy. |
| `RESEND_API_KEY` | Vercel project env vars only (never needed locally unless you deliberately turn off `RESEND_DEV_MODE`). | Resend dashboard → API Keys → revoke the old one, create a new one, update the Vercel env var, redeploy. |
| Google OAuth client secret | Held entirely inside Supabase's own configuration (Authentication → Providers → Google) — never appears in this app's code or env vars at all. | Google Cloud Console → Credentials → reset the client secret, then paste the new one into Supabase's Google provider settings. Existing signed-in sessions are unaffected; only future OAuth handshakes use the new secret. |
| A developer's personal Supabase access token (`SUPABASE_ACCESS_TOKEN`) | Used only locally, only for CLI operations (`db push`, `verify:rls`, `types:gen`) — never stored anywhere persistent, never deployed. | Revoke it yourself at https://supabase.com/dashboard/account/tokens and generate a new one next time the CLI needs it. Doesn't affect the running app at all. |

After rotating anything that's in Vercel: confirm the new deployment is live
and hit `/sign-in` to make sure the app still comes up before considering
the rotation done.

## Database backup and restore

Supabase takes automatic backups of the project database; exact frequency
and retention depend on the project's plan tier — check **Database →
Backups** in the Supabase dashboard for what's actually available before
you need it, not during an incident.

**To restore:**
1. In the dashboard, go to **Database → Backups** and pick the backup point
   closest to before the problem occurred.
2. Follow the dashboard's restore flow. Read what it tells you carefully —
   depending on the plan and backup type, this may restore in place
   (overwriting current data) or spin up a new project you'd then need to
   re-point this app's env vars at. Confirm which one it's about to do
   before confirming.
3. After any restore, re-run `npm run verify:rls` against the restored
   database and spot-check that `supabase/migrations/` has all been
   applied (a restore should include schema, not just data, but confirm
   rather than assume) — see `README.md` for how.
4. If the restore created a new project rather than restoring in place,
   update every environment (`.env.local` and Vercel) with the new
   project's URL and keys, and treat this the same as a full key rotation
   above.

**Before you need this**: actually test a restore at least once against a
throwaway project, not just read this section. A backup you've never
restored from is a hypothesis, not a plan.
