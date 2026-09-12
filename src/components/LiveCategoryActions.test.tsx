import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LiveCategoryActions } from './LiveCategoryActions'
import type { LiveCategory } from '@/types/quiz'

const liveCategory: LiveCategory = {
  id: 'live-1', name: 'Rounds', moduleIds: ['m1'], members: [], ownerId: 'owner',
  isOwner: true, visibility: 'live', shareToken: 'token', shareCode: 'ABCD',
  subscribed: false, frozen: false, currentVersion: 2, latestVersion: 2,
  localCategoryId: 'Rounds',
}

describe('LiveCategoryActions', () => {
  it('reopens sharing management without publishing another version', async () => {
    const onCreate = vi.fn()
    const onSetSharing = vi.fn()
    render(<LiveCategoryActions category={{ id: 'Rounds', name: 'Rounds', moduleIds: ['m1'] }} liveCategory={liveCategory} onCreate={onCreate} onSetSharing={onSetSharing} />)

    await userEvent.click(screen.getByRole('button', { name: 'Manage sharing' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Share Rounds')
    expect(onCreate).not.toHaveBeenCalled()
    expect(onSetSharing).not.toHaveBeenCalled()
    expect(screen.queryByText('Publish update')).not.toBeInTheDocument()
  })

  it('refreshes modules after category sharing activates them', async () => {
    const draft = { ...liveCategory, visibility: 'private' as const, shareToken: undefined, shareCode: undefined }
    const onCreate = vi.fn().mockResolvedValue(draft)
    const onSetSharing = vi.fn().mockResolvedValue(liveCategory)
    const onActivated = vi.fn()
    render(<LiveCategoryActions category={{ id: 'Rounds', name: 'Rounds', moduleIds: ['m1'] }} onCreate={onCreate} onSetSharing={onSetSharing} onActivated={onActivated} />)

    await userEvent.click(screen.getByRole('button', { name: 'Share live' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(onSetSharing).toHaveBeenCalledWith('live-1', true)
    expect(onActivated).toHaveBeenCalledOnce()
  })
})
