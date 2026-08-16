import { describe, expect, it } from 'vitest'
import { shapeArchive, shapeArchiveRound, shapeRoundDetail, type ArchiveRound, type RawArchiveRound } from '../archive'
import type { SchoolTerm } from '../onboarding'

const FALL: SchoolTerm = { id: 'term-fall', name: 'Fall 2026', startsOn: '2026-08-24', endsOn: '2026-12-18' }
const WINTER: SchoolTerm = { id: 'term-winter', name: 'Winter 2026', startsOn: '2026-12-19', endsOn: '2026-12-31' }
const TZ = 'America/New_York'

function rawRound(overrides: Partial<RawArchiveRound> = {}): RawArchiveRound {
  return {
    id: 'r1',
    slots: { label: 'P3', starts_at: '2026-09-10T17:00:00Z', ends_at: '2026-09-10T18:00:00Z' },
    round_participants: [
      { user_id: 'd1', role: 'debater', team: 1, profiles: { display_name: 'Ann A.' } },
      { user_id: 'd2', role: 'debater', team: 1, profiles: { display_name: 'Bo B.' } },
      { user_id: 'd3', role: 'debater', team: 2, profiles: { display_name: 'Cam C.' } },
      { user_id: 'd4', role: 'debater', team: 2, profiles: { display_name: 'Dee D.' } },
      { user_id: 'j1', role: 'judge', team: null, profiles: { display_name: 'Jo J.' } },
    ],
    round_results: [
      {
        id: 'res1',
        winning_team: 1,
        team1_side: 'pro',
        rfd: 'Team 1 won on the topicality argument, which team 2 never answered.',
        supersedes: null,
        submitted_at: '2026-09-10T18:30:00Z',
      },
    ],
    round_links: [],
    ...overrides,
  }
}

function archiveRound(overrides: Partial<ArchiveRound> = {}): ArchiveRound {
  return {
    id: 'r1',
    slotLabel: 'P3',
    startsAt: '2026-09-10T17:00:00Z',
    endsAt: '2026-09-10T18:00:00Z',
    termId: 'term-fall',
    termName: 'Fall 2026',
    debaters: [
      { userId: 'd1', displayName: 'Ann A.', role: 'debater', team: 1 },
      { userId: 'd2', displayName: 'Bo B.', role: 'debater', team: 1 },
      { userId: 'd3', displayName: 'Cam C.', role: 'debater', team: 2 },
      { userId: 'd4', displayName: 'Dee D.', role: 'debater', team: 2 },
    ],
    judge: { userId: 'j1', displayName: 'Jo J.', role: 'judge', team: null },
    winningTeam: 1,
    team1Side: 'pro',
    rfd: 'Team 1 won on topicality.',
    hasVideo: false,
    hasSpeechDoc: false,
    ...overrides,
  }
}

describe('shapeArchiveRound', () => {
  it('matches the round to the term whose date range contains its slot date', () => {
    const result = shapeArchiveRound(rawRound(), [FALL, WINTER], TZ)
    expect(result?.termId).toBe('term-fall')
    expect(result?.termName).toBe('Fall 2026')
  })

  it('leaves termId/termName null when no configured term covers the date', () => {
    const result = shapeArchiveRound(rawRound(), [WINTER], TZ)
    expect(result?.termId).toBeNull()
    expect(result?.termName).toBeNull()
  })

  it('computes hasVideo/hasSpeechDoc from the round_links kinds present', () => {
    const withVideo = shapeArchiveRound(rawRound({ round_links: [{ kind: 'video' }] }), [FALL], TZ)
    expect(withVideo?.hasVideo).toBe(true)
    expect(withVideo?.hasSpeechDoc).toBe(false)

    const withBoth = shapeArchiveRound(
      rawRound({ round_links: [{ kind: 'video' }, { kind: 'speech_doc' }, { kind: 'flow' }] }),
      [FALL],
      TZ
    )
    expect(withBoth?.hasVideo).toBe(true)
    expect(withBoth?.hasSpeechDoc).toBe(true)

    const withNeither = shapeArchiveRound(rawRound({ round_links: [{ kind: 'flow' }] }), [FALL], TZ)
    expect(withNeither?.hasVideo).toBe(false)
    expect(withNeither?.hasSpeechDoc).toBe(false)
  })

  it('picks the current (non-superseded) result, not the original, when a correction exists', () => {
    const raw = rawRound({
      round_results: [
        {
          id: 'original',
          winning_team: 1,
          team1_side: 'pro',
          rfd: 'Original RFD text.',
          supersedes: null,
          submitted_at: '2026-09-10T18:30:00Z',
        },
        {
          id: 'correction',
          winning_team: 2,
          team1_side: 'pro',
          rfd: 'Corrected RFD text — team 2 actually won.',
          supersedes: 'original',
          submitted_at: '2026-09-11T09:00:00Z',
        },
      ],
    })
    const result = shapeArchiveRound(raw, [FALL], TZ)
    expect(result?.winningTeam).toBe(2)
    expect(result?.rfd).toBe('Corrected RFD text — team 2 actually won.')
  })

  it('returns null when the slot embed is missing', () => {
    const result = shapeArchiveRound(rawRound({ slots: null }), [FALL], TZ)
    expect(result).toBeNull()
  })

  it('splits debaters onto their team and sorts by name within a team', () => {
    const result = shapeArchiveRound(rawRound(), [FALL], TZ)
    expect(result?.debaters.map((d) => d.displayName)).toEqual(['Ann A.', 'Bo B.', 'Cam C.', 'Dee D.'])
    expect(result?.judge?.displayName).toBe('Jo J.')
  })
})

describe('shapeArchive', () => {
  it('filters to rounds where the person is a debater', () => {
    const rounds = [archiveRound({ id: 'r1' }), archiveRound({ id: 'r2', debaters: [] })]
    const result = shapeArchive(rounds, { person: 'd1' })
    expect(result.map((r) => r.id)).toEqual(['r1'])
  })

  it('filters to rounds where the person is the judge', () => {
    const rounds = [archiveRound({ id: 'r1' }), archiveRound({ id: 'r2', judge: null })]
    const result = shapeArchive(rounds, { person: 'j1' })
    expect(result.map((r) => r.id)).toEqual(['r1'])
  })

  it('filters by term', () => {
    const rounds = [
      archiveRound({ id: 'r1', termId: 'term-fall' }),
      archiveRound({ id: 'r2', termId: 'term-winter' }),
    ]
    const result = shapeArchive(rounds, { term: 'term-winter' })
    expect(result.map((r) => r.id)).toEqual(['r2'])
  })

  it('filters to rounds with a video attached', () => {
    const rounds = [archiveRound({ id: 'r1', hasVideo: true }), archiveRound({ id: 'r2', hasVideo: false })]
    const result = shapeArchive(rounds, { video: true })
    expect(result.map((r) => r.id)).toEqual(['r1'])
  })

  it('searches the RFD text case-insensitively as a substring match', () => {
    const rounds = [
      archiveRound({ id: 'r1', rfd: 'The debate turned on a topicality violation.' }),
      archiveRound({ id: 'r2', rfd: 'A clean policy round, no theory at all.' }),
    ]
    const result = shapeArchive(rounds, { q: 'TOPICALITY' })
    expect(result.map((r) => r.id)).toEqual(['r1'])
  })

  it('combines all four filters with AND', () => {
    const rounds = [
      archiveRound({ id: 'match', termId: 'term-fall', hasVideo: true, rfd: 'won on topicality' }),
      archiveRound({ id: 'wrong-term', termId: 'term-winter', hasVideo: true, rfd: 'won on topicality' }),
      archiveRound({ id: 'no-video', termId: 'term-fall', hasVideo: false, rfd: 'won on topicality' }),
      archiveRound({ id: 'wrong-text', termId: 'term-fall', hasVideo: true, rfd: 'won on presumption' }),
    ]
    const result = shapeArchive(rounds, { person: 'd1', term: 'term-fall', video: true, q: 'topicality' })
    expect(result.map((r) => r.id)).toEqual(['match'])
  })

  it('sorts results newest first', () => {
    const rounds = [
      archiveRound({ id: 'oldest', startsAt: '2026-09-01T17:00:00Z' }),
      archiveRound({ id: 'newest', startsAt: '2026-09-15T17:00:00Z' }),
      archiveRound({ id: 'middle', startsAt: '2026-09-08T17:00:00Z' }),
    ]
    const result = shapeArchive(rounds, {})
    expect(result.map((r) => r.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('returns everything unfiltered when no filters are given', () => {
    const rounds = [archiveRound({ id: 'r1' }), archiveRound({ id: 'r2' })]
    const result = shapeArchive(rounds, {})
    expect(result).toHaveLength(2)
  })
})

describe('shapeRoundDetail', () => {
  function rawDetail(overrides: Partial<Parameters<typeof shapeRoundDetail>[0]> = {}) {
    return {
      id: 'r1',
      status: 'completed',
      slots: { label: 'P3', starts_at: '2026-09-10T17:00:00Z', ends_at: '2026-09-10T18:00:00Z' },
      round_participants: rawRound().round_participants,
      round_results: rawRound().round_results,
      round_links: [
        {
          id: 'link1',
          kind: 'video',
          url: 'https://drive.google.com/file/d/abc123',
          label: 'Round video',
          created_at: '2026-09-10T19:00:00Z',
          profiles: { display_name: 'Ann A.' },
        },
      ],
      ...overrides,
    }
  }

  it('maps links with kind, url, label, and who added them', () => {
    const result = shapeRoundDetail(rawDetail(), [FALL], TZ)
    expect(result?.links).toHaveLength(1)
    expect(result?.links[0]).toMatchObject({
      kind: 'video',
      url: 'https://drive.google.com/file/d/abc123',
      label: 'Round video',
      addedByDisplayName: 'Ann A.',
    })
  })

  it('uses only the current result, ignoring a superseded one', () => {
    const result = shapeRoundDetail(
      rawDetail({
        round_results: [
          { id: 'orig', winning_team: 1, team1_side: 'pro', rfd: 'original', supersedes: null, submitted_at: '2026-09-10T18:30:00Z' },
          { id: 'fix', winning_team: 2, team1_side: 'pro', rfd: 'corrected', supersedes: 'orig', submitted_at: '2026-09-11T09:00:00Z' },
        ],
      }),
      [FALL],
      TZ
    )
    expect(result?.winningTeam).toBe(2)
    expect(result?.rfd).toBe('corrected')
  })

  it('leaves winner/RFD null when no result has been submitted yet', () => {
    const result = shapeRoundDetail(rawDetail({ round_results: [] }), [FALL], TZ)
    expect(result?.rfd).toBeNull()
    expect(result?.winningTeam).toBeNull()
  })
})
