import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { ExportFileSource } from './ExportFileSource'
import { ExportError } from './errors'

type Entry = {
  title?: string
  string_list_data?: Array<Record<string, unknown>>
}

function entry(
  username: string,
  options: { title?: string; href?: string; value?: boolean } = {},
): Entry {
  return {
    title: options.title ?? username,
    string_list_data: [
      {
        href: options.href ?? `https://www.instagram.com/${username}/`,
        ...(options.value === false ? {} : { value: username }),
        timestamp: 1_700_000_000,
      },
    ],
  }
}

function file(name: string, content: string): File {
  const blob = new Blob([content], { type: 'application/json' })
  return Object.assign(blob, {
    name,
    webkitRelativePath: '',
    text: async () => content,
  }) as File
}

async function zipFile(files: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return Object.assign(new Blob([buffer], { type: 'application/zip' }), {
    name: 'instagram-export.zip',
    webkitRelativePath: '',
  }) as File
}

const followers = (entries: Entry[]) => JSON.stringify(entries)
const following = (entries: Entry[]) =>
  JSON.stringify({ relationships_following: entries })

describe('ExportFileSource', () => {
  it('reads single- and multi-page followers from a nested ZIP folder', async () => {
    const archive = await zipFile({
      'export/connections/followers_and_following/followers_2.json': followers([
        entry('bravo'),
      ]),
      'export/connections/followers_and_following/followers_1.json': followers([
        entry('alpha'),
      ]),
      'export/connections/followers_and_following/following.json': following([
        entry('charlie'),
      ]),
      'export/posts_1.json': '{not read',
    })

    const source = await ExportFileSource.fromFiles([archive])
    expect(
      (await source.getFollowers()).map(({ username }) => username),
    ).toEqual(['alpha', 'bravo'])
    expect(
      (await source.getFollowing()).map(({ username }) => username),
    ).toEqual(['charlie'])
  })

  it('accepts loose JSON files and both old and new following entry shapes', async () => {
    const source = await ExportFileSource.fromFiles([
      file('folder/followers.json', followers([entry('follower')])),
      file(
        'folder/following.json',
        following([
          entry('old-user', { title: '', value: true }),
          entry('new-user', {
            title: 'new-user',
            value: false,
            href: 'https://www.instagram.com/_u/new-user',
          }),
        ]),
      ),
    ])

    expect(
      (await source.getFollowing()).map(({ username }) => username),
    ).toEqual(['old-user', 'new-user'])
  })

  it('uses a username from href as a last fallback and sanitizes unsafe hrefs', async () => {
    const source = await ExportFileSource.fromFiles([
      file(
        'followers_1.json',
        followers([
          entry('ignored', {
            title: '',
            value: false,
            href: 'https://www.instagram.com/_u/from-href/?x=1',
          }),
        ]),
      ),
      file(
        'following.json',
        following([entry('safe-name', { href: 'javascript:alert(1)' })]),
      ),
    ])

    expect(await source.getFollowers()).toMatchObject([
      {
        username: 'from-href',
        href: 'https://www.instagram.com/_u/from-href/?x=1',
      },
    ])
    expect(await source.getFollowing()).toMatchObject([
      { href: 'https://www.instagram.com/safe-name/' },
    ])
  })

  it('parses optional export lists and ignores unrelated archive files', async () => {
    const archive = await zipFile({
      'connections/followers_and_following/followers_1.json': followers([
        entry('follower'),
      ]),
      'connections/followers_and_following/following.json': following([
        entry('following'),
      ]),
      'connections/followers_and_following/pending_follow_requests.json':
        JSON.stringify({
          relationships_follow_requests_sent: [entry('pending')],
        }),
      'connections/followers_and_following/recently_unfollowed_profiles.json':
        JSON.stringify({ relationships_unfollowed_users: [entry('former')] }),
      'messages/inbox.json': 'this is deliberately not JSON',
    })
    const source = await ExportFileSource.fromFiles([archive])
    expect(source.getPendingFollowRequests()).toMatchObject([
      { username: 'pending' },
    ])
    expect(source.getRecentlyUnfollowedProfiles()).toMatchObject([
      { username: 'former' },
    ])
  })

  it('warns when both valid export lists are empty', async () => {
    const source = await ExportFileSource.fromFiles([
      file('followers_1.json', followers([])),
      file('following.json', following([])),
    ])

    expect(source.warnings).toContain(
      'No follower or following entries were found in these export files.',
    )
  })

  it('reports the number of unreadable entries it skipped', async () => {
    const source = await ExportFileSource.fromFiles([
      file('followers_1.json', JSON.stringify([entry('valid-follower'), {}])),
      file(
        'following.json',
        following([entry('valid-following'), null as unknown as Entry]),
      ),
    ])

    expect(source.warnings).toContain(
      "2 entries couldn't be read and were skipped.",
    )
  })

  it('does not block the import when an optional extra is broken', async () => {
    const source = await ExportFileSource.fromFiles([
      file('followers_1.json', followers([entry('follower')])),
      file('following.json', following([entry('following')])),
      file('pending_follow_requests.json', '{'),
    ])

    expect(await source.getFollowers()).toHaveLength(1)
    expect(source.getPendingFollowRequests()).toEqual([])
    expect(source.warnings).toContain(
      "Your pending follow requests couldn't be read, so they're not shown.",
    )
  })

  it('uses JSON data when HTML files are also present', async () => {
    const source = await ExportFileSource.fromFiles([
      file('followers_1.html', '<html>'),
      file('following.html', '<html>'),
      file('followers_1.json', followers([entry('follower')])),
      file('following.json', following([entry('following')])),
    ])

    expect(await source.getFollowers()).toHaveLength(1)
    expect(await source.getFollowing()).toHaveLength(1)
  })

  it('encodes an untrusted username when it needs to build a profile URL', async () => {
    const source = await ExportFileSource.fromFiles([
      file(
        'followers_1.json',
        followers([
          entry('ignored', {
            title: '../?x',
            value: false,
            href: 'javascript:alert(1)',
          }),
        ]),
      ),
      file('following.json', following([])),
    ])

    expect(await source.getFollowers()).toMatchObject([
      { username: '../?x', href: 'https://www.instagram.com/..%2F%3Fx/' },
    ])
  })

  const failures: Array<[string, File[], ExportError['kind']]> = [
    [
      'HTML exports',
      [file('followers_1.html', '<html>'), file('following.html', '<html>')],
      'html-format',
    ],
    [
      'missing following',
      [file('followers_1.json', followers([]))],
      'missing-following',
    ],
    [
      'invalid JSON',
      [file('followers_1.json', '{'), file('following.json', following([]))],
      'invalid-json',
    ],
    [
      'garbage shape',
      [file('followers_1.json', '{}'), file('following.json', following([]))],
      'unexpected-shape',
    ],
  ]
  it.each(failures)(
    'reports a typed error for %s',
    async (_caseName, files, kind) => {
      await expect(ExportFileSource.fromFiles(files)).rejects.toMatchObject<
        Partial<ExportError>
      >({ kind })
    },
  )
})
