'use client'

import { useState } from 'react'

export type BlockDraft = { label: string; startTime: string; endTime: string; isBookable: boolean }

const EMPTY_BLOCK: BlockDraft = { label: '', startTime: '', endTime: '', isBookable: true }

// Dynamic add/remove rows, submitted as plain indexed form fields
// (block-0-label, block-0-start, ...) rather than a JSON blob, so the
// server action stays a normal FormData-based action like every other one
// in this wizard (see SetupForm) instead of needing a special object-
// passing path just for this one form.
export function TemplateBlockRows({ initial }: { initial?: BlockDraft[] }) {
  const [blocks, setBlocks] = useState<BlockDraft[]>(initial && initial.length > 0 ? initial : [EMPTY_BLOCK])

  function updateBlock(i: number, field: keyof BlockDraft, value: string | boolean) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)))
  }
  function addBlock() {
    setBlocks((prev) => [...prev, EMPTY_BLOCK])
  }
  function removeBlock(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded border border-neutral-100 p-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Label</span>
            <input
              name={`block-${i}-label`}
              type="text"
              value={b.label}
              onChange={(e) => updateBlock(i, 'label', e.target.value)}
              required
              className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Start</span>
            <input
              name={`block-${i}-start`}
              type="time"
              value={b.startTime}
              onChange={(e) => updateBlock(i, 'startTime', e.target.value)}
              required
              className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>End</span>
            <input
              name={`block-${i}-end`}
              type="time"
              value={b.endTime}
              onChange={(e) => updateBlock(i, 'endTime', e.target.value)}
              required
              className="rounded border border-neutral-300 px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              name={`block-${i}-bookable`}
              type="checkbox"
              checked={b.isBookable}
              onChange={(e) => updateBlock(i, 'isBookable', e.target.checked)}
            />
            <span>Bookable</span>
          </label>
          {blocks.length > 1 && (
            <button
              type="button"
              onClick={() => removeBlock(i)}
              className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <input type="hidden" name="blockCount" value={blocks.length} />
      <button
        type="button"
        onClick={addBlock}
        className="self-start rounded px-2 py-1 text-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        + Add block
      </button>
    </div>
  )
}
