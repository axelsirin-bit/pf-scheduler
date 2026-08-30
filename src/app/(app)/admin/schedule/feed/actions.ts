'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { saveFeedUrl, saveSummaryMapping, syncIcsSource, type MappingAction } from '@/lib/db/ics-import'
import { fetchIcsFeed, type ParsedIcsEvent } from '@/lib/schedule/ics'
import { getSchoolTerms } from '@/lib/db/onboarding'
import { todayInTimezone } from '@/lib/schedule/week-bounds'

export type ActionResult = { ok: true } | { ok: false; error: string }

const URL_PATTERN = /^https?:\/\/.+/i

export async function saveFeedUrlAction(url: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const trimmed = url.trim()
  if (!trimmed || !URL_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Enter a real feed URL, starting with https://.' }
  }

  try {
    await saveFeedUrl(user.school_id, trimmed)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/schedule/feed')
  return { ok: true }
}

export type TestFeedResult =
  | { ok: true; totalEvents: number; distinctSummaries: string[] }
  | { ok: false; error: string }

// Ephemeral — task 1's "test it, see what came back." No batch is
// created and nothing is written; this only proves the URL is reachable
// and shows what's in it, over the same date range a real sync would use
// (the school's current-and-upcoming terms) so the summaries shown here
// actually match what a sync would encounter.
export async function testFeedAction(url: string): Promise<TestFeedResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (!user.school) return { ok: false, error: 'No school found.' }

  const trimmed = url.trim()
  if (!trimmed || !URL_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Enter a real feed URL, starting with https://.' }
  }

  const terms = await getSchoolTerms(user.school_id)
  const today = todayInTimezone(user.school.timezone)
  const upcoming = terms.filter((t) => t.endsOn >= today)
  if (upcoming.length === 0) {
    return { ok: false, error: 'No current or upcoming term is configured, so there is no date range to test against.' }
  }

  const rangeStart = upcoming.reduce((min, t) => (t.startsOn < min ? t.startsOn : min), upcoming[0].startsOn)
  const rangeEnd = upcoming.reduce((max, t) => (t.endsOn > max ? t.endsOn : max), upcoming[0].endsOn)

  const result = await fetchIcsFeed(trimmed, user.school.timezone, rangeStart, rangeEnd)
  if (!result.ok) return { ok: false, error: result.error }

  const distinctSummaries = [...new Set(result.events.map((e: ParsedIcsEvent) => e.summary))].sort()
  return { ok: true, totalEvents: result.events.length, distinctSummaries }
}

export async function saveMappingAction(
  sourceId: string,
  summary: string,
  action: MappingAction,
  dayTypeCode: string,
  variantId: string
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  if (action === 'school_day' && (!dayTypeCode.trim() || !variantId)) {
    return { ok: false, error: 'A school day needs both a day type and a schedule variant.' }
  }

  try {
    await saveSummaryMapping(sourceId, summary, {
      action,
      dayTypeCode: action === 'school_day' ? dayTypeCode.trim() : undefined,
      variantId: action === 'school_day' ? variantId : undefined,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/schedule/feed')
  return { ok: true }
}

export type SyncNowResult = { ok: true; batchId: string | null; entryCount: number } | { ok: false; error: string }

export async function syncNowAction(sourceId: string): Promise<SyncNowResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const result = await syncIcsSource(sourceId, supabase)
  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/admin/schedule/feed')
  return { ok: true, batchId: result.batchId, entryCount: result.entryCount }
}
