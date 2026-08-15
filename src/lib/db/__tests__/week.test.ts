import { describe, expect, it } from 'vitest'
import { shapeWeekGrid, type RawCalendarDay } from '../week'

const WEEKDAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']
const NOW = new Date('2026-09-16T12:00:00.000Z')

function slot(overrides: Partial<RawCalendarDay['slots'][number]> = {}) {
  return {
    id: 'slot-1',
    label: 'Morning Block',
    starts_at: '2026-09-14T12:00:00.000Z',
    ends_at: '2026-09-14T13:00:00.000Z',
    availabilities: [],
    rounds: [],
    ...overrides,
  }
}

describe('shapeWeekGrid', () => {
  it('marks a date with no calendar_days row as no data, distinct from a real holiday', () => {
    const holiday: RawCalendarDay = {
      date: '2026-09-15',
      is_school_day: false,
      note: 'Labor Day',
      slots: [],
    }

    const result = shapeWeekGrid(WEEKDAYS, [holiday], 'user-1', ['debater'], NOW)

    const missing = result.find((d) => d.date === '2026-09-14')!
    expect(missing.isSchoolDay).toBeNull()
    expect(missing.note).toBeNull()
    expect(missing.slots).toEqual([])

    const holidayDay = result.find((d) => d.date === '2026-09-15')!
    expect(holidayDay.isSchoolDay).toBe(false)
    expect(holidayDay.note).toBe('Labor Day')
    expect(holidayDay.slots).toEqual([])
  })

  it('never includes a room for a non-participant, non-admin viewer on a confirmed round', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          rounds: [
            {
              id: 'round-1',
              status: 'confirmed',
              room_freetext: 'Room 204 (backup)',
              created_at: '2026-09-01T00:00:00.000Z',
              rooms: { name: 'Room 204' },
              round_participants: [{ user_id: 'debater-a' }, { user_id: 'debater-b' }],
            },
          ],
        }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'outsider', ['debater'], NOW)
    const shapedSlot = result[0].slots[0]

    expect(shapedSlot.roundStatus).toBe('confirmed')
    expect(shapedSlot.room).toBeNull()
    // the raw room name/freetext must not survive anywhere in the output
    expect(JSON.stringify(shapedSlot)).not.toContain('Room 204')
  })

  it('shows the room to a participant and to an admin who is not a participant', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          rounds: [
            {
              id: 'round-1',
              status: 'confirmed',
              room_freetext: null,
              created_at: '2026-09-01T00:00:00.000Z',
              rooms: { name: 'Room 204' },
              round_participants: [{ user_id: 'debater-a' }],
            },
          ],
        }),
      ],
    }

    const asParticipant = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    expect(asParticipant[0].slots[0].room).toBe('Room 204')

    const asAdmin = shapeWeekGrid(WEEKDAYS, [day], 'admin-1', ['admin'], NOW)
    expect(asAdmin[0].slots[0].room).toBe('Room 204')
  })

  it('hides the room for a forming round even from a participant, since only confirmed rounds have a settled room', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          rounds: [
            {
              id: 'round-1',
              status: 'forming',
              room_freetext: null,
              created_at: '2026-09-01T00:00:00.000Z',
              rooms: { name: 'Room 204' },
              round_participants: [{ user_id: 'debater-a' }],
            },
          ],
        }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    expect(result[0].slots[0].room).toBeNull()
    expect(result[0].slots[0].roundStatus).toBe('forming')
    expect(result[0].slots[0].roundCount).toBe(1)
  })

  it('synthesizes "open" status and null room count when no round exists', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [slot()],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    expect(result[0].slots[0].roundStatus).toBe('open')
    expect(result[0].slots[0].roundCount).toBeNull()
    expect(result[0].slots[0].room).toBeNull()
  })

  it('lists available names sorted, dropping any availability row with no matching profile', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          availabilities: [
            { profiles: { display_name: 'Zoe T.' } },
            { profiles: { display_name: 'Amir K.' } },
            { profiles: null },
          ],
        }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    expect(result[0].slots[0].availableNames).toEqual(['Amir K.', 'Zoe T.'])
    expect(result[0].slots[0].availableCount).toBe(2)
  })

  it('dims a slot whose start time has already passed relative to now', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({ id: 'past', starts_at: '2026-09-14T08:00:00.000Z' }),
        slot({ id: 'future', starts_at: '2026-09-18T20:00:00.000Z' }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    const byId = Object.fromEntries(result[0].slots.map((s) => [s.id, s]))
    expect(byId.past.isPast).toBe(true)
    expect(byId.future.isPast).toBe(false)
  })

  it('sorts slots within a day by start time regardless of input order', () => {
    const day: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({ id: 'later', starts_at: '2026-09-14T18:00:00.000Z' }),
        slot({ id: 'earlier', starts_at: '2026-09-14T12:00:00.000Z' }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [day], 'debater-a', ['debater'], NOW)
    expect(result[0].slots.map((s) => s.id)).toEqual(['earlier', 'later'])
  })

  it('prefers a live round over a cancelled one on the same slot, and falls back to the most recent dead round if that is all there is', () => {
    const withLiveAndDead: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          rounds: [
            {
              id: 'cancelled-round',
              status: 'cancelled',
              room_freetext: null,
              created_at: '2026-09-02T00:00:00.000Z',
              rooms: null,
              round_participants: [],
            },
            {
              id: 'forming-round',
              status: 'forming',
              room_freetext: null,
              created_at: '2026-09-01T00:00:00.000Z',
              rooms: null,
              round_participants: [{ user_id: 'a' }],
            },
          ],
        }),
      ],
    }

    const result = shapeWeekGrid(WEEKDAYS, [withLiveAndDead], 'a', ['debater'], NOW)
    expect(result[0].slots[0].roundStatus).toBe('forming')

    const onlyDead: RawCalendarDay = {
      date: '2026-09-14',
      is_school_day: true,
      note: null,
      slots: [
        slot({
          rounds: [
            {
              id: 'expired-1',
              status: 'expired',
              room_freetext: null,
              created_at: '2026-09-01T00:00:00.000Z',
              rooms: null,
              round_participants: [],
            },
            {
              id: 'expired-2',
              status: 'cancelled',
              room_freetext: null,
              created_at: '2026-09-02T00:00:00.000Z',
              rooms: null,
              round_participants: [],
            },
          ],
        }),
      ],
    }

    const deadResult = shapeWeekGrid(WEEKDAYS, [onlyDead], 'a', ['debater'], NOW)
    // most recently created of the dead rounds wins
    expect(deadResult[0].slots[0].roundStatus).toBe('cancelled')
  })
})
