import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '../core'
import { ExportFileSource } from '../sources'
import { ExportComparison } from './ExportComparison'

vi.mock('../sources', () => ({
  ExportError: class ExportError extends Error {},
  ExportFileSource: { fromFiles: vi.fn() },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const account = (username: string, timestamp: number): Account => ({
  username,
  href: `https://instagram.com/${username}/`,
  timestamp,
})

describe('ExportComparison', () => {
  it('swaps snapshots that were selected in reverse date order and shows tab counts', async () => {
    vi.mocked(ExportFileSource.fromFiles).mockResolvedValue({
      getFollowers: async () => [account('newer-follower', 20)],
      getFollowing: async () => [account('newer-following', 20)],
    } as never)
    const user = userEvent.setup()
    const { container } = render(
      <ExportComparison
        newerSnapshot={{
          followers: [account('older-follower', 10)],
          following: [account('older-following', 10)],
        }}
      />,
    )

    await user.upload(
      container.querySelector('input[type="file"]')!,
      new File(['export'], 'export.zip', { type: 'application/zip' }),
    )

    expect(screen.getByRole('status').textContent).toContain(
      'appears to be newer',
    )
    expect(screen.getByRole('tab', { name: /New followers 1/ })).toBeTruthy()
    expect(
      screen.getByRole('tab', { name: /No longer following you 1/ }),
    ).toBeTruthy()
    expect(
      screen.getByRole('tab', { name: /You started following 1/ }),
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: /You unfollowed 1/ })).toBeTruthy()

    const firstTab = screen.getByRole('tab', { name: /New followers 1/ })
    firstTab.focus()
    await user.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: /No longer following you 1/ }),
    )
  })
})
