import { getCurrentUser } from '@/lib/auth'
import { EmailPreferenceForm } from '@/lib/components/email-preference-form'

export default async function SettingsPage() {
  const user = await getCurrentUser()

  return (
    <>
      <h1 className="text-xl font-semibold">Settings</h1>
      <h2 className="mt-4 text-sm font-semibold text-neutral-900">Email notifications</h2>
      <p className="mt-1 text-sm text-neutral-600">
        You&apos;ll always get emails about your own rounds — confirmations, day-before reminders, and
        cancellations. This controls whether you also see them for the rest of the school.
      </p>
      <EmailPreferenceForm current={user.email_preference as 'all' | 'my_rounds'} />
    </>
  )
}
