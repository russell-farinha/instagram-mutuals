import type { Account } from './types'

export type DiffResult = {
  mutuals: Account[]
  notFollowingBack: Account[]
  fans: Account[]
}

/** Returns the comparison key used for an account username. */
export function normalizeUsername(username: string): string {
  const trimmed = username.trim()
  const withoutPrefix = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed

  return withoutPrefix.toLowerCase()
}

function uniqueAccounts(accounts: Account[]): Map<string, Account> {
  const unique = new Map<string, Account>()

  for (const account of accounts) {
    const username = normalizeUsername(account.username)

    if (username && !unique.has(username)) {
      unique.set(username, account)
    }
  }

  return unique
}

export function diff(followers: Account[], following: Account[]): DiffResult {
  const uniqueFollowers = uniqueAccounts(followers)
  const uniqueFollowing = uniqueAccounts(following)
  const mutuals: Account[] = []
  const notFollowingBack: Account[] = []
  const fans: Account[] = []

  for (const [username, account] of uniqueFollowing) {
    if (uniqueFollowers.has(username)) {
      // Mutuals use the following-side account so its timestamp is when you followed them.
      mutuals.push(account)
    } else {
      notFollowingBack.push(account)
    }
  }

  for (const [username, account] of uniqueFollowers) {
    if (!uniqueFollowing.has(username)) {
      fans.push(account)
    }
  }

  return { mutuals, notFollowingBack, fans }
}
