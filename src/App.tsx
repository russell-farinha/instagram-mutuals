import { useState } from 'react'
import { diff, type Account } from './core'
import {
  ExportComparison,
  LookupScreen,
  ResultsScreen,
  UploadScreen,
} from './components'
import {
  ApiLookupSource,
  ApifyProvider,
  ExportError,
  ExportFileSource,
} from './sources'

type Results = {
  followers: Account[]
  following: Account[]
  comparison: ReturnType<typeof diff>
  warnings: readonly string[]
  pending: readonly Account[]
  recentlyUnfollowed: readonly Account[]
  sourceLabel: string
  partial?: boolean
  isLookup?: boolean
}

function App() {
  const [results, setResults] = useState<Results>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [mode, setMode] = useState<'export' | 'lookup'>('export')

  const importFiles = async (files: File[]) => {
    setIsLoading(true)
    setError(undefined)
    try {
      const source = await ExportFileSource.fromFiles(files)
      const [followers, following] = await Promise.all([
        source.getFollowers(),
        source.getFollowing(),
      ])
      setResults({
        followers,
        following,
        comparison: diff(followers, following),
        warnings: source.warnings,
        pending: source.getPendingFollowRequests(),
        recentlyUnfollowed: source.getRecentlyUnfollowedProfiles(),
        sourceLabel: 'Instagram export',
      })
    } catch (caught) {
      setError(
        caught instanceof ExportError
          ? caught.message
          : 'Something went wrong while reading that file. Please try downloading your Instagram export again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const lookup = async ({
    username,
    token,
    maxResults,
    signal,
    onProgress,
  }: {
    username: string
    token: string
    maxResults: number
    signal: AbortSignal
    onProgress: (message: string) => void
  }) => {
    const source = new ApiLookupSource(username, new ApifyProvider(token), {
      maxResults,
      signal,
      onProgress: (kind, count) =>
        onProgress(
          `Fetching ${kind === 'followers' ? 'followers' : 'following'}… ${count.toLocaleString()} so far`,
        ),
    })
    const followers = await source.getFollowers()
    const following = await source.getFollowing()
    setResults({
      followers,
      following,
      comparison: diff(followers, following),
      warnings: source.warnings,
      pending: [],
      recentlyUnfollowed: [],
      sourceLabel: `Lookup · @${source.lookupUsername}`,
      partial: source.partial.followers || source.partial.following,
      isLookup: true,
    })
  }

  if (results) {
    return (
      <ResultsScreen
        followersCount={results.followers.length}
        followingCount={results.following.length}
        lists={{
          ...results.comparison,
          pending: results.pending,
          recentlyUnfollowed: results.recentlyUnfollowed,
        }}
        sourceLabel={results.sourceLabel}
        warnings={results.warnings}
        partialNotice={results.partial}
        comparisonSlot={
          !results.isLookup ? (
            <ExportComparison
              newerSnapshot={{
                followers: results.followers,
                following: results.following,
              }}
            />
          ) : undefined
        }
        startOverLabel={results.isLookup ? 'Look up another' : 'Start over'}
        onStartOver={() => {
          setResults(undefined)
          setError(undefined)
        }}
      />
    )
  }

  return mode === 'export' ? (
    <UploadScreen
      onFiles={importFiles}
      isLoading={isLoading}
      error={error}
      onTryAgain={() => setError(undefined)}
      onLookupInstead={() => setMode('lookup')}
    />
  ) : (
    <LookupScreen onLookup={lookup} onUseExport={() => setMode('export')} />
  )
}

export default App
