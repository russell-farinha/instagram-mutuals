import { describe, expect, it, vi } from 'vitest'
import { ApifyProvider } from './apifyProvider'
import { formatQuotaReset } from './provider'

const fakeCredential = 'test-credential'
const run = (id: string, status = 'SUCCEEDED') => ({
  data: {
    id,
    status,
    defaultDatasetId: `dataset-${id}`,
    defaultKeyValueStoreId: `store-${id}`,
  },
})
const summary = (hasNextPage = false, nextContinuationToken?: string) => ({
  status: 'SUCCEEDED',
  continuations: [
    {
      hasNextPage,
      ...(nextContinuationToken ? { nextContinuationToken } : {}),
    },
  ],
})
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

describe('ApifyProvider', () => {
  it('follows a continuation, deduplicates accounts, and only sends credentials to Apify headers', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary(true, 'next')))
      .mockResolvedValueOnce(
        response([{ username: 'One', type: 'Followers', id: '1' }]),
      )
      .mockResolvedValueOnce(response(run('two')))
      .mockResolvedValueOnce(response(summary()))
      .mockResolvedValueOnce(
        response([
          { username: 'one', type: 'Followers', id: '1' },
          { username: 'Two', type: 'Followers', id: '2' },
        ]),
      )
    const result = await new ApifyProvider(fakeCredential, fetcher).fetchList(
      'sample',
      'followers',
      { maxResults: 1000 },
    )
    expect(result.accounts.map((account) => account.username)).toEqual([
      'one',
      'Two',
    ])
    expect(result.complete).toBe(true)
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toMatch(/^https:\/\/api\.apify\.com\//)
      expect(url).not.toContain(fakeCredential)
      expect(new Headers(init.headers).get('Authorization')).toBe(
        `Bearer ${fakeCredential}`,
      )
    }
  })

  it.each([
    [401, 'invalid-token'],
    [402, 'quota-exhausted'],
    [403, 'quota-exhausted'],
    [429, 'rate-limited'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    const fetcher = vi.fn().mockResolvedValue(response({}, status))
    await expect(
      new ApifyProvider(fakeCredential, fetcher).fetchList(
        'sample',
        'followers',
        { maxResults: 25 },
      ),
    ).rejects.toMatchObject({ kind })
  })

  it('maps network failures and malformed payloads to safe errors', async () => {
    await expect(
      new ApifyProvider(
        fakeCredential,
        vi.fn().mockRejectedValue(new Error('offline')),
      ).fetchList('sample', 'followers', { maxResults: 25 }),
    ).rejects.toMatchObject({ kind: 'provider-unavailable' })
    await expect(
      new ApifyProvider(
        fakeCredential,
        vi.fn().mockResolvedValue(response({ nope: true })),
      ).fetchList('sample', 'followers', { maxResults: 25 }),
    ).rejects.toMatchObject({ kind: 'unexpected-response' })
    await expect(
      new ApifyProvider(
        fakeCredential,
        vi.fn().mockResolvedValue(response({}, 503)),
      ).fetchList('sample', 'followers', { maxResults: 25 }),
    ).rejects.toMatchObject({ kind: 'provider-unavailable' })
  })

  it('maps NO_RESULTS and marks a max-results stop incomplete', async () => {
    const noResults = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(
        response({ status: 'NO_RESULTS', continuations: [] }),
      )
    await expect(
      new ApifyProvider(fakeCredential, noResults).fetchList(
        'sample',
        'followers',
        { maxResults: 25 },
      ),
    ).rejects.toMatchObject({ kind: 'not-found-or-private' })
    const capped = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary(true, 'next')))
      .mockResolvedValueOnce(
        response([{ username: 'one', type: 'Followers', id: '1' }]),
      )
    const result = await new ApifyProvider(fakeCredential, capped).fetchList(
      'sample',
      'followers',
      { maxResults: 1 },
    )
    expect(result.complete).toBe(false)
  })

  it('keeps collected accounts when a continuation returns NO_RESULTS', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary(true, 'next')))
      .mockResolvedValueOnce(
        response([{ username: 'one', type: 'Followers', id: '1' }]),
      )
      .mockResolvedValueOnce(response(run('two')))
      .mockResolvedValueOnce(
        response({ status: 'NO_RESULTS', continuations: [] }),
      )
    const result = await new ApifyProvider(fakeCredential, fetcher).fetchList(
      'sample',
      'followers',
      { maxResults: 1000 },
    )
    expect(result.accounts.map((account) => account.username)).toEqual(['one'])
    expect(result.complete).toBe(false)
    expect(result.notes.join(' ')).toContain('continuation ended')
  })

  it('skips malformed provider items but rejects an entirely malformed page', async () => {
    const partlyMalformed = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary()))
      .mockResolvedValueOnce(
        response([
          { username: 'one', type: 'Followers', id: '1' },
          { username: 42 },
        ]),
      )
    const result = await new ApifyProvider(
      fakeCredential,
      partlyMalformed,
    ).fetchList('sample', 'followers', { maxResults: 1000 })
    expect(result.accounts).toHaveLength(1)
    expect(result.notes.join(' ')).toContain(
      "1 account from the provider couldn't be read",
    )

    const entirelyMalformed = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary()))
      .mockResolvedValueOnce(response([{ username: 42 }]))
    await expect(
      new ApifyProvider(fakeCredential, entirelyMalformed).fetchList(
        'sample',
        'followers',
        { maxResults: 1000 },
      ),
    ).rejects.toMatchObject({ kind: 'unexpected-response' })
  })

  it.each(['FAILED', 'TIMED-OUT', 'ABORTED'])(
    'maps %s runs to provider-unavailable',
    async (status) => {
      const failed = vi.fn().mockResolvedValue(response(run('one', status)))
      await expect(
        new ApifyProvider(fakeCredential, failed).fetchList(
          'sample',
          'followers',
          { maxResults: 25 },
        ),
      ).rejects.toMatchObject({ kind: 'provider-unavailable' })
    },
  )

  it('continues polling while a run is timing out', async () => {
    const timingOut = vi
      .fn()
      .mockResolvedValueOnce(response(run('one', 'TIMING-OUT')))
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(response(summary()))
      .mockResolvedValueOnce(response([]))
    await expect(
      new ApifyProvider(fakeCredential, timingOut).fetchList(
        'sample',
        'followers',
        { maxResults: 25 },
      ),
    ).resolves.toMatchObject({ complete: true })
  })

  it('aborts an active run when cancelled', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/runs?')) {
        controller.abort()
        return response({
          data: {
            id: 'one',
            status: 'RUNNING',
            defaultDatasetId: 'dataset-one',
            defaultKeyValueStoreId: 'store-one',
          },
        })
      }
      return response({})
    })
    await expect(
      new ApifyProvider(fakeCredential, fetcher).fetchList(
        'sample',
        'followers',
        { maxResults: 25, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ kind: 'cancelled' })
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).endsWith('/actor-runs/one/abort'),
      ),
    ).toBe(true)
  })

  it('calls the global fetch unbound, as browsers require', async () => {
    // Browsers throw "Illegal invocation" when fetch runs with a foreign `this`.
    const browserLikeFetch = vi.fn(function (this: unknown) {
      if (this !== undefined && this !== globalThis)
        throw new TypeError('Illegal invocation')
      return Promise.resolve(response({ error: {} }, 401))
    })
    vi.stubGlobal('fetch', browserLikeFetch)
    try {
      await expect(
        new ApifyProvider(fakeCredential).fetchList('someone', 'followers', {
          maxResults: 25,
        }),
      ).rejects.toMatchObject({ kind: 'invalid-token' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('maps a daily-limit OUTPUT status to quota-exhausted', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(run('one')))
      .mockResolvedValueOnce(
        response({ status: 'FREE_API_DAILY_LIMIT_REACHED', continuations: [] }),
      )
    await expect(
      new ApifyProvider(fakeCredential, fetcher).fetchList(
        'someone',
        'followers',
        { maxResults: 25 },
      ),
    ).rejects.toMatchObject({ kind: 'quota-exhausted' })
  })

  it('formats the next UTC-midnight quota reset in local time', () => {
    const now = new Date(Date.UTC(2026, 9, 14, 22, 18))
    const expected = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(Date.UTC(2026, 9, 15)))
    expect(formatQuotaReset(now)).toBe(expected)
  })
})
