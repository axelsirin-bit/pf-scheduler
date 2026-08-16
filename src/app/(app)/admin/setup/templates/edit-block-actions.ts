'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { updateTemplateBlock } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

// Editing later (task 4): changes one block's own label/times/bookable
// flag in place. Regenerating the slots this affects happens separately,
// from /admin/setup/templates' "Regenerate future slots" action — editing
// the template here never touches slots by itself.
export async function editBlock(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const blockId = formData.get('blockId') as string
  const label = (formData.get('label') as string)?.trim()
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const isBookable = formData.get('isBookable') !== null
  const sortOrder = Number(formData.get('sortOrder'))

  if (!blockId || !label || !startTime || !endTime) {
    return { ok: false, error: 'Every field is required.' }
  }
  if (endTime <= startTime) {
    return { ok: false, error: 'End time must be after the start time.' }
  }

  try {
    await updateTemplateBlock(blockId, { label, startTime, endTime, isBookable, sortOrder })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/templates')
  return { ok: true }
}
