'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { linkCalendarFeed } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

const URL_PATTERN = /^https?:\/\/.+/i

export async function saveFeedUrl(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const url = (formData.get('feedUrl') as string)?.trim()
  if (!url || !URL_PATTERN.test(url)) {
    return { ok: false, error: 'Enter a real feed URL, starting with https://.' }
  }

  try {
    await linkCalendarFeed(user.school_id, url)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/calendar-source')
  revalidatePath('/admin')
  return { ok: true }
}
