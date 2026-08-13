# Step 05 — Auth and roster gating

## Goal

A person can sign in with Google. If their email is on a school's roster invite
list, they get a profile at that school with the roles the admin assigned. If it
is not, they are refused with a clear message and no account is created.

## Why roster gating rather than domain restriction

Domain restriction breaks the moment a school uses a shared domain, a student
signs in with a personal account, or a coach uses a district address. Matching
against a pre-approved list uploaded by an admin is both stricter and more
flexible, and it gives the admin a single place to control access.

## Tasks

1. **Sign-in page** at `/sign-in`. One Google button. No email/password, no
   magic links, no sign-up form. If someone is already signed in, redirect them
   to the app.

2. **Auth callback route** at `/auth/callback` that exchanges the code for a
   session, as required by the Supabase SSR flow.

3. **The gating trigger.** A Postgres trigger on `auth.users` insert that:
   - looks up `roster_invites` by `lower(email)`
   - if found and unclaimed, creates a `profiles` row with that school_id and
     those roles, and marks the invite claimed with a timestamp
   - if not found, raises an exception so the user row is not created

   Doing this in a trigger rather than in application code means there is no
   window in which an authenticated user exists without a profile, and no code
   path that forgets to check.

4. **Refusal handling.** When the trigger rejects, the callback lands on
   `/sign-in?error=not-on-roster`. The message should say plainly that the
   account is not on any team roster and to contact their coach, and should name
   the email address they tried, so they can tell that they used the wrong
   Google account. Do not say which schools exist or hint at valid addresses.

5. **Middleware** at `src/middleware.ts` that refreshes the session on every
   request and redirects unauthenticated users to `/sign-in` for everything
   except `/sign-in`, `/auth/callback`, and static assets.

6. **`getCurrentUser()` helper** in `src/lib/auth.ts` that returns the profile
   with school and roles, and throws if called without a session. Every server
   component that needs identity uses this rather than reading Supabase directly.

7. **Sign out** action, reachable from the app shell in step 06.

8. **Age gate.** The roster invite record has a field the admin sets confirming
   the invitee is 13 or older. Invites without it cannot be created. See
   `plan/reference/decisions.md` for why this is enforced at the invite rather
   than at sign-in.

## Acceptance criteria

- A Google account whose email is on the roster signs in and lands in the app
  with the correct school and roles.
- A Google account not on any roster sees the refusal message and no row is
  created in `auth.users` or `profiles`. Verify both tables directly.
- Signing out and back in works and does not duplicate the profile.
- An unauthenticated request to any app route redirects to `/sign-in`.
- The invite is marked claimed and a second attempt to claim it does not create
  a second profile.

## Verification the human should do

Try to sign in with a personal Gmail account that is not on the roster. Confirm
the refusal. Then have the admin add that address as an invite and try again,
and confirm it now works. That round trip is the whole access control model.

## Common failure modes

- Raising an exception in an `auth.users` trigger can leave a partial user row
  in some Supabase versions. Verify explicitly that no orphan row remains, and
  if one does, add a cleanup path rather than ignoring it.
- The Google redirect URI must match exactly, including trailing slashes. A
  mismatch produces an opaque Google error page.
- Server Components cannot set cookies. Session refresh has to happen in
  middleware or a route handler. This trips up nearly every Next.js and Supabase
  integration.

## Do not

- Do not add open sign-up.
- Do not let a user choose their own school.
- Do not use the service role client anywhere in the sign-in path except inside
  the trigger, which runs in the database and does not use it at all.
