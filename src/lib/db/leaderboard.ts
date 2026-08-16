// v_participation and v_leaderboard already exist (step 02) and already do
// everything this step's rules ask for — term-scoped, weekly cap applied in
// SQL, judge/debater counted separately, only completed rounds, expected
// count read from the school row. Verified against real data twice already
// (step 07's three-completed-rounds test, step 11's confirmed-vs-completed
// credit timing test). Nothing here recomputes any of that.
//
// v_leaderboard can't be embedded under profiles via PostgREST's normal
// nested-select syntax — that requires a real foreign key, and a view's
// user_id column doesn't carry one. So this is two queries plus a JS merge,
// not one embed: profiles (every active member, so someone with zero
// rounds this term still gets a row) left-joined in application code
// against v_leaderboard filtered to one term. Querying v_leaderboard
// directly and filtering by term_id would silently drop anyone who has
// never played at all, since their only row in that view has term_id null.

export type NamedEntry = {
  userId: string
  displayName: string
  debateRounds: number
  judgeRounds: number
  totalRounds: number
}

export type ShapedEntry = NamedEntry & { onTrack: boolean }

export type ShapedLeaderboard = {
  expectedRoundsPerTerm: number
  onTrack: ShapedEntry[] // alphabetical by name, not ranked
  topFive: ShapedEntry[] // ranked
  currentUser: ShapedEntry | null
}

// Pure: no database access. onTrack is computed here from totalRounds vs.
// expectedRoundsPerTerm, not trusted from the view's own on_track column —
// keeps this function testable with plain counts and immune to a mismatch
// between the two if they were ever computed differently. Ties in the top
// five break alphabetically, since nothing else was specified.
export function shapeLeaderboard(entries: NamedEntry[], userId: string, expectedRoundsPerTerm: number): ShapedLeaderboard {
  const shaped: ShapedEntry[] = entries.map((e) => ({ ...e, onTrack: e.totalRounds >= expectedRoundsPerTerm }))

  const onTrack = shaped.filter((e) => e.onTrack).sort((a, b) => a.displayName.localeCompare(b.displayName))

  const topFive = [...shaped]
    .sort((a, b) => b.totalRounds - a.totalRounds || a.displayName.localeCompare(b.displayName))
    .slice(0, 5)

  const currentUser = shaped.find((e) => e.userId === userId) ?? null

  return { expectedRoundsPerTerm, onTrack, topFive, currentUser }
}

// Impure. termId null means no current term is configured — skips the
// v_leaderboard query entirely rather than scoping to nothing, since
// there's nowhere meaningful to scope to.
export async function getLeaderboard(schoolId: string, termId: string | null, userId: string): Promise<ShapedLeaderboard> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const [{ data: profiles, error: profilesError }, { data: rows, error: rowsError }, { data: school, error: schoolError }] =
    await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('school_id', schoolId).eq('is_active', true),
      termId
        ? supabase
            .from('v_leaderboard')
            .select('user_id, debate_rounds, judge_rounds, total_rounds')
            .eq('school_id', schoolId)
            .eq('term_id', termId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('schools').select('expected_rounds_per_term').eq('id', schoolId).single(),
    ])

  if (profilesError) throw profilesError
  if (rowsError) throw rowsError
  if (schoolError) throw schoolError

  const byUserId = new Map((rows ?? []).map((r) => [r.user_id, r]))

  const entries: NamedEntry[] = (profiles ?? []).map((p) => {
    const row = byUserId.get(p.id)
    return {
      userId: p.id,
      displayName: p.display_name,
      debateRounds: row?.debate_rounds ?? 0,
      judgeRounds: row?.judge_rounds ?? 0,
      totalRounds: row?.total_rounds ?? 0,
    }
  })

  return shapeLeaderboard(entries, userId, school?.expected_rounds_per_term ?? 8)
}

export type ParticipationBreakdownEntry = {
  userId: string
  fullName: string
  debateRounds: number
  judgeRounds: number
  totalRounds: number
  onTrack: boolean
}

// Admin-only (page-level RequireRole gates this, not this function) — the
// one place full_name belongs, per ui-conventions.md.
export async function getParticipationBreakdown(
  schoolId: string,
  termId: string | null
): Promise<{ expectedRoundsPerTerm: number; entries: ParticipationBreakdownEntry[] }> {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const [{ data: profiles, error: profilesError }, { data: rows, error: rowsError }, { data: school, error: schoolError }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).eq('is_active', true),
      termId
        ? supabase
            .from('v_leaderboard')
            .select('user_id, debate_rounds, judge_rounds, total_rounds')
            .eq('school_id', schoolId)
            .eq('term_id', termId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('schools').select('expected_rounds_per_term').eq('id', schoolId).single(),
    ])

  if (profilesError) throw profilesError
  if (rowsError) throw rowsError
  if (schoolError) throw schoolError

  const byUserId = new Map((rows ?? []).map((r) => [r.user_id, r]))
  const expectedRoundsPerTerm = school?.expected_rounds_per_term ?? 8

  const entries: ParticipationBreakdownEntry[] = (profiles ?? [])
    .map((p) => {
      const row = byUserId.get(p.id)
      const totalRounds = row?.total_rounds ?? 0
      return {
        userId: p.id,
        fullName: p.full_name,
        debateRounds: row?.debate_rounds ?? 0,
        judgeRounds: row?.judge_rounds ?? 0,
        totalRounds,
        onTrack: totalRounds >= expectedRoundsPerTerm,
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return { expectedRoundsPerTerm, entries }
}
