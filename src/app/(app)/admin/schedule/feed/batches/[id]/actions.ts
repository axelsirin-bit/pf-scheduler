'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { approveBatch, rejectBatch, overrideConflictEntry } from '@/lib/db/ics-import'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateFeedViews(batchId: string) {
  revalidatePath(`/admin/schedule/feed/batches/${batchId}`)
  revalidatePath('/admin/schedule/feed')
  revalidatePath('/week')
}

export async function approveBatchAction(batchId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const result = await approveBatch(batchId, user.id, supabase)
  if (!result.ok) return result

  revalidateFeedViews(batchId)
  return { ok: true }
}

export async function rejectBatchAction(batchId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const result = await rejectBatch(batchId, user.id, supabase)
  if (!result.ok) return result

  revalidateFeedViews(batchId)
  return { ok: true }
}

export async function overrideConflictAction(batchId: string, date: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const supabase = await createClient()
  const result = await overrideConflictEntry(batchId, date, supabase)
  if (!result.ok) return result

  revalidateFeedViews(batchId)
  return { ok: true }
}
