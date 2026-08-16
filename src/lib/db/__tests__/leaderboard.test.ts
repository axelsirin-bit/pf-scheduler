import { describe, expect, it } from 'vitest'
import { shapeLeaderboard, type NamedEntry } from '../leaderboard'

function entry(overrides: Partial<NamedEntry> = {}): NamedEntry {
  return {
    userId: 'u1',
    displayName: 'A A.',
    debateRounds: 0,
    judgeRounds: 0,
    totalRounds: 0,
    ...overrides,
  }
}

describe('shapeLeaderboard', () => {
  it('marks onTrack from totalRounds vs expectedRoundsPerTerm, not a passed-in flag', () => {
    const entries = [
      entry({ userId: 'a', displayName: 'Ann A.', totalRounds: 8 }),
      entry({ userId: 'b', displayName: 'Bob B.', totalRounds: 7 }),
    ]
    const result = shapeLeaderboard(entries, 'a', 8)
    expect(result.onTrack.map((e) => e.userId)).toEqual(['a'])
  })

  it('lists on-track members alphabetically by display name, not ranked by total', () => {
    const entries = [
      entry({ userId: 'z', displayName: 'Zoe Z.', totalRounds: 10 }),
      entry({ userId: 'a', displayName: 'Amir A.', totalRounds: 8 }),
      entry({ userId: 'm', displayName: 'Mo M.', totalRounds: 9 }),
    ]
    const result = shapeLeaderboard(entries, 'a', 8)
    expect(result.onTrack.map((e) => e.displayName)).toEqual(['Amir A.', 'Mo M.', 'Zoe Z.'])
  })

  it('ranks the top five by total rounds descending, breaking ties alphabetically', () => {
    const entries = [
      entry({ userId: 'a', displayName: 'Zed Z.', totalRounds: 5 }),
      entry({ userId: 'b', displayName: 'Amy A.', totalRounds: 5 }),
      entry({ userId: 'c', displayName: 'Mo M.', totalRounds: 10 }),
    ]
    const result = shapeLeaderboard(entries, 'a', 8)
    expect(result.topFive.map((e) => e.displayName)).toEqual(['Mo M.', 'Amy A.', 'Zed Z.'])
  })

  it('caps the top five at exactly five entries', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      entry({ userId: `u${i}`, displayName: `Person ${i}`, totalRounds: 8 - i })
    )
    const result = shapeLeaderboard(entries, 'u0', 8)
    expect(result.topFive).toHaveLength(5)
    expect(result.topFive.map((e) => e.userId)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4'])
  })

  it("finds the current user's own entry regardless of where they rank", () => {
    const entries = [
      entry({ userId: 'top', displayName: 'Top T.', totalRounds: 20 }),
      entry({ userId: 'me', displayName: 'Me M.', totalRounds: 1 }),
    ]
    const result = shapeLeaderboard(entries, 'me', 8)
    expect(result.currentUser).toEqual({ userId: 'me', displayName: 'Me M.', debateRounds: 0, judgeRounds: 0, totalRounds: 1, onTrack: false })
  })

  it('returns null for currentUser when the viewer has no entry (e.g. zero-member edge case)', () => {
    const result = shapeLeaderboard([], 'someone', 8)
    expect(result.currentUser).toBeNull()
    expect(result.onTrack).toEqual([])
    expect(result.topFive).toEqual([])
  })

  it('passes expectedRoundsPerTerm straight through for display', () => {
    const result = shapeLeaderboard([], 'x', 12)
    expect(result.expectedRoundsPerTerm).toBe(12)
  })

  it('keeps debate and judge counts as separate fields on every entry', () => {
    const entries = [entry({ userId: 'a', debateRounds: 3, judgeRounds: 2, totalRounds: 5 })]
    const result = shapeLeaderboard(entries, 'a', 8)
    expect(result.currentUser?.debateRounds).toBe(3)
    expect(result.currentUser?.judgeRounds).toBe(2)
    expect(result.currentUser?.totalRounds).toBe(5)
  })
})
