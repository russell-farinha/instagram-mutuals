import type { Account } from '../core/types'

export type ParsedAccounts = {
  accounts: Account[]
  skipped: number
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodedInput(input: unknown): unknown {
  if (typeof input !== 'string') return input
  return JSON.parse(input) as unknown
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
}

function usernameFromHref(value: unknown): string | undefined {
  const href = nonEmptyString(value)
  if (!href) return undefined

  const withoutQuery = href.split(/[?#]/, 1)[0]?.replace(/\/+$/, '')
  if (!withoutQuery) return undefined
  const pathParts = withoutQuery.split('/').filter(Boolean)
  const lastPart = pathParts[pathParts.length - 1]
  return lastPart && lastPart !== '_u' ? lastPart : undefined
}

function safeHref(value: unknown, username: string): string {
  const suppliedHref = nonEmptyString(value)
  if (suppliedHref) {
    try {
      const url = new URL(suppliedHref)
      if (
        url.origin === 'https://www.instagram.com' ||
        url.origin === 'https://instagram.com'
      ) {
        return url.href
      }
    } catch {
      // Use the safe, generated profile URL below.
    }
  }
  return `https://www.instagram.com/${encodeURIComponent(username)}/`
}

function parseEntries(entries: unknown[]): ParsedAccounts {
  const accounts: Account[] = []
  let skipped = 0

  for (const entry of entries) {
    if (!isRecord(entry)) {
      skipped += 1
      continue
    }
    const strings = Array.isArray(entry.string_list_data)
      ? entry.string_list_data
      : []
    const firstString = strings[0]
    const stringData = isRecord(firstString) ? firstString : undefined
    const username =
      nonEmptyString(stringData?.value) ??
      nonEmptyString(entry.title) ??
      usernameFromHref(stringData?.href)

    if (!username) {
      skipped += 1
      continue
    }

    const timestamp = stringData?.timestamp
    accounts.push({
      username,
      href: safeHref(stringData?.href, username),
      ...(typeof timestamp === 'number' && Number.isFinite(timestamp)
        ? { timestamp }
        : {}),
    })
  }

  return { accounts, skipped }
}

function followerEntries(input: unknown): unknown[] | undefined {
  if (Array.isArray(input)) return input
  if (isRecord(input) && Array.isArray(input.relationships_followers)) {
    return input.relationships_followers
  }
  return undefined
}

function followingEntries(input: unknown): unknown[] | undefined {
  return isRecord(input) && Array.isArray(input.relationships_following)
    ? input.relationships_following
    : undefined
}

/** Parses follower export data and returns an empty list only for a valid empty export. */
export function parseFollowers(input: unknown): Account[] {
  return parseFollowersWithStats(input).accounts
}

export function parseFollowersWithStats(input: unknown): ParsedAccounts {
  const entries = followerEntries(decodedInput(input))
  if (!entries) throw new Error('Unexpected followers export shape')
  return parseEntries(entries)
}

/** Parses following export data and returns an empty list only for a valid empty export. */
export function parseFollowing(input: unknown): Account[] {
  return parseFollowingWithStats(input).accounts
}

export function parseFollowingWithStats(input: unknown): ParsedAccounts {
  const entries = followingEntries(decodedInput(input))
  if (!entries) throw new Error('Unexpected following export shape')
  return parseEntries(entries)
}

/** Parses the optional export lists, whose wrapper property has changed across exports. */
export function parseOptionalList(input: unknown): ParsedAccounts {
  const decoded = decodedInput(input)
  if (!isRecord(decoded)) throw new Error('Unexpected optional export shape')
  const entries = Object.values(decoded).find(Array.isArray)
  if (!entries) throw new Error('Unexpected optional export shape')
  return parseEntries(entries)
}
