import { createAdminClient } from '../supabase/admin.ts'
import { generateSlots, type CalendarDay, type ScheduleVariant, type TemplateBlock } from '../schedule/generate.ts'

export type UpsertSlotsResult = {
  schoolDays: number
  slotsGenerated: number
}

// Generates and persists slots for a school across a date range. Runs as
// the service role — the only two callers are the cron route (no user
// session at all) and one-off maintenance scripts, never a page a signed-in
// user is viewing. See CLAUDE.md rule 2.
export async function upsertSlotsForRange(
  schoolId: string,
  from: string,
  to: string,
  options: { dryRun?: boolean } = {}
): Promise<UpsertSlotsResult> {
  const supabase = createAdminClient()

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, timezone')
    .eq('id', schoolId)
    .single()

  if (schoolError || !school) {
    throw new Error(`Could not find school ${schoolId}: ${schoolError?.message}`)
  }

  const { data: calendarDaysRaw, error: calendarError } = await supabase
    .from('calendar_days')
    .select('id, date, variant_id, is_school_day')
    .eq('school_id', schoolId)
    .eq('is_school_day', true)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (calendarError) throw calendarError

  const calendarDays: CalendarDay[] = (calendarDaysRaw ?? []).map((d) => ({
    id: d.id,
    date: d.date,
    isSchoolDay: d.is_school_day,
    variantId: d.variant_id,
  }))

  if (calendarDays.length === 0) {
    return { schoolDays: 0, slotsGenerated: 0 }
  }

  const variantIds = [
    ...new Set(calendarDays.map((d) => d.variantId).filter((v): v is string => v !== null)),
  ]

  const { data: variantsRaw, error: variantError } = await supabase
    .from('schedule_variants')
    .select('id, template_id')
    .in('id', variantIds)

  if (variantError) throw variantError

  const variants: ScheduleVariant[] = (variantsRaw ?? []).map((v) => ({
    id: v.id,
    templateId: v.template_id,
  }))
  const templateIds = [...new Set(variants.map((v) => v.templateId))]

  const { data: blocksRaw, error: blockError } = await supabase
    .from('template_blocks')
    .select('id, template_id, label, start_time, end_time, is_bookable, sort_order')
    .in('template_id', templateIds)

  if (blockError) throw blockError

  const blocks: TemplateBlock[] = (blocksRaw ?? []).map((b) => ({
    id: b.id,
    templateId: b.template_id,
    label: b.label,
    startTime: b.start_time,
    endTime: b.end_time,
    isBookable: b.is_bookable,
    sortOrder: b.sort_order,
  }))

  const slots = generateSlots(calendarDays, variants, blocks, school.timezone)

  if (options.dryRun) {
    return { schoolDays: calendarDays.length, slotsGenerated: slots.length }
  }

  const rows = slots.map((s) => ({
    school_id: schoolId,
    calendar_day_id: s.calendarDayId,
    block_id: s.blockId,
    label: s.label,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
  }))

  // Idempotent via the unique index on (calendar_day_id, block_id): an
  // existing slot gets its label/times updated in place, keeping its
  // original id. That's what makes regeneration safe — rounds and
  // availabilities reference a slot by id, and upsert never changes it or
  // deletes the row, only re-running generation from scratch would.
  const { error: upsertError } = await supabase
    .from('slots')
    .upsert(rows, { onConflict: 'calendar_day_id,block_id' })

  if (upsertError) throw upsertError

  return { schoolDays: calendarDays.length, slotsGenerated: slots.length }
}

// Read-only, for step 08's week grid and anything else displaying slots to
// a signed-in user. Uses the regular RLS-respecting client, not the admin
// one — the slots_select policy already scopes this to the caller's own
// school, so there's no reason to bypass it for a read.
//
// server.ts is imported dynamically, not at the top of this file: it pulls
// in next/headers, which can't resolve at all outside Next's own runtime —
// not just when called, but at import time. upsertSlotsForRange above needs
// to run from plain Node (cron route aside, it's also invoked directly by
// one-off scripts), so a static top-level import here would break loading
// this whole module anywhere but inside Next.
export async function getSlotsForRange(schoolId: string, from: string, to: string) {
  const { createClient } = await import('../supabase/server.ts')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('slots')
    .select('id, calendar_day_id, block_id, label, starts_at, ends_at, is_open')
    .eq('school_id', schoolId)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at')

  if (error) throw error
  return data
}
