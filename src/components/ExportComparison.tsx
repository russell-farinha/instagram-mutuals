import {
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  compareSnapshots,
  type Account,
  type Snapshot,
  type SnapshotChanges,
} from '../core'
import { filterAndSortAccounts } from '../lib'
import { ExportError, ExportFileSource } from '../sources'

type ExportComparisonProps = { newerSnapshot: Snapshot }

type ChangeTab = {
  id: keyof SnapshotChanges
  label: string
  accounts: readonly Account[]
  emptyMessage: string
}

const pageSize = 200

function maxTimestamp(snapshot: Snapshot): number | undefined {
  let latest: number | undefined
  for (const account of [...snapshot.followers, ...snapshot.following]) {
    if (account.timestamp !== undefined && Number.isFinite(account.timestamp))
      latest = Math.max(latest ?? account.timestamp, account.timestamp)
  }
  return latest
}

async function readSnapshot(files: File[]): Promise<Snapshot> {
  const source = await ExportFileSource.fromFiles(files)
  const [followers, following] = await Promise.all([
    source.getFollowers(),
    source.getFollowing(),
  ])
  return { followers, following }
}

export function ExportComparison({ newerSnapshot }: ExportComparisonProps) {
  const input = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const prefix = useId()
  const [changes, setChanges] = useState<SnapshotChanges>()
  const [swapped, setSwapped] = useState(false)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] =
    useState<keyof SnapshotChanges>('newFollowers')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(pageSize)

  const tabs = useMemo<ChangeTab[]>(() => {
    if (!changes) return []
    return [
      {
        id: 'newFollowers',
        label: 'New followers',
        accounts: changes.newFollowers,
        emptyMessage: 'No new followers in these exports.',
      },
      {
        id: 'lostFollowers',
        label: 'No longer following you',
        accounts: changes.lostFollowers,
        emptyMessage: 'No one stopped following you in these exports.',
      },
      {
        id: 'newlyFollowed',
        label: 'You started following',
        accounts: changes.newlyFollowed,
        emptyMessage:
          'You did not start following anyone new in these exports.',
      },
      {
        id: 'unfollowed',
        label: 'You unfollowed',
        accounts: changes.unfollowed,
        emptyMessage: 'You did not unfollow anyone in these exports.',
      },
    ]
  }, [changes])
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  const activeAccounts = active?.accounts
  const displayed = useMemo(
    () =>
      activeAccounts
        ? filterAndSortAccounts(activeAccounts, query, 'username-asc')
        : [],
    [activeAccounts, query],
  )

  const importOlder = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!files.length) return
    setLoading(true)
    setError(undefined)
    try {
      const selected = await readSnapshot(files)
      const shouldSwap =
        (maxTimestamp(selected) ?? -Infinity) >
        (maxTimestamp(newerSnapshot) ?? Infinity)
      setChanges(
        compareSnapshots(
          shouldSwap ? newerSnapshot : selected,
          shouldSwap ? selected : newerSnapshot,
        ),
      )
      setSwapped(shouldSwap)
      setActiveId('newFollowers')
      setQuery('')
      setVisible(pageSize)
    } catch (caught) {
      setError(
        caught instanceof ExportError
          ? caught.message
          : 'Something went wrong while reading that file. Please try downloading your Instagram export again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
            tabs.length
    setActiveId(tabs[target]!.id)
    setQuery('')
    setVisible(pageSize)
    tabRefs.current[target]?.focus()
  }

  return (
    <section
      aria-label="Compare exports"
      className="mt-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Compare with an older export</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Choose an earlier Instagram export to see the changes between the
            two snapshots.
          </p>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {loading ? 'Reading export…' : 'Choose older export'}
        </button>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          onChange={importOlder}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
        >
          {error}
        </p>
      ) : null}
      {changes && active ? (
        <div className="mt-6">
          {swapped ? (
            <p
              role="status"
              className="mb-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100"
            >
              The export you selected appears to be newer, so we compared them
              in date order.
            </p>
          ) : null}
          <h2 className="text-lg font-bold">What changed</h2>
          <div
            role="tablist"
            aria-label="Changes"
            className="mt-3 flex overflow-x-auto border-b border-slate-200 dark:border-slate-800"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                role="tab"
                id={`${prefix}-${tab.id}-tab`}
                aria-selected={tab.id === active.id}
                aria-controls={`${prefix}-${tab.id}-panel`}
                tabIndex={tab.id === active.id ? 0 : -1}
                onClick={() => {
                  setActiveId(tab.id)
                  setQuery('')
                  setVisible(pageSize)
                }}
                onKeyDown={(event) => moveTab(event, index)}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 ${tab.id === active.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-600 dark:text-slate-300'}`}
              >
                {tab.label}{' '}
                <span className="ml-1 text-xs tabular-nums">
                  {tab.accounts.length.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${prefix}-${active.id}-panel`}
            aria-labelledby={`${prefix}-${active.id}-tab`}
            className="pt-3"
          >
            <label className="block text-sm font-medium">
              Search {active.label.toLowerCase()}
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setVisible(pageSize)
                }}
                type="search"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-950"
                placeholder="Search a username"
              />
            </label>
            <p
              className="mt-4 text-sm text-slate-600 dark:text-slate-300"
              aria-live="polite"
            >
              {displayed.length.toLocaleString()}{' '}
              {displayed.length === 1 ? 'account' : 'accounts'}
              {query ? ' found' : ''}.
            </p>
            {displayed.length ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayed.slice(0, visible).map((account, index) => (
                  <li key={`${account.href}-${index}`} className="py-3">
                    <a
                      href={account.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 dark:text-indigo-300"
                    >
                      {account.username}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">
                {query
                  ? 'No usernames match that search.'
                  : active.emptyMessage}
              </p>
            )}
            {visible < displayed.length ? (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((current) => current + pageSize)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Show 200 more
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
