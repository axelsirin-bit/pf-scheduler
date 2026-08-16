import { getCurrentUser } from '@/lib/auth'
import { getPeriodTemplates } from '@/lib/db/onboarding'
import { SetupForm } from '@/lib/components/setup-form'
import { TemplateBlockRows } from '@/lib/components/template-block-rows'
import { RegenerateSlotsButton } from '@/lib/components/regenerate-slots-button'
import { saveNewTemplate, duplicateTemplate } from './actions'
import { EditBlockForm } from './edit-block-form'

export default async function TemplatesStep() {
  const user = await getCurrentUser()
  const templates = await getPeriodTemplates(user.school_id)

  return (
    <>
      <h2 className="text-sm font-semibold text-neutral-900">Period templates</h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Most day types differ by only a few labels — duplicate an existing template as a starting point
        rather than typing a new one from scratch.
      </p>

      {templates.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No templates yet — create one below.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded border border-neutral-200 p-3">
              <p className="font-medium text-neutral-900">{t.name}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {t.blocks.map((b) => (
                  <li key={b.id}>
                    <EditBlockForm block={b} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {templates.length > 0 && <RegenerateSlotsButton />}

      <h3 className="mt-6 text-sm font-semibold text-neutral-900">New template</h3>
      <SetupForm action={saveNewTemplate} submitLabel="Create template" className="mt-2 flex max-w-2xl flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Template name</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Standard"
            className="max-w-xs rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <TemplateBlockRows />
      </SetupForm>

      {templates.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-neutral-900">Duplicate a template</h3>
          <SetupForm action={duplicateTemplate} submitLabel="Duplicate" className="mt-2 flex max-w-xs flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm">Starting from</span>
              <select
                name="sourceTemplateId"
                required
                className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm">New name</span>
              <input
                name="newName"
                type="text"
                required
                placeholder="Half-Day"
                className="rounded border border-neutral-300 px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </label>
          </SetupForm>
        </>
      )}
    </>
  )
}
