import { describe, expect, it } from 'vitest'
import { shapeSlotDetail, shapeJudgingQueue, type RawSlotDetail } from '../rounds'

const NOW = new Date('2026-09-16T12:00:00.000Z')

function baseSlot(overrides: Partial<RawSlotDetail> = {}): RawSlotDetail {
  return {
    id: 'slot-1',
    label: 'Morning Block',
    starts_at: '2026-09-18T12:00:00.000Z',
    ends_at: '2026-09-18T13:00:00.000Z',
    is_open: true,
    availabilities: [],
    rounds: [],
    ...overrides,
  }
}

describe('shapeSlotDetail', () => {
  it('returns a null round and empty available list for a bare slot', () => {
    const result = shapeSlotDetail(baseSlot(), 'user-1', ['debater'], NOW)
    expect(result.round).toBeNull()
    expect(result.available).toEqual([])
    expect(result.isPast).toBe(false)
  })

  it('never includes a room for a non-participant, non-admin viewer on a confirmed round', () => {
    const slot = baseSlot({
      rounds: [
        {
          id: 'round-1',
          status: 'confirmed',
          created_by: 'debater-a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: 'Room 204 (backup)',
          rooms: { name: 'Room 204' },
          round_participants: [
            { user_id: 'debater-a', role: 'debater', team: 1, profiles: { display_name: 'A D.' } },
          ],
        },
      ],
    })

    const result = shapeSlotDetail(slot, 'outsider', ['debater'], NOW)
    expect(result.round?.status).toBe('confirmed')
    expect(result.round?.room).toBeNull()
    expect(JSON.stringify(result)).not.toContain('Room 204')
  })

  it('shows the room to a participant and to an admin who is not a participant', () => {
    const slot = baseSlot({
      rounds: [
        {
          id: 'round-1',
          status: 'confirmed',
          created_by: 'debater-a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: null,
          rooms: { name: 'Room 204' },
          round_participants: [
            { user_id: 'debater-a', role: 'debater', team: 1, profiles: { display_name: 'A D.' } },
          ],
        },
      ],
    })

    expect(shapeSlotDetail(slot, 'debater-a', ['debater'], NOW).round?.room).toBe('Room 204')
    expect(shapeSlotDetail(slot, 'admin-1', ['admin'], NOW).round?.room).toBe('Room 204')
  })

  it('flags needsRoom when confirmed with no room set, and never for a forming round', () => {
    const confirmedNoRoom = baseSlot({
      rounds: [
        {
          id: 'round-1',
          status: 'confirmed',
          created_by: 'a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: null,
          rooms: null,
          round_participants: [],
        },
      ],
    })
    expect(shapeSlotDetail(confirmedNoRoom, 'a', ['debater'], NOW).round?.needsRoom).toBe(true)

    const forming = baseSlot({
      rounds: [
        {
          id: 'round-1',
          status: 'forming',
          created_by: 'a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: null,
          rooms: null,
          round_participants: [],
        },
      ],
    })
    expect(shapeSlotDetail(forming, 'a', ['debater'], NOW).round?.needsRoom).toBe(false)
  })

  it('prefers a live round over a cancelled one on the same slot', () => {
    const slot = baseSlot({
      rounds: [
        {
          id: 'cancelled',
          status: 'cancelled',
          created_by: 'a',
          created_at: '2026-09-02T00:00:00.000Z',
          room_freetext: null,
          rooms: null,
          round_participants: [],
        },
        {
          id: 'forming',
          status: 'forming',
          created_by: 'a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: null,
          rooms: null,
          round_participants: [],
        },
      ],
    })
    expect(shapeSlotDetail(slot, 'a', ['debater'], NOW).round?.id).toBe('forming')
  })

  it('drops any participant row with no matching profile and lists available sorted', () => {
    const slot = baseSlot({
      availabilities: [
        { user_id: 'z', profiles: { display_name: 'Zoe T.' } },
        { user_id: 'a', profiles: { display_name: 'Amir K.' } },
        { user_id: 'ghost', profiles: null },
      ],
      rounds: [
        {
          id: 'round-1',
          status: 'forming',
          created_by: 'a',
          created_at: '2026-09-01T00:00:00.000Z',
          room_freetext: null,
          rooms: null,
          round_participants: [
            { user_id: 'a', role: 'debater', team: 1, profiles: { display_name: 'Amir K.' } },
            { user_id: 'ghost', role: 'debater', team: 2, profiles: null },
          ],
        },
      ],
    })

    const result = shapeSlotDetail(slot, 'a', ['debater'], NOW)
    expect(result.available.map((a) => a.displayName)).toEqual(['Amir K.', 'Zoe T.'])
    expect(result.round?.participants).toEqual([{ userId: 'a', displayName: 'Amir K.', role: 'debater', team: 1 }])
  })

  it('marks a slot in the past', () => {
    const slot = baseSlot({ starts_at: '2026-09-01T00:00:00.000Z' })
    expect(shapeSlotDetail(slot, 'a', ['debater'], NOW).isPast).toBe(true)
  })
})

describe('shapeJudgingQueue', () => {
  function round(overrides: Partial<Parameters<typeof shapeJudgingQueue>[0][number]> = {}) {
    return {
      id: 'round-1',
      slots: { id: 'slot-1', label: 'Morning Block', starts_at: '2026-09-18T12:00:00.000Z', ends_at: '2026-09-18T13:00:00.000Z' },
      round_participants: [],
      ...overrides,
    }
  }

  it('excludes rounds that already have a judge', () => {
    const rounds = [round({ round_participants: [{ user_id: 'j', role: 'judge' }] })]
    expect(shapeJudgingQueue(rounds, 'someone-else', NOW)).toEqual([])
  })

  it('excludes rounds whose slot has already started', () => {
    const rounds = [round({ slots: { id: 's', label: 'Past', starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-09-01T01:00:00.000Z' } })]
    expect(shapeJudgingQueue(rounds, 'viewer', NOW)).toEqual([])
  })

  it("excludes rounds the viewer is already a participant in, so they can't collide with the one-row-per-user constraint", () => {
    const rounds = [round({ round_participants: [{ user_id: 'viewer', role: 'debater' }] })]
    expect(shapeJudgingQueue(rounds, 'viewer', NOW)).toEqual([])
  })

  it('includes an eligible round with the right debater count, sorted soonest first', () => {
    const rounds = [
      round({
        id: 'later',
        slots: { id: 's2', label: 'Later', starts_at: '2026-09-19T12:00:00.000Z', ends_at: '2026-09-19T13:00:00.000Z' },
        round_participants: [
          { user_id: 'd1', role: 'debater' },
          { user_id: 'd2', role: 'debater' },
        ],
      }),
      round({
        id: 'sooner',
        slots: { id: 's1', label: 'Sooner', starts_at: '2026-09-18T12:00:00.000Z', ends_at: '2026-09-18T13:00:00.000Z' },
        round_participants: [{ user_id: 'd1', role: 'debater' }],
      }),
    ]

    const result = shapeJudgingQueue(rounds, 'viewer', NOW)
    expect(result.map((r) => r.roundId)).toEqual(['sooner', 'later'])
    expect(result[0].debaterCount).toBe(1)
    expect(result[1].debaterCount).toBe(2)
  })
})
