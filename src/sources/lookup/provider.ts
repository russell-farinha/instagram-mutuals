import type { Account } from '../../core'

export type LookupKind = 'followers' | 'following'

export type LookupProgress = {
  kind: LookupKind
  count: number
}

export type LookupResult = {
  accounts: Account[]
  complete: boolean
  notes: readonly string[]
}

export type LookupErrorKind =
  | 'invalid-token'
  | 'quota-exhausted'
  | 'not-found-or-private'
  | 'rate-limited'
  | 'provider-unavailable'
  | 'cancelled'
  | 'unexpected-response'

const messages: Record<LookupErrorKind, string> = {
  'invalid-token': 'That Apify token was not accepted. Check it and try again.',
  'quota-exhausted':
    'Your Apify account has reached its usage limit. Free Apify plans can only run this lookup a limited amount each day, so try again tomorrow, or add credit in Apify.',
  'not-found-or-private':
    "We couldn't get a list for this account. It may not exist, may be private, or may have no followers.",
  'rate-limited': 'The provider is busy. Please try again shortly.',
  'provider-unavailable':
    'The lookup provider is unavailable right now. Please try again later, or use your Instagram export instead.',
  cancelled: 'Lookup cancelled.',
  'unexpected-response':
    "The lookup provider returned something we couldn't read. Please try again later, or use your Instagram export instead.",
}

export type LookupError = Error & {
  kind: LookupErrorKind
}

export function lookupError(kind: LookupErrorKind): LookupError {
  const error = new Error(messages[kind]) as LookupError
  error.name = 'LookupError'
  error.kind = kind
  return error
}

export function isLookupError(value: unknown): value is LookupError {
  return value instanceof Error && 'kind' in value
}

export interface LookupProvider {
  fetchList(
    username: string,
    kind: LookupKind,
    opts: {
      maxResults: number
      signal?: AbortSignal
      onProgress?: (progress: LookupProgress) => void
    },
  ): Promise<LookupResult>
}
