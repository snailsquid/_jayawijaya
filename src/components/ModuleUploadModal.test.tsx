import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModuleUploadModal } from './ModuleUploadModal'

const validYaml = (title: string) => `title: ${title}
questions:
  - question: Question?
    answers: [A, B]
    correct_answer: 1
`

function renderUpload(onUpload = vi.fn()) {
  render(<ModuleUploadModal open onClose={vi.fn()} onUpload={onUpload} existingModules={[]} mode="file" />)
  return { onUpload, input: screen.getByLabelText('Choose YAML files') as HTMLInputElement }
}

describe('ModuleUploadModal file mode', () => {
  it('attaches multiple files and submits them as one batch', async () => {
    const { input, onUpload } = renderUpload()
    await userEvent.upload(input, [
      new File([validYaml('One')], 'one.yaml', { type: 'application/yaml' }),
      new File([validYaml('Two')], 'two.yml', { type: 'application/yaml' }),
    ])

    expect(await screen.findByText('Ready to upload · One')).toBeInTheDocument()
    expect(screen.getByText('Ready to upload · Two')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload 2 modules' }))

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    expect(onUpload.mock.calls[0][0]).toHaveLength(2)
    expect(onUpload.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'One', hash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      expect.objectContaining({ title: 'Two', hash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    ]))
  })

  it('shows errors on individual attachments and recovers when a conflict is removed', async () => {
    const { input } = renderUpload()
    await userEvent.upload(input, [
      new File([validYaml('Same')], 'first.yaml'),
      new File([validYaml('Same')], 'duplicate.yaml'),
      new File(['not: a module'], 'broken.yaml'),
    ])

    expect(await screen.findByText('Duplicates “first.yaml”.')).toBeInTheDocument()
    expect(screen.getByText('Module title is required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload 3 modules' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Remove first.yaml' }))
    expect(screen.queryByText('Duplicates “first.yaml”.')).not.toBeInTheDocument()
    expect(screen.getByText('Ready to upload · Same')).toBeInTheDocument()
  })

  it('shows full question validation before upload and disables submission', async () => {
    const { input, onUpload } = renderUpload()
    await userEvent.upload(input, new File([`title: Broken\nquestions:\n  - question: Missing choices\n    correct_answer: 1\n`], 'broken.yaml'))

    expect(await screen.findByText('Question 1 requires answer choices.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload 1 module' })).toBeDisabled()
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('keeps the YAML editor available when editing an existing module', () => {
    render(<ModuleUploadModal
      open
      onClose={vi.fn()}
      onUpload={vi.fn()}
      existingModules={[]}
      replacementFor={{ id: 'one', title: 'One', questions: [{ question: 'Question?', correct_answer: 1 }] }}
      mode="file"
    />)

    expect(screen.getByRole('textbox', { name: 'Paste YAML content' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Attached YAML files')).not.toBeInTheDocument()
  })
})
