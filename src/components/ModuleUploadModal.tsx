import { useCallback, useRef, useState } from "react"
import { FileText, FileUp, LoaderCircle, Trash2, TriangleAlert, X } from "lucide-react"
import { JSON_SCHEMA, load } from "js-yaml"
import type { Module } from "@/types/quiz"
import { computeFileHash, MAX_MODULE_UPLOAD_BYTES, moduleToYAML, parseModule } from "@/lib/parser"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onClose: () => void
  onUpload: (modules: Module[]) => void | Promise<void>
  onDelete?: () => void | Promise<void>
  existingModules: Module[]
  replacementFor?: Module
  mode?: 'file' | 'code'
}

function validateYAML(content: string): string | null {
  if (!content.trim()) return 'No content provided.'
  if (new TextEncoder().encode(content).byteLength > MAX_MODULE_UPLOAD_BYTES) return 'Module exceeds the 2 MB upload limit.'
  if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(content)) return 'YAML anchors and aliases are not supported.'
  let parsed: unknown
  try { parsed = load(content, { schema: JSON_SCHEMA }) } catch (e) { return `YAML parse error: ${e instanceof Error ? e.message : String(e)}` }
  if (!parsed || typeof parsed !== 'object') return 'Invalid YAML: expected an object with title and questions.'
  const obj = parsed as Record<string, unknown>
  if (typeof obj.title !== 'string' || !obj.title.trim()) return 'Module must have a "title" field.'
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) return 'Module must have a non-empty "questions" array.'
  for (let i = 0; i < obj.questions.length; i++) {
    const question = obj.questions[i] as Record<string, unknown>
    if (!question || typeof question.question !== 'string' || !question.question.trim()) return `Question #${i + 1} is missing the "question" field.`
  }
  return null
}

interface FileAttachment {
  id: string
  name: string
  module?: Module
  hash?: string
  error?: string
}

function attachmentError(attachment: FileAttachment, attachments: FileAttachment[], existingModules: Module[]): string | undefined {
  if (attachment.error || !attachment.module || !attachment.hash) return attachment.error
  const existing = existingModules.find(item => item.hash === attachment.hash || item.title.toLowerCase() === attachment.module?.title.toLowerCase())
  if (existing) return existing.hash === attachment.hash
    ? `File already uploaded as “${existing.title}”.`
    : `A module named “${attachment.module.title}” already exists.`
  const earlier = attachments.slice(0, attachments.indexOf(attachment)).find(item =>
    item.hash === attachment.hash || item.module?.title.toLowerCase() === attachment.module?.title.toLowerCase(),
  )
  if (!earlier) return undefined
  return earlier.hash === attachment.hash
    ? `Duplicates “${earlier.name}”.`
    : `Has the same module title as “${earlier.name}”.`
}

export function ModuleUploadModal({ open, onClose, onUpload, onDelete, existingModules, replacementFor, mode = 'code' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [yaml, setYaml] = useState(() => replacementFor ? moduleToYAML(replacementFor) : '')
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(replacementFor?.visibility === 'live')
  const [tab, setTab] = useState<'content' | 'properties'>('content')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const attachmentId = useRef(0)
  const [dragging, setDragging] = useState(false)

  const update = useCallback((value: string) => {
    setYaml(value)
    setError(validateYAML(value) ?? '')
    setDuplicate('')
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const pending = files.map(file => ({ file, id: `attachment-${attachmentId.current++}` }))
    const parsed = await Promise.all(pending.map(async ({ file, id }): Promise<FileAttachment> => {
      try {
        const content = await file.text()
        const validation = validateYAML(content)
        if (validation) return { id, name: file.name, error: validation }
        const hash = await computeFileHash(content)
        const module = parseModule(content, `${file.name}-${Date.now()}-${id}`)
        module.hash = hash
        return { id, name: file.name, hash, module }
      } catch (reason) {
        return { id, name: file.name, error: `Failed to read file: ${reason instanceof Error ? reason.message : String(reason)}` }
      }
    }))
    setAttachments(current => [...current, ...parsed])
  }, [])

  const choose = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (replacementFor) {
      const file = files[0]
      if (!file) return
      try { update(await file.text()) } catch { setError('Failed to read file.') }
      return
    }
    await addFiles(files)
  }, [addFiles, replacementFor, update])

  const finish = useCallback(async () => {
    if (mode === 'file' && !replacementFor) {
      const invalid = attachments.some(item => attachmentError(item, attachments, existingModules))
      if (!attachments.length || invalid) return
      setBusy(true)
      try {
        await onUpload(attachments.map(item => ({ ...item.module!, visibility: live ? 'live' : 'private' })))
        onClose()
      } catch (reason) {
        setError(`Failed to upload modules: ${reason instanceof Error ? reason.message : String(reason)}`)
      } finally { setBusy(false) }
      return
    }
    const validation = validateYAML(yaml)
    if (validation) { setError(validation); setTab('content'); return }
    setBusy(true)
    setDuplicate('')
    try {
      const hash = await computeFileHash(yaml)
      const module = parseModule(yaml, `pasted-${Date.now()}`)
      module.hash = hash
      module.visibility = live ? 'live' : 'private'
      const duplicateModule = existingModules.find(item => item.id !== replacementFor?.id && (item.hash === hash || item.title.toLowerCase() === module.title.toLowerCase()))
      if (duplicateModule) {
        setDuplicate(duplicateModule.hash === hash ? `File already uploaded: ${duplicateModule.title}` : `Module with same title exists: ${module.title}. Please rename.`)
        setTab('content')
        return
      }
      await onUpload([module])
      onClose()
    } catch (reason) {
      setError(`Failed to process module: ${reason instanceof Error ? reason.message : String(reason)}`)
    } finally { setBusy(false) }
  }, [attachments, existingModules, live, mode, onClose, onUpload, replacementFor, yaml])

  const remove = useCallback(async () => {
    if (!onDelete) return
    setBusy(true)
    try { await onDelete(); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Delete failed.'); setConfirmDelete(false) }
    finally { setBusy(false) }
  }, [onClose, onDelete])

  const editing = Boolean(replacementFor)
  const fileUpload = mode === 'file' && !editing
  const invalidAttachmentCount = attachments.filter(item => attachmentError(item, attachments, existingModules)).length
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent className="grid max-h-[90dvh] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{replacementFor ? `Edit ${replacementFor.title}` : mode === 'file' ? 'Upload YAML file' : 'Create module from code'}</DialogTitle>
        <DialogDescription>{replacementFor ? 'Edit the module content and manage its properties.' : mode === 'file' ? 'Attach one or more YAML files, then create the modules together.' : 'Paste or write YAML code to create a module.'}</DialogDescription>
      </DialogHeader>
      {editing && <div className="flex border-b" role="tablist" aria-label="Module editor sections">
        <Button type="button" role="tab" aria-selected={tab === 'content'} variant="ghost" className={tab === 'content' ? 'rounded-b-none border-b-2 border-primary' : 'rounded-b-none'} onClick={() => setTab('content')}>Content</Button>
        <Button type="button" role="tab" aria-selected={tab === 'properties'} variant="ghost" className={tab === 'properties' ? 'rounded-b-none border-b-2 border-primary' : 'rounded-b-none'} onClick={() => setTab('properties')}>Properties</Button>
      </div>}
      <div className="min-h-0">
        {(!editing || tab === 'content') && <div role={editing ? 'tabpanel' : undefined} className="flex h-full min-h-0 flex-col gap-4">
          <input ref={fileRef} type="file" multiple={fileUpload} accept=".yaml,.yml" onChange={choose} className="sr-only" aria-label="Choose YAML files" />
          {fileUpload ? <>
            <button
              type="button"
              className={`flex min-h-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-primary bg-accent' : 'border-border hover:border-primary'}`}
              onClick={() => fileRef.current?.click()}
              onDragEnter={event => { event.preventDefault(); setDragging(true) }}
              onDragOver={event => { event.preventDefault(); setDragging(true) }}
              onDragLeave={event => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
              onDrop={event => { event.preventDefault(); setDragging(false); void addFiles(Array.from(event.dataTransfer.files)) }}
            >
              <FileUp aria-hidden="true" />
              <span className="font-medium">Drop YAML files here or choose files</span>
              <span className="text-sm text-muted-foreground">.yaml or .yml, up to 2 MB each</span>
            </button>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto" aria-live="polite" aria-label="Attached YAML files">
              {attachments.map(attachment => {
                const attachmentIssue = attachmentError(attachment, attachments, existingModules)
                return <div key={attachment.id} className={`flex items-start gap-3 rounded-md border p-3 ${attachmentIssue ? 'border-destructive' : 'border-border'}`}>
                  {attachmentIssue ? <TriangleAlert className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" /> : <FileText className="mt-0.5 shrink-0" aria-hidden="true" />}
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{attachment.name}</p>{attachmentIssue ? <p className="text-sm text-destructive">{attachmentIssue}</p> : <p className="text-sm text-muted-foreground">Ready to upload{attachment.module ? ` · ${attachment.module.title}` : ''}</p>}</div>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== attachment.id))}><X /></Button>
                </div>
              })}
              {!attachments.length && <p className="py-2 text-center text-sm text-muted-foreground">No files attached yet.</p>}
            </div>
          </> : <>
            {replacementFor && <Button className="shrink-0" variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Choose YAML file</Button>}
            <Textarea value={yaml} onChange={event => update(event.target.value)} placeholder="Paste YAML content here…" aria-label="Paste YAML content" spellCheck={false} className="field-sizing-fixed min-h-0 flex-1 resize-none overflow-y-auto font-mono" aria-invalid={Boolean(error)} />
          </>}
          {!editing && <Label className="flex shrink-0 items-center gap-2"><Checkbox checked={live} onCheckedChange={value => setLive(value === true)} /> Share as a live module</Label>}
          {error && <Alert className="max-h-24 shrink-0 overflow-y-auto" variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
          {duplicate && <Alert className="max-h-24 shrink-0 overflow-y-auto"><TriangleAlert /><AlertDescription>{duplicate}</AlertDescription></Alert>}
        </div>}
        {editing && tab === 'properties' && <div role="tabpanel" className="h-full space-y-6 overflow-y-auto pr-1">
          <div className="space-y-2"><Label className="flex items-center gap-2"><Checkbox checked={live} onCheckedChange={value => setLive(value === true)} /> Share as a live module</Label><p className="text-sm text-muted-foreground">When enabled, anyone with the link can subscribe and receive future versions.</p></div>
          {onDelete && <div className="space-y-3 rounded-md border border-destructive/40 p-4">
            <div><p className="font-medium">Delete module</p><p className="text-sm text-muted-foreground">Remove this module from your library. This cannot be undone.</p></div>
            {!confirmDelete ? <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete module</Button> : <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Are you sure?</span><Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{busy && <LoaderCircle className="animate-spin" />}Delete permanently</Button></div>}
          </div>}
        </div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => void finish()} disabled={busy || (fileUpload ? !attachments.length || invalidAttachmentCount > 0 : Boolean(error) || !yaml.trim())}>{busy && <LoaderCircle className="animate-spin" />}{busy ? 'Processing…' : editing ? 'Save changes' : fileUpload ? `Upload ${attachments.length || ''} module${attachments.length === 1 ? '' : 's'}` : 'Finish'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
