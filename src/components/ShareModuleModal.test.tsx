import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShareModuleModal } from './ShareModuleModal'
import { Toaster } from 'sonner'

describe('ShareModuleModal', () => {
  it('disables a live module from the share dialog', async () => {
    const onDisable = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<><ShareModuleModal
      module={{ id: 'module-1', title: 'Liver', questions: [], visibility: 'live', shareCode: 'ABCD' }}
      url="https://example.test/shared/token"
      onClose={vi.fn()}
      onDisable={onDisable}
    /><Toaster /></>)

    expect(await screen.findByText('Share link copied.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Disable live module' }))

    await waitFor(() => expect(onDisable).toHaveBeenCalledOnce())
  })

  it('hides management from a subscriber while keeping share details available', () => {
    render(<ShareModuleModal
      module={{ id: 'module-1', title: 'Liver', questions: [], isOwner: false, subscribed: true, visibility: 'live', shareCode: 'ABCD' }}
      url="https://example.test/shared/ABCD"
      onClose={vi.fn()}
    />)

    expect(screen.getByText('https://example.test/shared/ABCD')).toBeInTheDocument()
    expect(screen.getByText('ABCD')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable live module' })).not.toBeInTheDocument()
  })
})
