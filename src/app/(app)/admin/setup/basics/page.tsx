import { getCurrentUser } from '@/lib/auth'
import { getSchoolBasics, getSchoolTerms } from '@/lib/db/onboarding'
import { SetupForm } from '@/lib/components/setup-form'
import { saveBasics, saveTerm } from './actions'

export default async function BasicsStep() {
  const user = await getCurrentUser()
  const school = await getSchoolBasics(user.school_id)
  const terms = await getSchoolTerms(user.school_id)

  if (!school) {
    throw new Error(`No school found for id ${user.school_id}`)
  }

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Basics</h2>
      <SetupForm action={saveBasics} submitLabel="Save basics" className="mt-2 flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">School name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={school.name}
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Slug (lowercase, no spaces)</span>
          <input
            name="slug"
            type="text"
            required
            defaultValue={school.slug}
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Timezone (e.g. America/New_York)</span>
          <input
            name="timezone"
            type="text"
            required
            defaultValue={school.timezone}
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Expected completed rounds per member per term</span>
          <input
            name="expectedRoundsPerTerm"
            type="number"
            min={1}
            required
            defaultValue={school.expectedRoundsPerTerm}
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
      </SetupForm>

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Term dates</h2>
      {terms.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No terms added yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
          {terms.map((t) => (
            <li key={t.id}>
              {t.name}: {t.startsOn} – {t.endsOn}
            </li>
          ))}
        </ul>
      )}
      <SetupForm action={saveTerm} submitLabel="Add term" className="mt-3 flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Term name</span>
          <input
            name="termName"
            type="text"
            required
            placeholder="Fall 2026"
            className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm">Starts</span>
            <input
              name="startsOn"
              type="date"
              required
              className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm">Ends</span>
            <input
              name="endsOn"
              type="date"
              required
              className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        </div>
      </SetupForm>
    </>
  )
}
