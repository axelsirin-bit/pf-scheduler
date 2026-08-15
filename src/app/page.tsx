import { getCurrentUser } from "@/lib/auth";

// Placeholder landing page — proves the auth flow actually works end to
// end. Step 06 replaces this with the real app shell.
export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <p className="text-lg">Signed in as {user.display_name}</p>
      <p className="text-sm text-neutral-500">
        {user.school?.name} — {user.roles.join(", ")}
      </p>
    </main>
  );
}
