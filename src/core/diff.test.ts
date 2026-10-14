import { describe, expect, it } from 'vitest'

import { diff, normalizeUsername } from './diff'
import type { Account } from './types'

const account = (username: string, timestamp?: number): Account => ({
  username,
  href: `https://instagram.com/${username}`,
  ...(timestamp === undefined ? {} : { timestamp }),
})

describe('normalizeUsername', () => {
  it('trims whitespace, ignores one leading at sign, and matches case-insensitively', () => {
    expect(normalizeUsername('  @SomeOne  ')).toBe('someone')
  })
})

describe('diff', () => {
  it('returns empty groups for empty lists', () => {
    expect(diff([], [])).toEqual({
      mutuals: [],
      notFollowingBack: [],
      fans: [],
    })
  })

  it('handles either list appearing alone', () => {
    expect(diff([account('follower')], [])).toEqual({
      mutuals: [],
      notFollowingBack: [],
      fans: [account('follower')],
    })
    expect(diff([], [account('following')])).toEqual({
      mutuals: [],
      notFollowingBack: [account('following')],
      fans: [],
    })
  })

  it('places fully overlapping lists in mutuals', () => {
    const followers = [account('one'), account('two')]
    const following = [account('one'), account('two')]

    expect(diff(followers, following)).toEqual({
      mutuals: following,
      notFollowingBack: [],
      fans: [],
    })
  })

  it('keeps non-overlapping lists separate', () => {
    const followers = [account('fan')]
    const following = [account('not-back')]

    expect(diff(followers, following)).toEqual({
      mutuals: [],
      notFollowingBack: following,
      fans: followers,
    })
  })

  it('matches case differences, at prefixes, and surrounding whitespace', () => {
    const follower = account('  @MiXeDCaSe  ')
    const following = account('mixedcase')

    expect(diff([follower], [following]).mutuals).toEqual([following])
  })

  it('drops empty usernames and collapses duplicates using first occurrences', () => {
    const firstFollower = account('duplicate')
    const secondFollower = account('DUPLICATE')
    const firstFollowing = account('@duplicate')
    const secondFollowing = account(' duplicate ')

    expect(
      diff(
        [account('  '), account('@'), firstFollower, secondFollower],
        [account(''), firstFollowing, secondFollowing],
      ),
    ).toEqual({
      mutuals: [firstFollowing],
      notFollowingBack: [],
      fans: [],
    })
  })

  it('preserves the input order for each source list', () => {
    const followers = [
      account('fan-first'),
      account('mutual-last'),
      account('fan-last'),
    ]
    const following = [
      account('not-back-first'),
      account('mutual-last'),
      account('not-back-last'),
    ]

    expect(diff(followers, following)).toEqual({
      mutuals: [following[1]],
      notFollowingBack: [following[0], following[2]],
      fans: [followers[0], followers[2]],
    })
  })

  it('uses the following-side account for mutual timestamps', () => {
    const follower = account('mutual', 10)
    const following = account('MUTUAL', 20)

    expect(diff([follower], [following]).mutuals).toEqual([following])
  })

  it('compares 150k accounts per side in well under one second', () => {
    const size = 150_000
    const followers = Array.from({ length: size }, (_, index) =>
      account(`user-${index}`),
    )
    const following = Array.from({ length: size }, (_, index) =>
      account(`user-${index + size / 2}`),
    )
    const startedAt = performance.now()
    const result = diff(followers, following)
    const duration = performance.now() - startedAt

    expect(result.mutuals).toHaveLength(75_000)
    expect(result.notFollowingBack).toHaveLength(75_000)
    expect(result.fans).toHaveLength(75_000)
    expect(duration).toBeLessThan(1_000)
  })
})
