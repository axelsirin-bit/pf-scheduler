import { createAdminClient } from '../supabase/admin.ts'
import { sendEmail } from './send.ts'
import {
  roundConfirmedEmail,
  roundTomorrowEmail,
  resultNeededEmail,
  roundCancelledEmail,
  rateLimitApprovalEmail,
  calendarImportPendingEmail,
  schoolApprovedEmail,
  type EmailContent,
  type RoundDetails,
} from './templates.ts'

type AdminClient = ReturnType<typeof createAdminClient>

// Every notify* function below fetches through the admin client, not
// whatever session called it — two reasons, not one convenience. First,
// these run from both real user sessions (joinRound, cancelRound,
// inviteRosterMembers) and no-session cron routes, so there's no single
// client type every caller could pass in. Second, and more load-bearing:
// building an email genuinely needs every recipient's real email address,
// and the app never exposes a peer's email to anyone's own RLS session —
// only display_name is peer-visible, by design (decisions.md's privacy
// rules). This is the one place that's supposed to see real addresses.

// notifications_sent only allows service-role writes (step 03) — the
// claim is inserted before sending, not after, so a genuine double-run
// (two cron invocations racing) fails the second insert on the unique
// index and never sends twice. If the send itself fails after a
// successful claim, the claim is rolled back so a future run retries
// rather than silently never emailing that person again.
async function claimAndSend(
  admin: AdminClient,
  params: {
    kind: string
    recipientId: string
    recipientEmail: string
    schoolId: string
    roundId?: string
    entityId?: string
    content: EmailContent
  }
): Promise<{ sent: boolean; error?: string }> {
  const { data: claimed, error: insertError } = await admin
    .from('notifications_sent')
    .insert({
      school_id: params.schoolId,
      kind: params.kind,
      round_id: params.roundId ?? null,
      entity_id: params.entityId ?? null,
      user_id: params.recipientId,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') return { sent: false } // already sent
    return { sent: false, error: insertError.message }
  }

  const result = await sendEmail(params.recipientEmail, params.content)
  if (!result.ok) {
    await admin.from('notifications_sent').delete().eq('id', claimed.id)
    return { sent: false, error: result.error }
  }

  return { sent: true }
}

type RawRoundContext = {
  id: string
  school_id: string
  confirmed_at: string | null
  cancel_reason: string | null
  slots: { label: string; starts_at: string; ends_at: string } | null
  rooms: { name: string } | null
  room_freetext: string | null
  schools: { timezone: string } | null
  round_participants: { user_id: string; role: string; profiles: { email: string; display_name: string } | null }[]
}

type RoundContext = {
  schoolId: string
  timeZone: string
  confirmedAt: string | null
  cancelReason: string | null
  details: RoundDetails
  participants: { userId: string; email: string; displayName: string; role: 'debater' | 'judge' }[]
  judge: { userId: string; email: string; displayName: string } | null
}

async function getRoundContext(admin: AdminClient, roundId: string): Promise<RoundContext | null> {
  const { data, error } = await admin
    .from('rounds')
    .select(
      `
      id, school_id, confirmed_at, cancel_reason,
      slots ( label, starts_at, ends_at ),
      rooms ( name ), room_freetext,
      schools ( timezone ),
      round_participants ( user_id, role, profiles ( email, display_name ) )
    `
    )
    .eq('id', roundId)
    .maybeSingle()

  if (error) throw error
  const raw = data as RawRoundContext | null
  if (!raw || !raw.slots || !raw.schools) return null

  const participants = raw.round_participants
    .map((p) => ({
      userId: p.user_id,
      email: p.profiles?.email,
      displayName: p.profiles?.display_name,
      role: p.role as 'debater' | 'judge',
    }))
    .filter((p): p is { userId: string; email: string; displayName: string; role: 'debater' | 'judge' } =>
      Boolean(p.email && p.displayName)
    )

  const judge = participants.find((p) => p.role === 'judge') ?? null
  const room = raw.rooms?.name ?? raw.room_freetext ?? null

  return {
    schoolId: raw.school_id,
    timeZone: raw.schools.timezone,
    confirmedAt: raw.confirmed_at,
    cancelReason: raw.cancel_reason,
    details: {
      slotLabel: raw.slots.label,
      startsAt: raw.slots.starts_at,
      endsAt: raw.slots.ends_at,
      timeZone: raw.schools.timezone,
      room,
      participants: participants.map((p) => ({ displayName: p.displayName, role: p.role })),
    },
    participants,
    judge: judge ? { userId: judge.userId, email: judge.email, displayName: judge.displayName } : null,
  }
}

// The broadened half of the per-user preference (task 5): anyone active
// in the school with email_preference = 'all', beyond the round's actual
// roster. Deduped against the participant list by the caller.
async function getAllPreferenceRecipients(
  admin: AdminClient,
  schoolId: string,
  excludeUserIds: Set<string>
): Promise<{ userId: string; email: string; displayName: string }[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, display_name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('email_preference', 'all')

  if (error) throw error
  return (data ?? [])
    .filter((p) => !excludeUserIds.has(p.id))
    .map((p) => ({ userId: p.id, email: p.email, displayName: p.display_name }))
}

// ---------------------------------------------------------------------
// Round confirmed — to all five participants, immediately, plus anyone
// with the broadened 'all' preference.
// ---------------------------------------------------------------------
export async function notifyRoundConfirmed(roundId: string): Promise<void> {
  const admin = createAdminClient()
  const ctx = await getRoundContext(admin, roundId)
  if (!ctx) return

  const content = roundConfirmedEmail(ctx.details)
  const participantIds = new Set(ctx.participants.map((p) => p.userId))
  const broadened = await getAllPreferenceRecipients(admin, ctx.schoolId, participantIds)
  const recipients = [...ctx.participants, ...broadened]

  for (const r of recipients) {
    await claimAndSend(admin, {
      kind: 'round_confirmed',
      recipientId: r.userId,
      recipientEmail: r.email,
      schoolId: ctx.schoolId,
      roundId,
      content,
    })
  }
}

// ---------------------------------------------------------------------
// Round tomorrow — same recipients as confirmed. Eligibility (tomorrow's
// date, confirmed >24h in advance) is the cron route's job, not this
// function's — this just sends, for a round already decided eligible.
// ---------------------------------------------------------------------
export async function notifyRoundTomorrow(roundId: string): Promise<void> {
  const admin = createAdminClient()
  const ctx = await getRoundContext(admin, roundId)
  if (!ctx) return

  const content = roundTomorrowEmail(ctx.details)
  const participantIds = new Set(ctx.participants.map((p) => p.userId))
  const broadened = await getAllPreferenceRecipients(admin, ctx.schoolId, participantIds)
  const recipients = [...ctx.participants, ...broadened]

  for (const r of recipients) {
    await claimAndSend(admin, {
      kind: 'round_tomorrow',
      recipientId: r.userId,
      recipientEmail: r.email,
      schoolId: ctx.schoolId,
      roundId,
      content,
    })
  }
}

// ---------------------------------------------------------------------
// Result needed — to the judge only, never broadened to 'all' preference
// (this is a personal accountability nudge, not team news). The second
// reminder also CC's every active admin, bypassing preference the same
// way the two admin-only notifications do — the reasoning is the same:
// oversight, not round noise.
// ---------------------------------------------------------------------
export async function notifyResultNeeded(roundId: string, isSecondReminder: boolean): Promise<void> {
  const admin = createAdminClient()
  const ctx = await getRoundContext(admin, roundId)
  if (!ctx || !ctx.judge) return

  const content = resultNeededEmail(
    { slotLabel: ctx.details.slotLabel, startsAt: ctx.details.startsAt, timeZone: ctx.timeZone },
    isSecondReminder
  )
  const kind = isSecondReminder ? 'result_needed_followup' : 'result_needed'

  await claimAndSend(admin, {
    kind,
    recipientId: ctx.judge.userId,
    recipientEmail: ctx.judge.email,
    schoolId: ctx.schoolId,
    roundId,
    content,
  })

  if (isSecondReminder) {
    const { data: admins, error } = await admin
      .from('profiles')
      .select('id, email')
      .eq('school_id', ctx.schoolId)
      .eq('is_active', true)
      .contains('roles', ['admin'])
    if (error) throw error

    for (const a of admins ?? []) {
      if (a.id === ctx.judge.userId) continue
      await claimAndSend(admin, {
        kind: 'result_needed_followup_admin_copy',
        recipientId: a.id,
        recipientEmail: a.email,
        schoolId: ctx.schoolId,
        roundId,
        content,
      })
    }
  }
}

// ---------------------------------------------------------------------
// Round cancelled — to the remaining participants, excluding whoever
// took the cancelling action (they already know), plus the same
// broadened 'all'-preference recipients as confirmed/tomorrow. This is
// one of the four "round" emails the preference toggle (task 5) governs
// — leaving it out here while confirmed/tomorrow both broaden would be
// an inconsistency in the toggle's own meaning, not a deliberate
// narrower design for this one email specifically.
// ---------------------------------------------------------------------
export async function notifyRoundCancelled(roundId: string, cancelledByUserId: string): Promise<void> {
  const admin = createAdminClient()
  const ctx = await getRoundContext(admin, roundId)
  if (!ctx) return

  const content = roundCancelledEmail(
    { slotLabel: ctx.details.slotLabel, startsAt: ctx.details.startsAt, timeZone: ctx.timeZone },
    ctx.cancelReason
  )

  const participantIds = new Set(ctx.participants.map((p) => p.userId))
  const broadened = await getAllPreferenceRecipients(admin, ctx.schoolId, participantIds)
  const recipients = [...ctx.participants, ...broadened]

  for (const r of recipients) {
    if (r.userId === cancelledByUserId) continue
    await claimAndSend(admin, {
      kind: 'round_cancelled',
      recipientId: r.userId,
      recipientEmail: r.email,
      schoolId: ctx.schoolId,
      roundId,
      content,
    })
  }
}

// ---------------------------------------------------------------------
// Admin-only notifications (step 15/16 hooks) — always reach every
// active admin, bypassing the per-user preference entirely (the
// human's explicit call: these are administrative oversight, not round
// noise). Keyed by entity_id (the invite or batch id), never round_id —
// see the migration's own note on why a plain nullable round_id can't
// give these real idempotency.
// ---------------------------------------------------------------------
export async function notifyRateLimitApproval(schoolId: string, inviteId: string, pendingCount: number): Promise<void> {
  const admin = createAdminClient()
  const content = rateLimitApprovalEmail({ pendingCount, reviewUrl: `${appUrl()}/admin/roster` })

  const { data: admins, error } = await admin
    .from('profiles')
    .select('id, email')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .contains('roles', ['admin'])
  if (error) throw error

  for (const a of admins ?? []) {
    await claimAndSend(admin, {
      kind: 'rate_limit_approval',
      recipientId: a.id,
      recipientEmail: a.email,
      schoolId,
      entityId: inviteId,
      content,
    })
  }
}

export async function notifyCalendarImportPending(schoolId: string, batchId: string, entryCount: number): Promise<void> {
  const admin = createAdminClient()
  const content = calendarImportPendingEmail({ entryCount, reviewUrl: `${appUrl()}/admin/schedule/feed/batches/${batchId}` })

  const { data: admins, error } = await admin
    .from('profiles')
    .select('id, email')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .contains('roles', ['admin'])
  if (error) throw error

  for (const a of admins ?? []) {
    await claimAndSend(admin, {
      kind: 'calendar_import_pending',
      recipientId: a.id,
      recipientEmail: a.email,
      schoolId,
      entityId: batchId,
      content,
    })
  }
}

// ---------------------------------------------------------------------
// School approval (scripts/approve-school-request.ts) — the one email in
// this codebase whose recipient has no profiles row yet: they haven't
// signed in for the first time, so there's no real user_id to give
// claimAndSend. entity_id is the school_requests row's own id, which is
// naturally one-per-approval and never reused.
//
// Deliberately not built on claimAndSend's insert-before-send claim: that
// pattern's race-safety comes from the two partial unique indexes added in
// step 17's migration, both of which require a non-null column (round_id
// or entity_id) *paired with* a non-null user_id to mean anything —
// Postgres never treats two NULLs as equal, so a null user_id here would
// make the index silently useless, the exact hole that migration's own
// comment already documents for round_id. A plain existence check before
// sending is the right amount of protection for a script one person runs
// by hand — not a concurrent cron — matching what task 5 actually asked
// for ("check notifications_sent table"), not a claim to invent new schema
// for a single always-manual call site.
export async function notifySchoolApproved(input: {
  requestId: string
  schoolId: string
  schoolName: string
  adminName: string
  adminEmail: string
}): Promise<{ sent: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: existing, error: checkError } = await admin
    .from('notifications_sent')
    .select('id')
    .eq('kind', 'school_approved')
    .eq('entity_id', input.requestId)
    .maybeSingle()
  if (checkError) throw checkError
  if (existing) return { sent: false } // already sent for this request

  const { data: claimed, error: insertError } = await admin
    .from('notifications_sent')
    .insert({ school_id: input.schoolId, kind: 'school_approved', entity_id: input.requestId })
    .select('id')
    .single()
  if (insertError) throw insertError

  const content = schoolApprovedEmail({
    schoolName: input.schoolName,
    adminName: input.adminName,
    signInUrl: `${appUrl()}/sign-in`,
  })

  const result = await sendEmail(input.adminEmail, content)
  if (!result.ok) {
    // Same reasoning as claimAndSend: roll back the claim so a later
    // retry actually resends instead of silently believing it already did.
    await admin.from('notifications_sent').delete().eq('id', claimed.id)
    return { sent: false, error: result.error }
  }

  return { sent: true }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
