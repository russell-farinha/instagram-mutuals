import { normalizeUsername, type Account } from '../core'

export type SortOption =
  'username-asc' | 'username-desc' | 'date-newest' | 'date-oldest'

export function hasDates(accounts: readonly Account[]): boolean {
  return accounts.some((account) => account.timestamp !== undefined)
}

export function filterAndSortAccounts(
  accounts: readonly Account[],
  query: string,
  sort: SortOption,
): Account[] {
  const normalizedQuery = normalizeUsername(query)
  const filtered = normalizedQuery
    ? accounts.filter((account) =>
        normalizeUsername(account.username).includes(normalizedQuery),
      )
    : [...accounts]

  return filtered.sort((left, right) => {
    if (sort === 'date-newest' || sort === 'date-oldest') {
      const leftDate = left.timestamp ?? 0
      const rightDate = right.timestamp ?? 0
      const difference =
        sort === 'date-newest' ? rightDate - leftDate : leftDate - rightDate
      if (difference !== 0) return difference
    }
    const difference = normalizeUsername(left.username).localeCompare(
      normalizeUsername(right.username),
    )
    return sort === 'username-desc' ? -difference : difference
  })
}

export function formatMutualRate(mutuals: number, following: number): string {
  if (following === 0) return '—'
  return `${Math.round((mutuals / following) * 100)}%`
}

export function formatFollowDate(timestamp?: number): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return undefined
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
