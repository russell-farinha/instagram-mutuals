import { normalizeUsername, type Account } from '../../core'
import {
  lookupError,
  type LookupKind,
  type LookupProvider,
  type LookupResult,
} from './provider'

const api = 'https://api.apify.com'
const actor =
  'scraping_solutions~instagram-scraper-followers-following-no-cookies'
const terminalStatuses = new Set([
  'SUCCEEDED',
  'FAILED',
  'ABORTED',
  'TIMED-OUT',
])

type Run = {
  id: string
  status: string
  defaultDatasetId: string
  defaultKeyValueStoreId: string
}

type Summary = {
  status: string
  resultsDelivered?: number
  continuations: Array<{
    hasNextPage: boolean
    nextContinuationToken?: string
  }>
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseRun(value: unknown): Run | undefined {
  const data = record(record(value)?.data)
  const id = string(data?.id)
  const status = string(data?.status)
  const dataset = string(data?.defaultDatasetId)
  const store = string(data?.defaultKeyValueStoreId)
  return id && status && dataset && store
    ? { id, status, defaultDatasetId: dataset, defaultKeyValueStoreId: store }
    : undefined
}

function parseSummary(value: unknown): Summary | undefined {
  const data = record(value)
  const status = string(data?.status)
  const rawContinuations = data?.continuations
  if (!status || !Array.isArray(rawContinuations)) return undefined
  const continuations: Summary['continuations'] = []
  for (const item of rawContinuations) {
    const continuation = record(item)
    if (!continuation || typeof continuation.hasNextPage !== 'boolean')
      return undefined
    // Apify sends `null` rather than omitting the token on the last page.
    const token = continuation.nextContinuationToken ?? undefined
    if (token !== undefined && typeof token !== 'string') return undefined
    continuations.push({
      hasNextPage: continuation.hasNextPage,
      nextContinuationToken: token,
    })
  }
  const delivered = data?.resultsDelivered ?? undefined
  if (delivered !== undefined && number(delivered) === undefined)
    return undefined
  return { status, resultsDelivered: number(delivered), continuations }
}

function parseItems(
  value: unknown,
  kind: LookupKind,
): { accounts: Account[]; skipped: number } | undefined {
  if (!Array.isArray(value)) return undefined
  const accounts: Account[] = []
  let skipped = 0
  for (const item of value) {
    const row = record(item)
    const username = string(row?.username)
    const expectedType = kind === 'followers' ? 'Followers' : 'Followings'
    if (
      !row ||
      !username ||
      string(row.type) !== expectedType ||
      string(row.id) === undefined
    ) {
      skipped += 1
      continue
    }
    accounts.push({
      username,
      href: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    })
  }
  if (value.length > 0 && accounts.length === 0) return undefined
  return { accounts, skipped }
}

export class ApifyProvider implements LookupProvider {
  constructor(
    private readonly token: string,
    // Wrapped so fetch is never invoked with `this` set to the provider, which
    // browsers reject with "Illegal invocation".
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
  ) {}

  async fetchList(
    username: string,
    kind: LookupKind,
    opts: Parameters<LookupProvider['fetchList']>[2],
  ): Promise<LookupResult> {
    const accounts = new Map<string, Account>()
    const notes: string[] = []
    let continuationToken: string | undefined
    let hasNextPage = false
    let complete = false
    let activeRunId: string | undefined
    const abort = async () => {
      if (!activeRunId) return
      try {
        await this.fetcher(
          `${api}/v2/actor-runs/${encodeURIComponent(activeRunId)}/abort`,
          {
            method: 'POST',
            headers: this.headers(),
          },
        )
      } catch {
        /* cancellation should still finish promptly */
      }
    }
    const cancelled = async (): Promise<never> => {
      await abort()
      throw lookupError('cancelled')
    }

    while (accounts.size < opts.maxResults) {
      if (opts.signal?.aborted) await cancelled()
      const remaining = opts.maxResults - accounts.size
      const resultsLimit = Math.max(25, Math.min(remaining, 1000))
      const body: Record<string, unknown> = {
        Account: [username],
        resultsLimit,
        dataToScrape: kind === 'followers' ? 'Followers' : 'Followings',
      }
      if (continuationToken) body.continuationToken = continuationToken
      const started = await this.request(
        `${api}/v2/acts/${actor}/runs?waitForFinish=60`,
        {
          method: 'POST',
          headers: { ...this.headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: opts.signal,
        },
        cancelled,
      )
      let run = parseRun(started)
      if (!run) throw lookupError('unexpected-response')
      activeRunId = run.id
      while (!terminalStatuses.has(run.status)) {
        const polled = await this.request(
          `${api}/v2/actor-runs/${encodeURIComponent(run.id)}?waitForFinish=60`,
          { headers: this.headers(), signal: opts.signal },
          cancelled,
        )
        run = parseRun(polled)
        if (!run) throw lookupError('unexpected-response')
      }
      if (run.status !== 'SUCCEEDED') throw lookupError('provider-unavailable')
      const output = await this.request(
        `${api}/v2/key-value-stores/${encodeURIComponent(run.defaultKeyValueStoreId)}/records/OUTPUT`,
        { headers: this.headers(), signal: opts.signal },
        cancelled,
      )
      const summary = parseSummary(output)
      if (!summary) throw lookupError('unexpected-response')
      if (summary.status === 'NO_RESULTS') {
        if (accounts.size === 0) throw lookupError('not-found-or-private')
        notes.push(
          'A continuation ended before the provider finished the list.',
        )
        complete = false
        break
      }
      // e.g. FREE_API_DAILY_LIMIT_REACHED, reported inside a SUCCEEDED run.
      if (/LIMIT|QUOTA|CREDIT|USAGE/i.test(summary.status))
        throw lookupError('quota-exhausted')
      if (summary.status !== 'SUCCEEDED')
        throw lookupError('unexpected-response')
      const fetched = await this.items(
        run.defaultDatasetId,
        kind,
        opts.signal,
        cancelled,
      )
      if (fetched.skipped > 0)
        notes.push(
          fetched.skipped === 1
            ? "1 account from the provider couldn't be read and was skipped."
            : `${fetched.skipped} accounts from the provider couldn't be read and were skipped.`,
        )
      for (const account of fetched.accounts) {
        if (accounts.size >= opts.maxResults) break
        accounts.set(normalizeUsername(account.username), account)
      }
      opts.onProgress?.({ kind, count: accounts.size })
      const continuation = summary.continuations[0]
      hasNextPage = continuation?.hasNextPage === true
      continuationToken = continuation?.nextContinuationToken
      if (
        summary.resultsDelivered !== undefined &&
        fetched.accounts.length < summary.resultsDelivered
      )
        notes.push(
          'The provider returned fewer accounts than it expected to deliver.',
        )
      if (!hasNextPage) {
        complete = notes.length === 0
        break
      }
      if (!continuationToken) throw lookupError('unexpected-response')
    }
    if (hasNextPage || accounts.size >= opts.maxResults) {
      complete = false
      notes.push('The provider returned only part of this list.')
    }
    return { accounts: [...accounts.values()], complete, notes }
  }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}` }
  }

  private async items(
    datasetId: string,
    kind: LookupKind,
    signal: AbortSignal | undefined,
    cancelled: () => Promise<never>,
  ): Promise<{ accounts: Account[]; skipped: number }> {
    const result: Account[] = []
    let skipped = 0
    for (let offset = 0; ; offset += 1000) {
      const response = await this.request(
        `${api}/v2/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&offset=${offset}&limit=1000`,
        { headers: this.headers(), signal },
        cancelled,
      )
      const page = parseItems(response, kind)
      if (!page) throw lookupError('unexpected-response')
      result.push(...page.accounts)
      skipped += page.skipped
      if (page.accounts.length + page.skipped < 1000)
        return { accounts: result, skipped }
    }
  }

  private async request(
    url: string,
    init: RequestInit,
    cancelled: () => Promise<never>,
  ): Promise<unknown> {
    try {
      if (init.signal?.aborted) return cancelled()
      const response = await this.fetcher(url, init)
      if (response.status === 401) throw lookupError('invalid-token')
      if (response.status === 402 || response.status === 403)
        throw lookupError('quota-exhausted')
      if (response.status === 429) throw lookupError('rate-limited')
      if (response.status >= 500) throw lookupError('provider-unavailable')
      if (!response.ok) {
        let errorType = ''
        try {
          const errorBody = record(await response.json())
          errorType = string(record(errorBody?.error)?.type) ?? ''
        } catch {
          /* use the generic error below */
        }
        if (/(usage|limit|credit|plan)/i.test(errorType))
          throw lookupError('quota-exhausted')
        throw lookupError('unexpected-response')
      }
      try {
        return await response.json()
      } catch {
        throw lookupError('unexpected-response')
      }
    } catch (caught) {
      if (
        init.signal?.aborted ||
        (caught instanceof DOMException && caught.name === 'AbortError')
      )
        return cancelled()
      if (typeof caught === 'object' && caught !== null && 'kind' in caught)
        throw caught
      throw lookupError('provider-unavailable')
    }
  }
}
