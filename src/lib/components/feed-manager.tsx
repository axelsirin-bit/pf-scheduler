'use client'

import { useState, useActionState } from 'react'
import {
  saveFeedUrlAction,
  testFeedAction,
  saveMappingAction,
  syncNowAction,
  type ActionResult,
  type TestFeedResult,
  type SyncNowResult,
} from '@/app/(app)/admin/schedule/feed/actions'
import type { SummaryMapping, MappingAction } from '@/lib/db/ics-import'
import Link from 'next/link'

const inputClass =
  'rounded border border-neutral-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const buttonClass =
  'rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'

function ErrorText({ error }: { error?: string }) {
  if (!error) return null
  return (
    <p role="alert" className="text-xs text-red-600">
      {error}
    </p>
  )
}

function MappingRow({
  sourceId,
  summary,
  existing,
  dayTypeCodes,
  variants,
}: {
  sourceId: string
  summary: string
  existing?: SummaryMapping[string]
  dayTypeCodes: string[]
  variants: { id: string; name: string }[]
}) {
  const [action, setAction] = useState<MappingAction>(existing?.action ?? 'school_day')
  const [dayTypeCode, setDayTypeCode] = useState(existing?.dayTypeCode ?? '')
  const [variantId, setVariantId] = useState(existing?.variantId ?? '')
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult | null) => saveMappingAction(sourceId, summary, action, dayTypeCode, variantId),
    null
  )

  return (
    <li className="rounded border border-neutral-200 p-2 text-sm">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-neutral-500">Summary</span>
          <span className="font-medium">{summary}</span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Maps to</span>
          <select value={action} onChange={(e) => setAction(e.target.value as MappingAction)} className={inputClass}>
            <option value="school_day">School day</option>
            <option value="no_school">No school</option>
            <option value="ignore">Ignore</option>
          </select>
        </label>

        {action === 'school_day' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">Day type</span>
              <input
                list={`day-types-${sourceId}`}
                value={dayTypeCode}
                onChange={(e) => setDayTypeCode(e.target.value)}
                placeholder="Day 2"
                className={inputClass}
              />
              <datalist id={`day-types-${sourceId}`}>
                {dayTypeCodes.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">Variant</span>
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={inputClass}>
                <option value="">Choose…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <button type="submit" disabled={isPending} className={buttonClass}>
          {isPending ? 'Saving…' : existing ? 'Update' : 'Save mapping'}
        </button>
        {existing && <span className="text-xs text-green-700">Mapped</span>}
        {!existing && <span className="text-xs text-amber-700">Needs attention</span>}
      </form>
      <ErrorText error={state && !state.ok ? state.error : undefined} />
    </li>
  )
}

export function FeedManager({
  sourceId,
  initialUrl,
  existingMapping,
  dayTypeCodes,
  variants,
}: {
  sourceId: string | null
  initialUrl: string
  existingMapping: SummaryMapping
  dayTypeCodes: string[]
  variants: { id: string; name: string }[]
}) {
  const [url, setUrl] = useState(initialUrl)
  const [saveState, saveAction, isSaving] = useActionState(async (_prev: ActionResult | null) => saveFeedUrlAction(url), null)
  const [testState, testAction, isTesting] = useActionState(
    async (_prev: TestFeedResult | null) => testFeedAction(url),
    null
  )
  const [syncState, doSync, isSyncing] = useActionState(
    async (_prev: SyncNowResult | null) => (sourceId ? syncNowAction(sourceId) : { ok: false as const, error: 'Save the feed URL first.' }),
    null
  )

  const summariesToShow = testState?.ok
    ? testState.distinctSummaries
    : Object.keys(existingMapping).sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border border-neutral-200 p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-900">Feed URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <form action={saveAction}>
            <button type="submit" disabled={isSaving} className={buttonClass}>
              {isSaving ? 'Saving…' : 'Save feed URL'}
            </button>
          </form>
          <form action={testAction}>
            <button
              type="submit"
              disabled={isTesting}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {isTesting ? 'Testing…' : 'Test fetch'}
            </button>
          </form>
          {sourceId && (
            <form action={doSync}>
              <button type="submit" disabled={isSyncing} className={buttonClass}>
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </button>
            </form>
          )}
        </div>
        <ErrorText error={saveState && !saveState.ok ? saveState.error : undefined} />
        <ErrorText error={testState && !testState.ok ? testState.error : undefined} />
        {testState?.ok && (
          <p className="mt-2 text-sm text-neutral-600">
            Found {testState.totalEvents} event(s), {testState.distinctSummaries.length} distinct summary/summaries.
          </p>
        )}
        <ErrorText error={syncState && !syncState.ok ? syncState.error : undefined} />
        {syncState?.ok && syncState.batchId && (
          <p className="mt-2 text-sm text-green-700">
            Sync complete —{' '}
            <Link href={`/admin/schedule/feed/batches/${syncState.batchId}`} className="underline">
              review the batch
            </Link>
            .
          </p>
        )}
        {syncState?.ok && !syncState.batchId && (
          <p className="mt-2 text-sm text-neutral-600">Nothing to sync against — no current or upcoming term is configured.</p>
        )}
      </div>

      {sourceId && summariesToShow.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Mapping</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Each summary maps to a day type and schedule variant, to no school, or to ignore. Saved mappings apply
            automatically on future syncs.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {summariesToShow.map((summary) => (
              <MappingRow
                key={summary}
                sourceId={sourceId}
                summary={summary}
                existing={existingMapping[summary]}
                dayTypeCodes={dayTypeCodes}
                variants={variants}
              />
            ))}
          </ul>
        </div>
      )}
      {!sourceId && testState?.ok && testState.distinctSummaries.length > 0 && (
        <p className="text-sm text-neutral-600">Save the feed URL above to start mapping these summaries.</p>
      )}
    </div>
  )
}
