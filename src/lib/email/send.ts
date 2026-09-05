import { Resend } from 'resend'
import type { EmailContent } from './templates.ts'

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'PF Scheduler <onboarding@resend.dev>'

// Dev mode is ON by default — the safe direction. An environment that
// forgets to set RESEND_DEV_MODE (a fresh clone, a misconfigured preview
// deploy) logs instead of emailing real people, rather than the other
// way around. Only an explicit 'false' turns real sending on; production
// on Vercel has to set that deliberately, which is also the "verified by
// a deliberate test send" task 6 asks for — flipping this one value is
// the whole test.
function isDevMode(): boolean {
  return process.env.RESEND_DEV_MODE !== 'false'
}

let client: Resend | null = null
function getClient(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set.')
    }
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export type SendResult = { ok: true } | { ok: false; error: string }

// The only function anything in this codebase should call to actually
// deliver an email. Never called from a Client Component (task 3) — this
// file has no 'use client' and nothing here is safe to run in the
// browser (RESEND_API_KEY would be exposed).
export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  if (isDevMode()) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev-mode] to=${to}\nsubject: ${content.subject}\n\n${content.text}`)
    return { ok: true }
  }

  try {
    const { error } = await getClient().emails.send({
      from: FROM_ADDRESS,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not send email.' }
  }
}
