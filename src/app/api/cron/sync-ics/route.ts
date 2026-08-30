import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncIcsSource } from '@/lib/db/ics-import'

// Daily cron (task 7), configured in vercel.json to hit this route once a
// day. No session at all — Vercel's scheduler calls this directly, not a
// signed-in admin — so it uses the service role client, same reasoning
// as slots.ts's upsertSlotsForRange defaulting to the admin client for
// its own cron/script callers.
//
// Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically for
// routes listed in vercel.json's `crons`, using the project's own
// CRON_SECRET env var — this check is what stops anyone else from
// hitting the route and forcing an off-schedule sync.
//
// Empty diff: nothing happens, no notification (task 7). Non-empty diff:
// a pending batch is created — emailing the admins that it's waiting is
// step 17's job, same as every other notification in this project;
// there's nothing to build here yet, only somewhere to plug it in later.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: sources, error } = await supabase.from('ics_sources').select('id, school_id').eq('is_active', true)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = []
  for (const source of sources ?? []) {
    const outcome = await syncIcsSource(source.id, supabase)
    results.push({
      sourceId: source.id,
      schoolId: source.school_id,
      ...(outcome.ok
        ? { ok: true, batchId: outcome.batchId, entryCount: outcome.entryCount, unmappedCount: outcome.unmappedCount }
        : { ok: false, error: outcome.error }),
    })
  }

  return NextResponse.json({ synced: results.length, results })
}
