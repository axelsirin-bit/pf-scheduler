'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createRoom } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveRoom(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const name = (formData.get('name') as string)?.trim()
  const note = (formData.get('note') as string)?.trim()

  if (!name) return { ok: false, error: 'Name the room.' }

  try {
    await createRoom(user.school_id, name, note || null)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/rooms')
  revalidatePath('/admin')
  return { ok: true }
}
