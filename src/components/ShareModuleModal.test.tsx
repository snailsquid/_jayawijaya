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
})
