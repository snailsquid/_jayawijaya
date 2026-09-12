import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShareModuleModal } from './ShareModuleModal'

describe('ShareModuleModal', () => {
  it('disables a live module from the share dialog', async () => {
    const onDisable = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(<ShareModuleModal
      module={{ id: 'module-1', title: 'Liver', questions: [], visibility: 'live', shareCode: 'ABCD' }}
      url="https://example.test/shared/token"
      onClose={vi.fn()}
      onCopied={vi.fn()}
      onDisable={onDisable}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Disable live module' }))

    await waitFor(() => expect(onDisable).toHaveBeenCalledOnce())
  })
})
