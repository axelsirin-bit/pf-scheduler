import { zonedTimeToUtc } from './timezone.ts'

// Pure logic, no database access — see decisions.md and step 07: day codes
// and schedule variants are imported (calendar_days), never computed, so
// this only has to turn already-populated rows into slot times. Takes
// plain data in, returns plain data out, so it's testable without a
// database and reusable for any school, not just the seeded fake one.

export type CalendarDay = {
  id: string
  date: string // 'YYYY-MM-DD'
  isSchoolDay: boolean
  variantId: string | null
}

export type ScheduleVariant = {
  id: string
  templateId: string
}

export type TemplateBlock = {
  id: string
  templateId: string
  label: string
  startTime: string // 'HH:MM' or 'HH:MM:SS'
  endTime: string
  isBookable: boolean
  sortOrder: number
}

export type GeneratedSlot = {
  calendarDayId: string
  blockId: string
  label: string
  startsAt: string // ISO 8601, UTC
  endsAt: string
}

// `timeZone` is a single value for the whole call because every calendar
// day passed in is expected to belong to one school — callers (slots.ts)
// are the ones who know which school and look up its timezone.
export function generateSlots(
  calendarDays: CalendarDay[],
  variants: ScheduleVariant[],
  blocks: TemplateBlock[],
  timeZone: string
): GeneratedSlot[] {
  const variantIdToTemplateId = new Map(variants.map((v) => [v.id, v.templateId]))

  const templateIdToBookableBlocks = new Map<string, TemplateBlock[]>()
  for (const block of blocks) {
    if (!block.isBookable) continue
    const list = templateIdToBookableBlocks.get(block.templateId) ?? []
    list.push(block)
    templateIdToBookableBlocks.set(block.templateId, list)
  }
  for (const list of templateIdToBookableBlocks.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const slots: GeneratedSlot[] = []

  for (const day of calendarDays) {
    // Missing from calendar_days, or explicitly not a school day, or (should
    // never happen given the DB check constraint, but this is pure logic
    // with no database to lean on) missing a variant: no slots.
    if (!day.isSchoolDay || !day.variantId) continue

    const templateId = variantIdToTemplateId.get(day.variantId)
    if (!templateId) continue

    const dayBlocks = templateIdToBookableBlocks.get(templateId) ?? []
    for (const block of dayBlocks) {
      slots.push({
        calendarDayId: day.id,
        blockId: block.id,
        label: block.label,
        startsAt: zonedTimeToUtc(day.date, block.startTime, timeZone).toISOString(),
        endsAt: zonedTimeToUtc(day.date, block.endTime, timeZone).toISOString(),
      })
    }
  }

  return slots
}
