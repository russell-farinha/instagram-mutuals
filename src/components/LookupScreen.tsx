import { useState } from 'react'
import { clearToken, getToken, setToken as saveToken } from '../lib/tokenStore'
import { formatQuotaReset } from '../sources'

type LookupScreenProps = {
  onLookup: (values: {
    username: string
    token: string
    maxResults: number
    signal: AbortSignal
    onProgress: (message: string) => void
  }) => Promise<void>
  onUseExport: () => void
}

const limits = [500, 1000, 5000, 20000]

export function LookupScreen({ onLookup, onUseExport }: LookupScreenProps) {
  const [token, setToken] = useState(() => getToken() ?? '')
  const [username, setUsername] = useState('')
  const [maxResults, setMaxResults] = useState(500)
  const [remember, setRemember] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const [controller, setController] = useState<AbortController>()
  const cost = ((maxResults * 2 * 0.85) / 1000).toFixed(2)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!token.trim()) {
      setError('Paste your Apify API token to continue.')
      return
    }
    const nextController = new AbortController()
    setController(nextController)
    setError(undefined)
    setProgress('Fetching followers… 0 so far')
    saveToken(token.trim(), remember)
    try {
      await onLookup({
        username,
        token: token.trim(),
        maxResults,
        signal: nextController.signal,
        onProgress: setProgress,
      })
    } catch (caught) {
      if (!nextController.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : 'Something went wrong. Please try again.',
        )
    } finally {
      setController(undefined)
      setProgress(undefined)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <button
          type="button"
          onClick={onUseExport}
          className="text-sm font-semibold underline"
        >
          ← Use my Instagram export instead
        </button>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
          Mutuals · quick lookup
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Look up a public username
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          For the most accurate answer, use your Instagram export instead.
        </p>
        <section className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Before you continue</p>
          <p className="mt-1">
            This uses Apify, a third-party provider. Your own token stays in
            your browser and is sent only to Apify. Public accounts only:
            private or missing accounts can look the same. Large or verified
            accounts may be cut short, and this service can break without
            warning.
          </p>
          <p className="mt-1">
            Apify charges from your credit, roughly $0.85 per 1,000 accounts;
            its free plan includes monthly credit. On the free plan this lookup
            is limited to about 2 lookups and 1,000 accounts a day (it resets
            daily at {formatQuotaReset()} your time). Your Instagram export is
            the accurate option.
          </p>
          <p className="mt-1">
            A token can access your Apify account, so you may prefer a separate
            or limited token; you can revoke it any time in Apify.
          </p>
          <p className="mt-1">
            Get a token in{' '}
            <a
              className="font-semibold underline"
              href="https://console.apify.com/settings/integrations"
              target="_blank"
              rel="noreferrer"
            >
              Apify settings and integrations
            </a>
            .
          </p>
        </section>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            {error}
          </p>
        ) : null}
        <form className="mt-6 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-semibold">
            Apify API token
            <div className="mt-1 flex gap-2">
              <input
                aria-label="Apify API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="rounded-lg border px-3 py-2"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label>
              <input
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                type="checkbox"
                className="mr-2"
              />
              Remember on this device
            </label>
            <button
              type="button"
              onClick={() => {
                clearToken()
                setToken('')
                setRemember(false)
              }}
              className="underline"
            >
              Forget token
            </button>
          </div>
          <label className="block text-sm font-semibold">
            Instagram username or profile link
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="block text-sm font-semibold">
            Max accounts per list
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {limits.map((limit) => (
                <option key={limit} value={limit}>
                  {limit.toLocaleString()}
                </option>
              ))}
            </select>
            <span className="ml-3 font-normal text-slate-600 dark:text-slate-300">
              Up to about ${cost} for both lists.
            </span>
          </label>
          {controller ? (
            <div className="flex items-center gap-3">
              <p aria-live="polite" className="text-sm">
                {progress}
              </p>
              <button
                type="button"
                onClick={() => controller.abort()}
                className="rounded-lg border px-3 py-2 font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white"
            >
              Look up username
            </button>
          )}
        </form>
      </div>
    </main>
  )
}
