import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UploadScreen } from './UploadScreen'

afterEach(cleanup)

describe('UploadScreen', () => {
  it('uses the real buttons for file selection, without an interactive drop zone', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <UploadScreen isLoading={false} onFiles={vi.fn()} onTryAgain={vi.fn()} />,
    )
    const fileInput = container.querySelector<HTMLInputElement>('input[accept]')!
    const folderInput =
      container.querySelector<HTMLInputElement>('input[webkitdirectory]')!
    fileInput.click = vi.fn()
    folderInput.click = vi.fn()

    await user.click(screen.getByRole('button', { name: 'Choose folder' }))

    expect(fileInput.click).not.toHaveBeenCalled()
    expect(folderInput.click).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', { name: 'Instagram export upload' }),
    ).toBeNull()
  })

  it('shows a friendly error and lets someone try again', async () => {
    const user = userEvent.setup()
    const onTryAgain = vi.fn()
    render(
      <UploadScreen
        isLoading={false}
        error="Please choose JSON."
        onFiles={vi.fn()}
        onTryAgain={onTryAgain}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain(
      'Please choose JSON.',
    )
    await user.click(screen.getByRole('button', { name: 'Try another file' }))
    expect(onTryAgain).toHaveBeenCalledOnce()
  })
})
