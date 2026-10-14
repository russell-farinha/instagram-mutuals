import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { Account } from '../core'
import {
  accountsToCsv,
  filterAndSortAccounts,
  formatFollowDate,
  formatMutualRate,
  hasDates,
  type SortOption,
} from '../lib'
import { Footer } from './Footer'

type ResultLists = {
  notFollowingBack: Account[]
  fans: Account[]
  mutuals: Account[]
  pending?: readonly Account[]
  recentlyUnfollowed?: readonly Account[]
}

type ResultsScreenProps = {
  followersCount: number
  followingCount: number
  lists: ResultLists
  sourceLabel: string
  warnings?: readonly string[]
  partialNotice?: boolean
  comparisonSlot?: ReactNode
  onStartOver: () => void
  startOverLabel?: string
}

type Tab = {
  id: keyof ResultLists
  label: string
  accounts: readonly Account[]
}
const pageSize = 200

function downloadCsv(accounts: readonly Account[], label: string): void {
  const blob = new Blob([accountsToCsv(accounts)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mutuals-${label.toLowerCase().replace(/ /g, '-')}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 250)
}

function dateLabel(tabId: Tab['id'], date: string): string {
  const prefixes: Record<Tab['id'], string> = {
    notFollowingBack: 'You followed them',
    fans: 'Followed you',
    mutuals: 'You followed them',
    pending: 'Requested',
    recentlyUnfollowed: 'Unfollowed',
  }
  return `${prefixes[tabId]} ${date}`
}

function emptyMessage(tabId: Tab['id']): string {
  const messages: Record<Tab['id'], string> = {
    notFollowingBack: 'Everyone you follow follows you back.',
    fans: 'You follow back everyone who follows you.',
    mutuals: 'No mutuals yet.',
    pending: 'No pending follow requests.',
    recentlyUnfollowed: 'No recently unfollowed profiles.',
  }
  return messages[tabId]
}

export function ResultsScreen({
  followersCount,
  followingCount,
  lists,
  sourceLabel,
  warnings = [],
  partialNotice = false,
  comparisonSlot,
  onStartOver,
  startOverLabel = 'Start over',
}: ResultsScreenProps) {
  const prefix = useId()
  const tabs = useMemo<Tab[]>(() => {
    const base: Tab[] = [
      {
        id: 'notFollowingBack',
        label: 'Not following back',
        accounts: lists.notFollowingBack,
      },
      { id: 'fans', label: 'Your fans', accounts: lists.fans },
      { id: 'mutuals', label: 'Mutuals', accounts: lists.mutuals },
    ]
    if (lists.pending?.length)
      base.push({
        id: 'pending',
        label: 'Pending requests',
        accounts: lists.pending,
      })
    if (lists.recentlyUnfollowed?.length)
      base.push({
        id: 'recentlyUnfollowed',
        label: 'Recently unfollowed',
        accounts: lists.recentlyUnfollowed,
      })
    return base
  }, [lists])
  const [activeId, setActiveId] = useState<Tab['id']>('notFollowingBack')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('username-asc')
  const [visible, setVisible] = useState(pageSize)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]!
  const supportsDateSort = hasDates(active.accounts)
  const displayed = useMemo(
    () =>
      filterAndSortAccounts(
        active.accounts,
        query,
        supportsDateSort
          ? sort
          : sort.startsWith('date-')
            ? 'username-asc'
            : sort,
      ),
    [active.accounts, query, sort, supportsDateSort],
  )

  const selectTab = (id: Tab['id']) => {
    setActiveId(id)
    setQuery('')
    setVisible(pageSize)
    setSort('username-asc')
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
    selectTab(tabs[target]!.id)
    tabRefs.current[target]?.focus()
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
              Mutuals · {sourceLabel}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Your connections, at a glance
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              A private, gentle way to see how your lists overlap.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartOver}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            {startOverLabel}
          </button>
        </header>

        <section
          aria-label="Summary"
          className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <Stat label="Followers" value={followersCount} />
          <Stat label="Following" value={followingCount} />
          <Stat label="Mutuals" value={lists.mutuals.length} />
          <Stat
            label="Mutual rate"
            value={formatMutualRate(lists.mutuals.length, followingCount)}
          />
        </section>

        {warnings.length > 0 ? (
          <section
            aria-label="Import notes"
            className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold">A small note about this export</p>
            {warnings.map((warning) => (
              <p key={warning} className="mt-1">
                {warning}
              </p>
            ))}
          </section>
        ) : null}

        {partialNotice ? (
          <section
            role="alert"
            className="mt-5 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold">These results are incomplete</p>
            <p className="mt-1">
              Instagram or the provider returned only part of a list, so “not
              following back” and “your fans” may include people who actually do
              follow back.
            </p>
          </section>
        ) : null}

        <section className="mt-7 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div
            role="tablist"
            aria-label="Connection lists"
            className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                role="tab"
                id={`${prefix}-${tab.id}-tab`}
                aria-selected={active.id === tab.id}
                aria-controls={`${prefix}-${tab.id}-panel`}
                tabIndex={active.id === tab.id ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => moveTab(event, index)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-600 ${active.id === tab.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
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
            className="p-4 sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="block min-w-0 flex-1 text-sm font-medium">
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
              <div className="flex gap-2">
                <label className="text-sm font-medium">
                  Sort
                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as SortOption)
                    }
                    className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="username-asc">Username A–Z</option>
                    <option value="username-desc">Username Z–A</option>
                    {supportsDateSort ? (
                      <>
                        <option value="date-newest">Date: newest</option>
                        <option value="date-oldest">Date: oldest</option>
                      </>
                    ) : null}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => downloadCsv(displayed, active.label)}
                  className="self-end whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Download CSV
                </button>
              </div>
            </div>
            <p
              className="mt-4 text-sm text-slate-600 dark:text-slate-300"
              aria-live="polite"
            >
              {displayed.length.toLocaleString()}{' '}
              {displayed.length === 1 ? 'account' : 'accounts'}
              {query ? ' found' : ''}.
            </p>
            {displayed.length === 0 ? (
              <p className="py-10 text-center text-slate-600 dark:text-slate-300">
                {query
                  ? 'No usernames match that search.'
                  : emptyMessage(active.id)}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {displayed.slice(0, visible).map((account, index) => (
                  <li
                    key={`${account.href}-${index}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <a
                      href={account.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
                    >
                      {account.username}
                    </a>
                    {formatFollowDate(account.timestamp) ? (
                      <time
                        className="shrink-0 text-sm text-slate-500 dark:text-slate-400"
                        dateTime={new Date(
                          account.timestamp! * 1000,
                        ).toISOString()}
                      >
                        {dateLabel(
                          active.id,
                          formatFollowDate(account.timestamp)!,
                        )}
                      </time>
                    ) : null}
                  </li>
                ))}
              </ul>
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
        </section>
        {comparisonSlot}
        <Footer />
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <dl className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </dd>
    </dl>
  )
}
