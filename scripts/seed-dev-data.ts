// Generates slots for a date range from the calendar_days and schedule
// variant templates that supabase/seed.sql already created. Development
// data only — seed.sql owns the structural fixtures (school, terms,
// templates, calendar days); this script only turns calendar days into
// bookable slots, the same conversion step 07's real schedule engine will
// eventually own for every school, not just this fake one.
//
// Usage:
//   node --env-file=.env.local scripts/seed-dev-data.ts
//   node --env-file=.env.local scripts/seed-dev-data.ts --from=2026-10-01 --to=2026-10-31
//
// Defaults to September 2026 for Riverbend Academy. The --from/--to flags
// are how this extends to other months later without editing the script.

import { createAdminClient } from '../src/lib/supabase/admin.ts'
import { zonedTimeToUtc } from '../src/lib/schedule/timezone.ts'

const SCHOOL_SLUG = 'riverbend-academy'
const DEFAULT_FROM = '2026-09-01'
const DEFAULT_TO = '2026-09-30'

function parseArgs() {
  const flags = Object.fromEntries(
    process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('='))
  )
  return {
    from: flags.from ?? DEFAULT_FROM,
    to: flags.to ?? DEFAULT_TO,
  }
}

async function main() {
  const { from, to } = parseArgs()
  const supabase = createAdminClient()

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, timezone')
    .eq('slug', SCHOOL_SLUG)
    .single()

  if (schoolError || !school) {
    throw new Error(`Could not find school "${SCHOOL_SLUG}": ${schoolError?.message}`)
  }

  const { data: calendarDays, error: calendarError } = await supabase
    .from('calendar_days')
    .select('id, date, variant_id')
    .eq('school_id', school.id)
    .eq('is_school_day', true)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (calendarError) throw calendarError
  if (!calendarDays || calendarDays.length === 0) {
    console.log(`No school days found between ${from} and ${to}. Nothing to do.`)
    return
  }

  const variantIds = [...new Set(calendarDays.map((d) => d.variant_id).filter(Boolean))] as string[]

  const { data: variants, error: variantError } = await supabase
    .from('schedule_variants')
    .select('id, template_id')
    .in('id', variantIds)

  if (variantError) throw variantError

  const templateIds = [...new Set((variants ?? []).map((v) => v.template_id))]

  const { data: blocks, error: blockError } = await supabase
    .from('template_blocks')
    .select('id, template_id, label, start_time, end_time')
    .in('template_id', templateIds)
    .eq('is_bookable', true)
    .order('sort_order')

  if (blockError) throw blockError

  const templateIdToBlocks = new Map<string, typeof blocks>()
  for (const block of blocks ?? []) {
    const list = templateIdToBlocks.get(block.template_id) ?? []
    list.push(block)
    templateIdToBlocks.set(block.template_id, list)
  }

  const variantIdToTemplateId = new Map((variants ?? []).map((v) => [v.id, v.template_id]))

  const rows = calendarDays.flatMap((day) => {
    const templateId = variantIdToTemplateId.get(day.variant_id!)
    if (!templateId) return []
    const dayBlocks = templateIdToBlocks.get(templateId) ?? []

    return dayBlocks.map((block) => ({
      school_id: school.id,
      calendar_day_id: day.id,
      block_id: block.id,
      label: block.label,
      starts_at: zonedTimeToUtc(day.date, block.start_time, school.timezone).toISOString(),
      ends_at: zonedTimeToUtc(day.date, block.end_time, school.timezone).toISOString(),
    }))
  })

  const { error: upsertError } = await supabase
    .from('slots')
    .upsert(rows, { onConflict: 'calendar_day_id,block_id' })

  if (upsertError) throw upsertError

  console.log(`Generated ${rows.length} slots across ${calendarDays.length} school days (${from} to ${to}).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
