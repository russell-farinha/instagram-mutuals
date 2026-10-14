import { useState } from 'react'
import { diff, type Account } from './core'
import { ExportComparison, ResultsScreen, UploadScreen } from './components'
import { ExportError, ExportFileSource } from './sources'

type Results = {
  followers: Account[]
  following: Account[]
  comparison: ReturnType<typeof diff>
  warnings: readonly string[]
  pending: readonly Account[]
  recentlyUnfollowed: readonly Account[]
}

function App() {
  const [results, setResults] = useState<Results>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

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
        sourceLabel="Instagram export"
        warnings={results.warnings}
        comparisonSlot={
          <ExportComparison
            newerSnapshot={{
              followers: results.followers,
              following: results.following,
            }}
          />
        }
        onStartOver={() => {
          setResults(undefined)
          setError(undefined)
        }}
      />
    )
  }

  return (
    <UploadScreen
      onFiles={importFiles}
      isLoading={isLoading}
      error={error}
      onTryAgain={() => setError(undefined)}
    />
  )
}

export default App
