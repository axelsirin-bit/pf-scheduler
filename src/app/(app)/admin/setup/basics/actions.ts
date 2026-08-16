'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { updateSchoolBasics, addSchoolTerm } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const TIMEZONE_PATTERN = /^[A-Za-z]+\/[A-Za-z_]+$/

export async function saveBasics(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const name = (formData.get('name') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const timezone = (formData.get('timezone') as string)?.trim()
  const expectedRoundsPerTerm = Number(formData.get('expectedRoundsPerTerm'))

  if (!name || !slug || !timezone) {
    return { ok: false, error: 'Name, slug, and timezone are all required.' }
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'Slug must be lowercase letters, numbers, and hyphens only.' }
  }
  if (!TIMEZONE_PATTERN.test(timezone)) {
    return { ok: false, error: 'Timezone should look like "America/New_York".' }
  }
  if (!Number.isInteger(expectedRoundsPerTerm) || expectedRoundsPerTerm < 1) {
    return { ok: false, error: 'Expected rounds per term must be a positive whole number.' }
  }

  try {
    await updateSchoolBasics(user.school_id, { name, slug, timezone, expectedRoundsPerTerm })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/basics')
  revalidatePath('/admin')
  return { ok: true }
}

export async function saveTerm(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const name = (formData.get('termName') as string)?.trim()
  const startsOn = formData.get('startsOn') as string
  const endsOn = formData.get('endsOn') as string

  if (!name || !startsOn || !endsOn) {
    return { ok: false, error: 'Term name, start, and end dates are all required.' }
  }
  if (endsOn <= startsOn) {
    return { ok: false, error: 'Term end date must be after the start date.' }
  }

  try {
    await addSchoolTerm(user.school_id, { name, startsOn, endsOn })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/basics')
  revalidatePath('/admin')
  return { ok: true }
}
