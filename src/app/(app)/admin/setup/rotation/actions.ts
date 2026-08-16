'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { saveRotation } from '@/lib/db/onboarding'
import type { HolidayInput } from '@/lib/schedule/rotation'

export type ActionResult =
  | { ok: true; schoolDays: number; holidayDays: number }
  | { ok: false; error: string }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseHolidays(raw: string): HolidayInput[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [datePart, ...rest] = line.split(':')
      const date = datePart.trim()
      const note = rest.join(':').trim()
      return { date, note: note || undefined }
    })
}

export async function saveRotationConfig(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const termId = formData.get('termId') as string
  const sequenceRaw = (formData.get('sequence') as string)?.trim()
  const anchorDate = formData.get('anchorDate') as string
  const resetsWeekly = formData.get('resetsWeekly') === 'weekly'
  const holidaysRaw = (formData.get('holidays') as string) ?? ''
  const defaultVariantId = formData.get('defaultVariantId') as string

  if (!termId || !sequenceRaw || !anchorDate || !defaultVariantId) {
    return { ok: false, error: 'Term, sequence, anchor date, and a default schedule are all required.' }
  }
  if (!DATE_PATTERN.test(anchorDate)) {
    return { ok: false, error: 'Anchor date must be a real date.' }
  }

  const sequence = sequenceRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (sequence.length === 0) {
    return { ok: false, error: 'List at least one rotation code, separated by commas.' }
  }

  let holidays: HolidayInput[]
  try {
    holidays = parseHolidays(holidaysRaw)
    for (const h of holidays) {
      if (!DATE_PATTERN.test(h.date)) throw new Error(`"${h.date}" isn't a valid date (use YYYY-MM-DD).`)
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Check the holiday list.' }
  }

  const supabase = await createClient()
  const { data: term, error: termError } = await supabase
    .from('school_terms')
    .select('starts_on, ends_on')
    .eq('id', termId)
    .single()

  if (termError || !term) {
    return { ok: false, error: 'Could not find that term. Try again.' }
  }

  try {
    const result = await saveRotation(user.school_id, {
      sequence,
      anchorDate,
      termStart: term.starts_on,
      termEnd: term.ends_on,
      holidays,
      resetsWeekly,
      defaultVariantId,
    })
    revalidatePath('/admin/setup/rotation')
    revalidatePath('/admin/setup/preview')
    revalidatePath('/admin')
    return { ok: true, schoolDays: result.schoolDays, holidayDays: result.holidayDays }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }
}
