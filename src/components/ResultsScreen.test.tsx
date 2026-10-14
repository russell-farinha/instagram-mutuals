import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { Account } from '../core'
import { ResultsScreen } from './ResultsScreen'

afterEach(cleanup)

const account = (username: string): Account => ({
  username,
  href: `https://instagram.com/${username}/`,
})

function renderResults(
  lists = {
    notFollowingBack: [account('alex')],
    fans: [account('bea')],
    mutuals: [] as Account[],
  },
) {
  return render(
    <ResultsScreen
      followersCount={lists.fans.length}
      followingCount={lists.notFollowingBack.length}
      lists={lists}
      sourceLabel="Test export"
      onStartOver={() => undefined}
    />,
  )
}

describe('ResultsScreen', () => {
  it('moves tabs with ArrowRight and updates the panel', async () => {
    const user = userEvent.setup()
    renderResults()
    const currentTab = screen.getByRole('tab', { name: /Not following back/ })
    currentTab.focus()

    await user.keyboard('{ArrowRight}')

    expect(
      screen
        .getByRole('tab', { name: /Your fans/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('bea')
  })

  it('uses a friendly empty state when there is no search', () => {
    renderResults({ notFollowingBack: [], fans: [], mutuals: [] })
    expect(
      screen.getByText('Everyone you follow follows you back.'),
    ).toBeTruthy()
  })

  it('filters the active list by username', async () => {
    const user = userEvent.setup()
    renderResults({
      notFollowingBack: [account('alex'), account('blair')],
      fans: [],
      mutuals: [],
    })

    await user.type(screen.getByRole('searchbox'), 'BLA')

    expect(screen.getByRole('link', { name: 'blair' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'alex' })).toBeNull()
  })

  it('paginates lists longer than 200 accounts', () => {
    renderResults({
      notFollowingBack: Array.from({ length: 201 }, (_, index) =>
        account(`person${index}`),
      ),
      fans: [],
      mutuals: [],
    })

    expect(screen.getByRole('button', { name: 'Show 200 more' })).toBeTruthy()
  })

  it('shows an unmistakable partial-results notice', () => {
    render(
      <ResultsScreen
        followersCount={1}
        followingCount={1}
        lists={{ notFollowingBack: [], fans: [], mutuals: [] }}
        sourceLabel="Lookup"
        partialNotice
        onStartOver={() => undefined}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain(
      'These results are incomplete',
    )
  })
})
