import JSZip from 'jszip'

import type { Account, FollowDataSource } from '../core/types'
import { ExportError } from './errors'
import {
  parseFollowersWithStats,
  parseFollowingWithStats,
  parseOptionalList,
  type ParsedAccounts,
} from './exportParser'

type NamedJson = { name: string; text: () => Promise<string> }
type CollectedFiles = {
  followers: NamedJson[]
  following: NamedJson[]
  pending: NamedJson[]
  recentlyUnfollowed: NamedJson[]
  hasHtmlExportFile: boolean
  recognized: boolean
}

const followersName = /^followers(?:_\d+)?\.json$/i
const followersHtmlName = /^followers(?:_\d+)?\.html$/i
const followingName = /^following\.json$/i
const pendingName = /^pending_follow_requests\.json$/i
const recentlyUnfollowedName = /^recently_unfollowed_profiles\.json$/i

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] ?? path
}

function isInFollowersAndFollowingDirectory(path: string): boolean {
  return path.replace(/\\/g, '/').split('/').includes('followers_and_following')
}

function addNamedFile(
  collected: CollectedFiles,
  file: NamedJson,
  requireExportDirectory = false,
): void {
  if (requireExportDirectory && !isInFollowersAndFollowingDirectory(file.name))
    return
  const name = basename(file.name)
  if (followersHtmlName.test(name) || name.toLowerCase() === 'following.html') {
    collected.hasHtmlExportFile = true
    collected.recognized = true
  } else if (followersName.test(name)) {
    collected.followers.push(file)
    collected.recognized = true
  } else if (followingName.test(name)) {
    collected.following.push(file)
    collected.recognized = true
  } else if (pendingName.test(name)) {
    collected.pending.push(file)
  } else if (recentlyUnfollowedName.test(name)) {
    collected.recentlyUnfollowed.push(file)
  }
}

function emptyCollection(): CollectedFiles {
  return {
    followers: [],
    following: [],
    pending: [],
    recentlyUnfollowed: [],
    hasHtmlExportFile: false,
    recognized: false,
  }
}

function mergeCollection(target: CollectedFiles, source: CollectedFiles): void {
  target.followers.push(...source.followers)
  target.following.push(...source.following)
  target.pending.push(...source.pending)
  target.recentlyUnfollowed.push(...source.recentlyUnfollowed)
  target.hasHtmlExportFile ||= source.hasHtmlExportFile
  target.recognized ||= source.recognized
}

async function filesFromZip(file: File): Promise<CollectedFiles> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new ExportError('unreadable-zip')
  }

  const collected = emptyCollection()
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    addNamedFile(
      collected,
      { name: entry.name, text: () => entry.async('text') },
      true,
    )
  }
  return collected
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ExportError('invalid-json')
  }
}

async function parseMany(
  files: NamedJson[],
  parser: (input: unknown) => ParsedAccounts,
): Promise<ParsedAccounts> {
  const accounts: Account[] = []
  let skipped = 0
  for (const file of files) {
    let parsed: ParsedAccounts
    try {
      parsed = parser(parseJson(await file.text()))
    } catch (error) {
      if (error instanceof ExportError) throw error
      throw new ExportError('unexpected-shape')
    }
    accounts.push(...parsed.accounts)
    skipped += parsed.skipped
  }
  return { accounts, skipped }
}

async function parseOptionalMany(
  files: NamedJson[],
  warning: string,
): Promise<{ parsed: ParsedAccounts; warnings: string[] }> {
  const accounts: Account[] = []
  let skipped = 0
  let failed = false

  for (const file of files) {
    try {
      const parsed = parseOptionalList(parseJson(await file.text()))
      accounts.push(...parsed.accounts)
      skipped += parsed.skipped
    } catch {
      failed = true
    }
  }

  return {
    parsed: { accounts, skipped },
    warnings: failed ? [warning] : [],
  }
}

export class ExportFileSource implements FollowDataSource {
  private constructor(
    private readonly followers: Account[],
    private readonly following: Account[],
    readonly warnings: readonly string[],
    private readonly pending: Account[],
    private readonly recentlyUnfollowed: Account[],
  ) {}

  static async fromFiles(files: File[]): Promise<ExportFileSource> {
    const collected = emptyCollection()
    for (const file of files) {
      const path = file.webkitRelativePath || file.name
      if (file.name.toLowerCase().endsWith('.zip')) {
        mergeCollection(collected, await filesFromZip(file))
      } else {
        addNamedFile(collected, { name: path, text: () => file.text() })
      }
    }

    if (
      collected.hasHtmlExportFile &&
      (collected.followers.length === 0 || collected.following.length === 0)
    ) {
      throw new ExportError('html-format')
    }
    if (!collected.recognized) throw new ExportError('not-an-export')
    if (collected.followers.length === 0)
      throw new ExportError('missing-followers')
    if (collected.following.length === 0)
      throw new ExportError('missing-following')

    collected.followers.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true }),
    )
    const [followers, following, pendingResult, recentlyUnfollowedResult] =
      await Promise.all([
        parseMany(collected.followers, parseFollowersWithStats),
        parseMany(collected.following, parseFollowingWithStats),
        parseOptionalMany(
          collected.pending,
          "Your pending follow requests couldn't be read, so they're not shown.",
        ),
        parseOptionalMany(
          collected.recentlyUnfollowed,
          "Your recently unfollowed profiles couldn't be read, so they're not shown.",
        ),
      ])

    const pending = pendingResult.parsed
    const recentlyUnfollowed = recentlyUnfollowedResult.parsed

    const skipped =
      followers.skipped +
      following.skipped +
      pending.skipped +
      recentlyUnfollowed.skipped
    const warnings: string[] = []
    warnings.push(
      ...pendingResult.warnings,
      ...recentlyUnfollowedResult.warnings,
    )
    if (skipped > 0)
      warnings.push(`${skipped} entries couldn't be read and were skipped.`)
    if (followers.accounts.length === 0 && following.accounts.length === 0) {
      warnings.push(
        'No follower or following entries were found in these export files.',
      )
    }

    return new ExportFileSource(
      followers.accounts,
      following.accounts,
      warnings,
      pending.accounts,
      recentlyUnfollowed.accounts,
    )
  }

  async getFollowers(): Promise<Account[]> {
    return this.followers
  }

  async getFollowing(): Promise<Account[]> {
    return this.following
  }

  getPendingFollowRequests(): readonly Account[] {
    return this.pending
  }

  getRecentlyUnfollowedProfiles(): readonly Account[] {
    return this.recentlyUnfollowed
  }
}
