# Step 00 — Accounts and environment

## Goal

Get the human's machine and accounts ready. No application code is written in
this step. Do not skip it and do not try to work around missing accounts.

## Why this is first

Every later step assumes Node, Git, a Supabase project, and a Vercel account
exist. Discovering a missing account halfway through step 05 costs more than
doing this up front.

## What Claude Code does

Nothing yet, except check what is already installed and produce the checklist
below with the results filled in.

Run these and report the versions:

    node --version
    npm --version
    git --version

Node must be version 20 or higher. If it is missing or older, stop and give the
human install instructions for their operating system.

## What the human does

Give them these as numbered instructions, then wait for confirmation. Do not
proceed until they confirm each one.

1. **Install Node.js 20 or higher** from nodejs.org if the version check failed.
   Restart VS Code afterward so the terminal picks it up.

2. **Create a GitHub account** if they do not have one, and create a new empty
   private repository named `pf-scheduler`. Do not initialize it with a README,
   since the local folder already has files.

3. **Create a Supabase account** at supabase.com and create a new project.
   - Organization name: their school or their own name, it does not matter.
   - Project name: `pf-scheduler`.
   - Database password: they must generate a strong one and save it in a
     password manager. Tell them explicitly that this is not recoverable and
     that they will need it.
   - Region: pick the one closest to Miami, which is us-east-1.
   - Wait for the project to finish provisioning, which takes a couple of
     minutes.

4. **Collect three values from Supabase** and paste them into the chat. In the
   project, go to Project Settings, then API.
   - Project URL
   - `anon` public key
   - `service_role` secret key

   Tell them plainly: the `anon` key is safe to expose in a browser. The
   `service_role` key is not, it bypasses all security rules, and it must never
   be committed to Git or pasted anywhere public. If they ever paste it into a
   public place, they should rotate it immediately from that same settings page.

5. **Create a Vercel account** at vercel.com and sign in with GitHub. Do not
   import a project yet, that happens in step 01.

6. **Create a Google Cloud project for sign-in.** This one is fiddly, so give
   them the steps carefully:
   - Go to console.cloud.google.com and create a new project named
     `pf-scheduler`.
   - Go to APIs and Services, then OAuth consent screen. Choose External.
     Fill in app name, their email as support contact, and their email as
     developer contact. Save and continue through the remaining screens.
   - Go to Credentials, then Create Credentials, then OAuth client ID. Choose
     Web application.
   - Under Authorized redirect URIs, add the callback URL shown in Supabase
     under Authentication, Providers, Google. It looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Copy the Client ID and Client Secret and paste them into Supabase under
     Authentication, Providers, Google, then enable the provider.

## Acceptance criteria

- Node 20+, npm, and git all report versions.
- The human has confirmed the GitHub repo exists.
- The human has supplied the Supabase URL, anon key, and service role key.
- Google sign-in is enabled in the Supabase dashboard.

`plan/reference/school-config.md` is not a gate here or on any step through
15 — see `plan/reference/decisions.md`, "v1 is school-agnostic starting at
step 04." It only matters once the setup wizard (step 12) is used for real.

## Do not

- Do not write any application code in this step.
- Do not put the service role key anywhere except `.env.local`, which does not
  exist yet and which step 01 will create and gitignore.
- Do not proceed if Google sign-in is not configured. Later steps depend on it
  and diagnosing it under time pressure is worse.

## When done

Update `plan/PROGRESS.md`, set step 00 to done, and record the Supabase project
region and the Node version in the notes column.
