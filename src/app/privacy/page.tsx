import Link from 'next/link'

// Public, no session required, same as /sign-in and /terms. Written to be
// true of the app itself, not of any one school — see CLAUDE.md, "v1 is
// school-agnostic starting at step 04." No school name, no specific person's
// name, nothing that would need to change when a second school signs up.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8 text-sm leading-relaxed text-neutral-800">
      <div>
        <Link href="/sign-in" className="text-xs underline">
          ← Back to sign in
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Privacy</h1>
        <p className="mt-1 text-neutral-600">What this app collects, who can see it, and how to have it removed.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">What we collect</h2>
        <ul className="list-disc pl-5">
          <li>Your first and last name and email address, from your coach&apos;s roster invite.</li>
          <li>Which practice slots you mark yourself available for, and which rounds you&apos;re part of.</li>
          <li>Round results: who won, which side each team argued, and the judge&apos;s written reason for the decision.</li>
          <li>Any video or speech document links you or a teammate add to a round — these are links to files in your school&apos;s own Google Drive, not files stored by this app.</li>
          <li>Basic usage information the hosting provider and database provider log automatically (like sign-in timestamps), the same as almost any website.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">What we never collect</h2>
        <ul className="list-disc pl-5">
          <li>No video or audio files. The app only ever stores a link to a file that lives in Google Drive.</li>
          <li>No file uploads of any kind.</li>
          <li>No location data, no contact list access, no data from any account other than the one your coach invited.</li>
          <li>No data is sold, and none is shared with any company for advertising.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Who can see what</h2>
        <p>
          Everyone at your school can see your first name and last initial, and which rounds you&apos;ve been part of. Your
          full name and email address are visible only to admins at your school. A room assigned to a round is visible
          only to that round&apos;s participants and to admins — not to the rest of the school. Nothing about you is ever
          visible to a different school using this app; every school&apos;s data is kept completely separate.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">How long we keep it</h2>
        <p>
          Your information is kept for as long as your account is active on your school&apos;s roster. Completed round
          results are kept permanently once submitted, the same way a tournament&apos;s results would be — they form the
          team&apos;s record and the school&apos;s leaderboard. A submitted result is never edited or deleted; a correction
          is recorded as a new entry alongside the original, not a change to it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Requesting deactivation</h2>
        <p>
          If you want your account deactivated — for example, when you graduate or leave the team — ask your coach or an
          admin at your school to do it from the admin console. A deactivated account can no longer sign in, but the
          round history it&apos;s already part of stays visible to the rest of the team, the same way a graduated
          teammate&apos;s name would stay on old tournament results.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Questions</h2>
        <p>Contact your school&apos;s admin — usually your coach — with any question about your data.</p>
      </section>
    </main>
  )
}
