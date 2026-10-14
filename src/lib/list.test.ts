import { describe, expect, it } from 'vitest'
import {
  filterAndSortAccounts,
  formatFollowDate,
  formatMutualRate,
} from './list'

const accounts = [
  { username: 'Zoe', href: 'https://instagram.com/zoe/', timestamp: 10 },
  { username: '@anna', href: 'https://instagram.com/anna/', timestamp: 20 },
  { username: 'Ben', href: 'https://instagram.com/ben/' },
]

describe('list presentation helpers', () => {
  it('filters usernames case-insensitively and sorts them', () => {
    expect(
      filterAndSortAccounts(accounts, 'AN', 'username-asc').map(
        (item) => item.username,
      ),
    ).toEqual(['@anna'])
    expect(
      filterAndSortAccounts(accounts, '', 'username-desc').map(
        (item) => item.username,
      ),
    ).toEqual(['Zoe', 'Ben', '@anna'])
  })

  it('handles mutual rates and dates safely', () => {
    expect(formatMutualRate(2, 3)).toBe('67%')
    expect(formatMutualRate(0, 0)).toBe('—')
    expect(formatFollowDate(0)).toBeTruthy()
    expect(formatFollowDate(Number.NaN)).toBeUndefined()
  })
})
