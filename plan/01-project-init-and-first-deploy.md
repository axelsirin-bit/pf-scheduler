# Step 01 — Project init and first deploy

## Goal

A running Next.js app, connected to Supabase, committed to GitHub, and live on a
Vercel URL. It shows one page that reads a value from the database. Nothing more.

## Why deploy this early

Deployment is the part that scares people, so it should stop being scary on day
one rather than in week six. From here on, every step ends with a push that goes
live, and any deploy failure is caused by the small change just made rather than
by six weeks of accumulated unknowns.

## Tasks

1. Initialize the Next.js app in the current folder. Use TypeScript, the App
   Router, Tailwind, ESLint, and the `src/` directory. Do not overwrite the
   existing `CLAUDE.md`, `README-FIRST.md`, or `plan/` folder.

2. Create `.env.local` with:

       NEXT_PUBLIC_SUPABASE_URL=
       NEXT_PUBLIC_SUPABASE_ANON_KEY=
       SUPABASE_SERVICE_ROLE_KEY=

   Fill in the values the human supplied in step 00. Confirm `.env.local` is in
   `.gitignore` before the first commit. Check this by running
   `git check-ignore .env.local` and confirming it prints the filename.

3. Install `@supabase/supabase-js` and `@supabase/ssr`.

4. Create three Supabase clients in `src/lib/supabase/`:
   - `client.ts` for Client Components, using the anon key.
   - `server.ts` for Server Components and route handlers, using the anon key
     and cookie-based session handling.
   - `admin.ts` for the service role client. Add a comment at the top stating
     that this file must never be imported into a Client Component, and add a
     runtime guard that throws if `typeof window !== 'undefined'`.

5. Install the Supabase CLI as a dev dependency and run `supabase init` so the
   `supabase/` folder and migrations directory exist. Link it to the remote
   project with `supabase link`. The human will need to supply the project ref
   and database password, so ask for them.

6. Create one migration that makes a single table `health_check` with columns
   `id` and `message`, and insert one row. This exists only to prove the
   connection works and will be dropped in step 02.

7. Build a single page at `/` that fetches that row server-side and renders the
   message. No styling beyond default Tailwind.

8. Commit and push to GitHub.

9. Walk the human through importing the repo into Vercel, and tell them to add
   the three environment variables in the Vercel project settings before the
   first deploy. Vercel does not read `.env.local`.

## Files created

    src/lib/supabase/client.ts
    src/lib/supabase/server.ts
    src/lib/supabase/admin.ts
    src/app/page.tsx
    supabase/migrations/<timestamp>_health_check.sql
    .env.local          (gitignored)
    .env.example        (committed, with empty values, so the keys are documented)

## Acceptance criteria

- `npm run dev` serves a page at localhost:3000 showing the message from the
  database.
- `npm run build` completes with no errors.
- `git check-ignore .env.local` prints `.env.local`.
- The Vercel URL loads and shows the same message as localhost.
- Searching the repo for the service role key value returns nothing outside
  `.env.local`.

## Verification the human should do

Open the Vercel URL on their phone, off the school wifi. If it loads, the
deployment pipeline is real. Then have them break it on purpose: change the
message in the database through the Supabase table editor, refresh the Vercel
URL, and confirm it changes. That proves the deployed app is talking to the same
database as local development.

## Common failure modes

- Environment variables added to Vercel after the first deploy do not apply
  until a redeploy. If the deployed page errors on env vars, trigger a redeploy.
- `NEXT_PUBLIC_` prefixed variables are exposed to the browser by design. The
  service role key must not have that prefix. If it does, remove the prefix and
  rotate the key.
- If `supabase link` fails, it is almost always the database password. Have the
  human reset it in the dashboard rather than guessing.

## Do not

- Do not add authentication yet.
- Do not build any UI beyond the one page.
- Do not create the real schema yet, that is step 02.
