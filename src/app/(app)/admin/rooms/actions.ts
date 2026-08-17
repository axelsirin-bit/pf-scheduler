'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createRoom } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateRoomViews() {
  revalidatePath('/admin/rooms')
  revalidatePath('/admin/setup/rooms')
  revalidatePath('/admin')
}

// Reuses createRoom from onboarding.ts (step 12) rather than a second
// insert path — "on top of the add-a-room capability the wizard already
// built" (task 5), not a replacement for it.
export async function addRoom(name: string, note: string | null): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (!name.trim()) return { ok: false, error: 'Name the room.' }

  try {
    await createRoom(user.school_id, name.trim(), note?.trim() || null)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidateRoomViews()
  return { ok: true }
}

export async function updateRoom(roomId: string, name: string, note: string | null): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }
  if (!name.trim()) return { ok: false, error: 'Name the room.' }

  const supabase = await createClient()
  const { error } = await supabase.from('rooms').update({ name: name.trim(), note: note?.trim() || null }).eq('id', roomId)
  if (error) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRoomViews()
  return { ok: true }
}

export async function setRoomActive(roomId: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const { error } = await supabase.from('rooms').update({ is_active: isActive }).eq('id', roomId)
  if (error) return { ok: false, error: 'Something went wrong. Try again.' }

  revalidateRoomViews()
  return { ok: true }
}
