import type { Account, FollowDataSource } from '../core'
import type { LookupProvider } from './lookup/provider'

export function sanitizeLookupUsername(input: string): string {
  let username = input.trim().replace(/^@+/, '')
  const match = username.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i,
  )
  if (match) username = match[1]!
  username = username.replace(/^@+/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username))
    throw new Error(
      'Enter a valid Instagram username (letters, numbers, periods, and underscores only).',
    )
  return username
}

export class ApiLookupSource implements FollowDataSource {
  readonly partial: { followers: boolean; following: boolean } = {
    followers: false,
    following: false,
  }
  readonly warnings: string[] = []
  private readonly username: string

  constructor(
    username: string,
    private readonly provider: LookupProvider,
    private readonly options: {
      maxResults: number
      signal?: AbortSignal
      onProgress?: (kind: 'followers' | 'following', count: number) => void
    },
  ) {
    this.username = sanitizeLookupUsername(username)
  }

  get lookupUsername(): string {
    return this.username
  }

  async getFollowers(): Promise<Account[]> {
    return this.get('followers')
  }
  async getFollowing(): Promise<Account[]> {
    return this.get('following')
  }

  private async get(kind: 'followers' | 'following'): Promise<Account[]> {
    const result = await this.provider.fetchList(this.username, kind, {
      ...this.options,
      onProgress: ({ count }) => this.options.onProgress?.(kind, count),
    })
    this.partial[kind] = !result.complete
    const label = kind === 'followers' ? 'Followers' : 'Following'
    this.warnings.push(...result.notes.map((note) => `${label}: ${note}`))
    return result.accounts
  }
}
