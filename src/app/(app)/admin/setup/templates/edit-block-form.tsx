import { SetupForm } from '@/lib/components/setup-form'
import { editBlock } from './edit-block-actions'

type Block = { id: string; label: string; startTime: string; endTime: string; isBookable: boolean; sortOrder: number }

// Not a client component itself — SetupForm is, but everything passed to
// it as children is plain server-rendered markup, so this can stay a
// regular function used from the (server) templates page.
export function EditBlockForm({ block }: { block: Block }) {
  return (
    <SetupForm action={editBlock} submitLabel="Save" pendingLabel="Saving…" className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="blockId" value={block.id} />
      <input type="hidden" name="sortOrder" value={block.sortOrder} />
      <label className="flex flex-col gap-1">
        <span>Label</span>
        <input
          name="label"
          type="text"
          required
          defaultValue={block.label}
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Start</span>
        <input
          name="startTime"
          type="time"
          required
          defaultValue={block.startTime}
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>End</span>
        <input
          name="endTime"
          type="time"
          required
          defaultValue={block.endTime}
          className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </label>
      <label className="flex items-center gap-1">
        <input name="isBookable" type="checkbox" defaultChecked={block.isBookable} />
        <span>Bookable</span>
      </label>
    </SetupForm>
  )
}
