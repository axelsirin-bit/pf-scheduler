// Plain text first, minimal HTML second — every template returns both.
// No images, no external CSS, no multi-column layout: the acceptance
// criteria require these to render legibly in a phone mail client, and
// the safest way to guarantee that is to not need anything a phone mail
// client might strip or mangle.

export type EmailContent = { subject: string; text: string; html: string }

export type RoundParticipant = { displayName: string; role: 'debater' | 'judge' }

export type RoundDetails = {
  slotLabel: string
  startsAt: string
  endsAt: string
  timeZone: string
  room: string | null
  participants: RoundParticipant[]
}

function shortDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date(iso))
}

function fullDateTime(startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'short', day: 'numeric' }).format(
    new Date(startsAt)
  )
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

function roomLine(room: string | null): string {
  return room ?? 'not set yet'
}

function rosterLines(participants: RoundParticipant[]): string {
  const debaters = participants.filter((p) => p.role === 'debater')
  const judge = participants.find((p) => p.role === 'judge')
  const lines = debaters.map((d) => `- ${d.displayName} (debater)`)
  lines.push(`- ${judge ? judge.displayName : 'no judge yet'} (judge)`)
  return lines.join('\n')
}

function rosterHtml(participants: RoundParticipant[]): string {
  const debaters = participants.filter((p) => p.role === 'debater')
  const judge = participants.find((p) => p.role === 'judge')
  const items = debaters.map((d) => `<li>${escapeHtml(d.displayName)} (debater)</li>`)
  items.push(`<li>${judge ? escapeHtml(judge.displayName) : 'no judge yet'} (judge)</li>`)
  return `<ul style="margin:8px 0;padding-left:20px;">${items.join('')}</ul>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function wrapHtml(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:480px;">${bodyHtml}</div>`
}

export function roundConfirmedEmail(round: RoundDetails): EmailContent {
  const when = fullDateTime(round.startsAt, round.endsAt, round.timeZone)
  const subject = `PF round confirmed: ${shortDay(round.startsAt, round.timeZone)} ${round.slotLabel}, ${
    round.room ?? 'room TBD'
  }`

  const text = `Your PF round is confirmed.

${when}
${round.slotLabel}
Room: ${roomLine(round.room)}

Who's in it:
${rosterLines(round.participants)}
`

  const html = wrapHtml(`
    <p>Your PF round is confirmed.</p>
    <p><strong>${escapeHtml(when)}</strong><br>${escapeHtml(round.slotLabel)}<br>Room: ${escapeHtml(roomLine(round.room))}</p>
    <p>Who's in it:</p>
    ${rosterHtml(round.participants)}
  `)

  return { subject, text, html }
}

export function roundTomorrowEmail(round: RoundDetails): EmailContent {
  const when = fullDateTime(round.startsAt, round.endsAt, round.timeZone)
  const subject = `PF round tomorrow: ${shortDay(round.startsAt, round.timeZone)} ${round.slotLabel}, ${
    round.room ?? 'room TBD'
  }`

  const text = `Reminder — your PF round is tomorrow.

${when}
${round.slotLabel}
Room: ${roomLine(round.room)}

Who's in it:
${rosterLines(round.participants)}
`

  const html = wrapHtml(`
    <p>Reminder — your PF round is tomorrow.</p>
    <p><strong>${escapeHtml(when)}</strong><br>${escapeHtml(round.slotLabel)}<br>Room: ${escapeHtml(roomLine(round.room))}</p>
    <p>Who's in it:</p>
    ${rosterHtml(round.participants)}
  `)

  return { subject, text, html }
}

export function resultNeededEmail(
  round: { slotLabel: string; startsAt: string; timeZone: string },
  isSecondReminder: boolean
): EmailContent {
  const day = shortDay(round.startsAt, round.timeZone)
  const subject = isSecondReminder
    ? `PF result still needed: ${day} ${round.slotLabel}`
    : `PF result needed: ${day} ${round.slotLabel}`

  const intro = isSecondReminder
    ? "This round's result still hasn't been submitted, two days later."
    : "This round finished a few hours ago and doesn't have a result yet."

  const text = `${intro}

${day} ${round.slotLabel}

Submit the result and reason for decision from the round page in the app.
`

  const html = wrapHtml(`
    <p>${escapeHtml(intro)}</p>
    <p><strong>${escapeHtml(day)} ${escapeHtml(round.slotLabel)}</strong></p>
    <p>Submit the result and reason for decision from the round page in the app.</p>
  `)

  return { subject, text, html }
}

export function roundCancelledEmail(
  round: { slotLabel: string; startsAt: string; timeZone: string },
  reason: string | null
): EmailContent {
  const day = shortDay(round.startsAt, round.timeZone)
  const subject = `PF round cancelled: ${day} ${round.slotLabel}`

  const text = `Your PF round has been cancelled.

${day} ${round.slotLabel}
${reason ? `Reason: ${reason}` : ''}
`

  const html = wrapHtml(`
    <p>Your PF round has been cancelled.</p>
    <p><strong>${escapeHtml(day)} ${escapeHtml(round.slotLabel)}</strong></p>
    ${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ''}
  `)

  return { subject, text, html }
}

export function rateLimitApprovalEmail(input: { pendingCount: number; reviewUrl: string }): EmailContent {
  const subject = `PF: ${input.pendingCount} invite(s) waiting for approval`

  const text = `${input.pendingCount} roster invite(s) went over the hourly limit and need a second admin's approval before the invited person can sign in.

Review them: ${input.reviewUrl}
`

  const html = wrapHtml(`
    <p>${input.pendingCount} roster invite(s) went over the hourly limit and need a second admin's approval before the invited person can sign in.</p>
    <p><a href="${escapeHtml(input.reviewUrl)}">Review them</a></p>
  `)

  return { subject, text, html }
}

export function schoolApprovalRequestEmail(input: {
  schoolName: string
  adminName: string
  adminEmail: string
  tabroomUrl: string
  note: string | null
  approveUrl: string
}): EmailContent {
  const subject = `Approve school registration: ${input.schoolName}`

  const text = `New school registration waiting for approval:

School: ${input.schoolName}
Admin: ${input.adminName} <${input.adminEmail}>
Tabroom profile: ${input.tabroomUrl}${input.note ? `\nNote: ${input.note}` : ''}

Check the Tabroom profile above, then approve here: ${input.approveUrl}
`

  const html = wrapHtml(`
    <p>New school registration waiting for approval:</p>
    <p>
      <strong>School:</strong> ${escapeHtml(input.schoolName)}<br>
      <strong>Admin:</strong> ${escapeHtml(input.adminName)} &lt;${escapeHtml(input.adminEmail)}&gt;<br>
      <strong>Tabroom profile:</strong> <a href="${escapeHtml(input.tabroomUrl)}">${escapeHtml(input.tabroomUrl)}</a>
      ${input.note ? `<br><strong>Note:</strong> ${escapeHtml(input.note)}` : ''}
    </p>
    <p>Check the Tabroom profile above, then <a href="${escapeHtml(input.approveUrl)}">approve this school</a>.</p>
  `)

  return { subject, text, html }
}

export function schoolApprovedEmail(input: { schoolName: string; adminName: string; signInUrl: string }): EmailContent {
  const subject = `${input.schoolName} is approved on PF Scheduler`

  const text = `Hi ${input.adminName},

${input.schoolName} has been approved on PF Scheduler.

Click here to sign in and complete your schedule setup: ${input.signInUrl}
`

  const html = wrapHtml(`
    <p>Hi ${escapeHtml(input.adminName)},</p>
    <p>${escapeHtml(input.schoolName)} has been approved on PF Scheduler.</p>
    <p><a href="${escapeHtml(input.signInUrl)}">Click here to sign in and complete your schedule setup</a></p>
  `)

  return { subject, text, html }
}

export function calendarImportPendingEmail(input: { entryCount: number; reviewUrl: string }): EmailContent {
  const subject = `PF: calendar sync found ${input.entryCount} change(s) to review`

  const text = `The calendar feed sync found ${input.entryCount} change(s) waiting for approval before they take effect.

Review them: ${input.reviewUrl}
`

  const html = wrapHtml(`
    <p>The calendar feed sync found ${input.entryCount} change(s) waiting for approval before they take effect.</p>
    <p><a href="${escapeHtml(input.reviewUrl)}">Review them</a></p>
  `)

  return { subject, text, html }
}
