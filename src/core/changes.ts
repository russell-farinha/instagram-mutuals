import { normalizeUsername } from './diff'
import type { Account } from './types'

export type Snapshot = {
  followers: readonly Account[]
  following: readonly Account[]
}

export type SnapshotChanges = {
  newFollowers: Account[]
  lostFollowers: Account[]
  newlyFollowed: Account[]
  unfollowed: Account[]
}

function uniqueAccounts(accounts: readonly Account[]): Map<string, Account> {
  const unique = new Map<string, Account>()

  for (const account of accounts) {
    const username = normalizeUsername(account.username)
    if (username && !unique.has(username)) unique.set(username, account)
  }

  return unique
}

function accountsMissingFrom(
  accounts: readonly Account[],
  comparison: Map<string, Account>,
): Account[] {
  const unique = uniqueAccounts(accounts)
  return [...unique].flatMap(([username, account]) =>
    comparison.has(username) ? [] : [account],
  )
}

/** Compares two account snapshots without depending on how they were collected. */
export function compareSnapshots(
  older: Snapshot,
  newer: Snapshot,
): SnapshotChanges {
  const olderFollowers = uniqueAccounts(older.followers)
  const newerFollowers = uniqueAccounts(newer.followers)
  const olderFollowing = uniqueAccounts(older.following)
  const newerFollowing = uniqueAccounts(newer.following)

  return {
    newFollowers: accountsMissingFrom(newer.followers, olderFollowers),
    lostFollowers: accountsMissingFrom(older.followers, newerFollowers),
    newlyFollowed: accountsMissingFrom(newer.following, olderFollowing),
    unfollowed: accountsMissingFrom(older.following, newerFollowing),
  }
}
