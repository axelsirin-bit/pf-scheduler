import { describe, expect, it } from 'vitest'
import {
  roundConfirmedEmail,
  roundTomorrowEmail,
  resultNeededEmail,
  roundCancelledEmail,
  rateLimitApprovalEmail,
  calendarImportPendingEmail,
  schoolApprovalRequestEmail,
  schoolApprovedEmail,
  type RoundDetails,
} from '../templates'

const TZ = 'America/New_York'

function round(overrides: Partial<RoundDetails> = {}): RoundDetails {
  return {
    slotLabel: 'P3',
    startsAt: '2026-09-09T17:00:00Z', // Wednesday, 1pm Eastern
    endsAt: '2026-09-09T18:00:00Z',
    timeZone: TZ,
    room: 'Room 214',
    participants: [
      { displayName: 'Ann A.', role: 'debater' },
      { displayName: 'Bo B.', role: 'debater' },
      { displayName: 'Cam C.', role: 'debater' },
      { displayName: 'Dee D.', role: 'debater' },
      { displayName: 'Jo J.', role: 'judge' },
    ],
    ...overrides,
  }
}

describe('roundConfirmedEmail', () => {
  it('has a subject readable in a notification preview: day, period, room', () => {
    const email = roundConfirmedEmail(round())
    expect(email.subject).toBe('PF round confirmed: Wed P3, Room 214')
  })

  it('falls back to "room TBD" when no room is set', () => {
    const email = roundConfirmedEmail(round({ room: null }))
    expect(email.subject).toContain('room TBD')
  })

  it('lists every participant by display name in both text and html', () => {
    const email = roundConfirmedEmail(round())
    for (const name of ['Ann A.', 'Bo B.', 'Cam C.', 'Dee D.', 'Jo J.']) {
      expect(email.text).toContain(name)
      expect(email.html).toContain(name)
    }
  })

  it('never includes a full last name — display names are already peer-safe, but guard against a raw full_name leaking in', () => {
    const email = roundConfirmedEmail(round())
    expect(email.text).not.toMatch(/Anderson|Nguyen|Patel/)
  })

  it('escapes HTML-significant characters in a participant name', () => {
    const email = roundConfirmedEmail(round({ participants: [{ displayName: '<script>A.</script>', role: 'debater' }] }))
    expect(email.html).not.toContain('<script>A.')
    expect(email.html).toContain('&lt;script&gt;')
  })
})

describe('roundTomorrowEmail', () => {
  it('has a subject distinguishable from the confirmed email', () => {
    const email = roundTomorrowEmail(round())
    expect(email.subject).toBe('PF round tomorrow: Wed P3, Room 214')
  })
})

describe('resultNeededEmail', () => {
  it('uses different wording for the first reminder vs the second', () => {
    const first = resultNeededEmail({ slotLabel: 'P3', startsAt: round().startsAt, timeZone: TZ }, false)
    const second = resultNeededEmail({ slotLabel: 'P3', startsAt: round().startsAt, timeZone: TZ }, true)
    expect(first.subject).not.toBe(second.subject)
    expect(second.subject).toContain('still needed')
    expect(second.text).toMatch(/two days/)
  })
})

describe('roundCancelledEmail', () => {
  it('includes the cancellation reason when given', () => {
    const email = roundCancelledEmail({ slotLabel: 'P3', startsAt: round().startsAt, timeZone: TZ }, 'Judge unavailable')
    expect(email.text).toContain('Judge unavailable')
    expect(email.html).toContain('Judge unavailable')
  })

  it('omits a reason line entirely when none was given', () => {
    const email = roundCancelledEmail({ slotLabel: 'P3', startsAt: round().startsAt, timeZone: TZ }, null)
    expect(email.text).not.toContain('Reason:')
    expect(email.html).not.toContain('Reason:')
  })
})

describe('admin notification emails', () => {
  it('rateLimitApprovalEmail includes the pending count and a review link', () => {
    const email = rateLimitApprovalEmail({ pendingCount: 3, reviewUrl: 'https://example.com/admin/roster' })
    expect(email.subject).toContain('3')
    expect(email.html).toContain('https://example.com/admin/roster')
  })

  it('calendarImportPendingEmail includes the entry count and a review link', () => {
    const email = calendarImportPendingEmail({ entryCount: 5, reviewUrl: 'https://example.com/admin/schedule/feed/batches/abc' })
    expect(email.subject).toContain('5')
    expect(email.html).toContain('https://example.com/admin/schedule/feed/batches/abc')
  })

  it('schoolApprovalRequestEmail includes the school, admin, Tabroom link, note, and approve link', () => {
    const email = schoolApprovalRequestEmail({
      schoolName: 'Riverbend Academy',
      adminName: 'Jamie Rivera',
      adminEmail: 'jamie@riverbend.example',
      tabroomUrl: 'https://www.tabroom.com/index/paradigm.mhtml?judge_id=12345',
      note: 'We usually practice on Tuesdays.',
      approveUrl: 'https://example.com/approve-school/abc-123',
    })
    expect(email.subject).toContain('Riverbend Academy')
    expect(email.text).toContain('Jamie Rivera')
    expect(email.text).toContain('jamie@riverbend.example')
    expect(email.text).toContain('https://www.tabroom.com/index/paradigm.mhtml?judge_id=12345')
    expect(email.text).toContain('We usually practice on Tuesdays.')
    expect(email.text).toContain('https://example.com/approve-school/abc-123')
    expect(email.html).toContain('https://example.com/approve-school/abc-123')
  })

  it('schoolApprovalRequestEmail omits the note line when there is none', () => {
    const email = schoolApprovalRequestEmail({
      schoolName: 'Riverbend Academy',
      adminName: 'Jamie Rivera',
      adminEmail: 'jamie@riverbend.example',
      tabroomUrl: 'https://www.tabroom.com/index/paradigm.mhtml?judge_id=12345',
      note: null,
      approveUrl: 'https://example.com/approve-school/abc-123',
    })
    expect(email.text).not.toContain('Note:')
    expect(email.html).not.toContain('<strong>Note:</strong>')
  })

  it('schoolApprovedEmail includes the school name, admin name, and sign-in link', () => {
    const email = schoolApprovedEmail({
      schoolName: 'Riverbend Academy',
      adminName: 'Jamie Rivera',
      signInUrl: 'https://example.com/sign-in',
    })
    expect(email.subject).toContain('Riverbend Academy')
    expect(email.text).toContain('Jamie Rivera')
    expect(email.text).toContain('https://example.com/sign-in')
    expect(email.html).toContain('https://example.com/sign-in')
  })
})
