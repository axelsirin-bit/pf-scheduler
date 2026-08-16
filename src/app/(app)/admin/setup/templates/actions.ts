'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createPeriodTemplate, duplicatePeriodTemplate, type TemplateBlockInput } from '@/lib/db/onboarding'

export type ActionResult = { ok: true } | { ok: false; error: string }

function parseBlocks(formData: FormData): TemplateBlockInput[] {
  const count = Number(formData.get('blockCount') ?? 0)
  const blocks: TemplateBlockInput[] = []

  for (let i = 0; i < count; i++) {
    const label = (formData.get(`block-${i}-label`) as string)?.trim()
    const startTime = formData.get(`block-${i}-start`) as string
    const endTime = formData.get(`block-${i}-end`) as string
    const isBookable = formData.get(`block-${i}-bookable`) !== null

    if (!label || !startTime || !endTime) continue
    if (endTime <= startTime) {
      throw new Error(`"${label}" must end after it starts.`)
    }
    blocks.push({ label, startTime, endTime, isBookable, sortOrder: i })
  }

  return blocks
}

export async function saveNewTemplate(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { ok: false, error: 'Name the template.' }

  let blocks: TemplateBlockInput[]
  try {
    blocks = parseBlocks(formData)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Check the block times.' }
  }
  if (blocks.length === 0) return { ok: false, error: 'Add at least one block.' }

  try {
    await createPeriodTemplate(user.school_id, name, blocks)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save. Try again.' }
  }

  revalidatePath('/admin/setup/templates')
  revalidatePath('/admin')
  return { ok: true }
}

export async function duplicateTemplate(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user.roles.includes('admin')) return { ok: false, error: 'Admin only.' }

  const sourceTemplateId = formData.get('sourceTemplateId') as string
  const newName = (formData.get('newName') as string)?.trim()

  if (!sourceTemplateId || !newName) {
    return { ok: false, error: 'Pick a template to copy and give the copy a name.' }
  }

  try {
    await duplicatePeriodTemplate(user.school_id, sourceTemplateId, newName)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not duplicate. Try again.' }
  }

  revalidatePath('/admin/setup/templates')
  return { ok: true }
}
