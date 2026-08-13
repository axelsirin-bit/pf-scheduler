import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_check")
    .select("message")
    .single();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <p className="text-lg">
        {error ? `Error: ${error.message}` : data.message}
      </p>
    </main>
  );
}
