import { useCallback, useRef, useState } from "react"
import { FileUp, LoaderCircle, Trash2, TriangleAlert } from "lucide-react"
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

export function ModuleUploadModal({ open, onClose, onUpload, onDelete, existingModules, replacementFor, mode = 'code' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [yaml, setYaml] = useState(() => replacementFor ? moduleToYAML(replacementFor) : '')
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(replacementFor?.visibility === 'live')
  const [tab, setTab] = useState<'content' | 'properties'>('content')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const update = useCallback((value: string) => {
    setYaml(value)
    setError(validateYAML(value) ?? '')
    setDuplicate('')
  }, [])

  const choose = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { update(await file.text()) } catch { setError('Failed to read file.') }
    event.target.value = ''
  }, [update])

  const finish = useCallback(async () => {
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
  }, [existingModules, live, onClose, onUpload, replacementFor?.id, yaml])

  const remove = useCallback(async () => {
    if (!onDelete) return
    setBusy(true)
    try { await onDelete(); onClose() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Delete failed.'); setConfirmDelete(false) }
    finally { setBusy(false) }
  }, [onClose, onDelete])

  const editing = Boolean(replacementFor)
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent className="grid max-h-[90dvh] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{replacementFor ? `Edit ${replacementFor.title}` : mode === 'file' ? 'Upload YAML file' : 'Create module from code'}</DialogTitle>
        <DialogDescription>{replacementFor ? 'Edit the module content and manage its properties.' : mode === 'file' ? 'Choose a YAML file, review it, then create the module.' : 'Paste or write YAML code to create a module.'}</DialogDescription>
      </DialogHeader>
      {editing && <div className="flex border-b" role="tablist" aria-label="Module editor sections">
        <Button type="button" role="tab" aria-selected={tab === 'content'} variant="ghost" className={tab === 'content' ? 'rounded-b-none border-b-2 border-primary' : 'rounded-b-none'} onClick={() => setTab('content')}>Content</Button>
        <Button type="button" role="tab" aria-selected={tab === 'properties'} variant="ghost" className={tab === 'properties' ? 'rounded-b-none border-b-2 border-primary' : 'rounded-b-none'} onClick={() => setTab('properties')}>Properties</Button>
      </div>}
      <div className="min-h-0">
        {(!editing || tab === 'content') && <div role={editing ? 'tabpanel' : undefined} className="flex h-full min-h-0 flex-col gap-4">
          <input ref={fileRef} type="file" accept=".yaml,.yml" onChange={choose} className="sr-only" aria-label="Choose YAML file" />
          {(mode === 'file' || replacementFor) && <Button className="shrink-0" variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Choose YAML file</Button>}
          <Textarea value={yaml} onChange={event => update(event.target.value)} placeholder="Paste YAML content here…" aria-label="Paste YAML content" spellCheck={false} className="min-h-0 flex-1 resize-none overflow-y-auto font-mono" aria-invalid={Boolean(error)} />
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
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => void finish()} disabled={Boolean(error) || !yaml.trim() || busy}>{busy && <LoaderCircle className="animate-spin" />}{busy ? 'Processing…' : editing ? 'Save changes' : 'Finish'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
