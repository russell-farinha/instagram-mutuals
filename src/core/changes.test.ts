import { describe, expect, it } from 'vitest'
import { compareSnapshots } from './changes'
import type { Account } from './types'

const account = (username: string): Account => ({
  username,
  href: `https://instagram.com/${username}`,
})

describe('compareSnapshots', () => {
  it('returns empty changes for empty snapshots', () => {
    expect(
      compareSnapshots(
        { followers: [], following: [] },
        { followers: [], following: [] },
      ),
    ).toEqual({
      newFollowers: [],
      lostFollowers: [],
      newlyFollowed: [],
      unfollowed: [],
    })
  })

  it('returns empty changes for identical snapshots', () => {
    const snapshot = {
      followers: [account('follower')],
      following: [account('following')],
    }
    expect(compareSnapshots(snapshot, snapshot)).toEqual({
      newFollowers: [],
      lostFollowers: [],
      newlyFollowed: [],
      unfollowed: [],
    })
  })

  it('matches case-insensitively and preserves the appropriate snapshot order', () => {
    const older = {
      followers: [account('Gone-first'), account('still')],
      following: [account('unfollowed-first'), account('still')],
    }
    const newer = {
      followers: [account('NEW-first'), account('STILL')],
      following: [account('newly-followed-first'), account('still')],
    }

    expect(compareSnapshots(older, newer)).toEqual({
      newFollowers: [newer.followers[0]],
      lostFollowers: [older.followers[0]],
      newlyFollowed: [newer.following[0]],
      unfollowed: [older.following[0]],
    })
  })

  it('deduplicates using the first occurrence from each respective list', () => {
    const older = {
      followers: [account('gone'), account('GONE'), account('still')],
      following: [account('old-follow'), account('OLD-FOLLOW')],
    }
    const newer = {
      followers: [account('new'), account('NEW'), account('still')],
      following: [account('new-follow'), account('NEW-FOLLOW')],
    }
    expect(compareSnapshots(older, newer)).toEqual({
      newFollowers: [newer.followers[0]],
      lostFollowers: [older.followers[0]],
      newlyFollowed: [newer.following[0]],
      unfollowed: [older.following[0]],
    })
  })

  it('compares 100k-account lists quickly', () => {
    const size = 100_000
    const older = {
      followers: Array.from({ length: size }, (_, index) =>
        account(`f-${index}`),
      ),
      following: Array.from({ length: size }, (_, index) =>
        account(`g-${index}`),
      ),
    }
    const newer = {
      followers: Array.from({ length: size }, (_, index) =>
        account(`f-${index + 50_000}`),
      ),
      following: Array.from({ length: size }, (_, index) =>
        account(`g-${index + 50_000}`),
      ),
    }
    const startedAt = performance.now()
    const result = compareSnapshots(older, newer)

    expect(result.newFollowers).toHaveLength(50_000)
    expect(result.lostFollowers).toHaveLength(50_000)
    expect(result.newlyFollowed).toHaveLength(50_000)
    expect(result.unfollowed).toHaveLength(50_000)
    expect(performance.now() - startedAt).toBeLessThan(1_000)
  })
})
