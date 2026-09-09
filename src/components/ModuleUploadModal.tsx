import { useCallback, useRef, useState } from "react"
import { FileUp, LoaderCircle, TriangleAlert } from "lucide-react"
import { JSON_SCHEMA, load } from "js-yaml"
import type { Module } from "@/types/quiz"
import { computeFileHash, MAX_MODULE_UPLOAD_BYTES, parseModule } from "@/lib/parser"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Props { open: boolean; onClose: () => void; onUpload: (modules: Module[]) => void | Promise<void>; existingModules: Module[]; replacementFor?: Module }
function validateYAML(content: string): string | null {
  if (!content.trim()) return 'No content provided.'
  if (new TextEncoder().encode(content).byteLength > MAX_MODULE_UPLOAD_BYTES) return 'Module exceeds the 2 MB upload limit.'
  if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(content)) return 'YAML anchors and aliases are not supported.'
  let parsed: unknown; try { parsed = load(content, { schema: JSON_SCHEMA }) } catch (e) { return `YAML parse error: ${e instanceof Error ? e.message : String(e)}` }
  if (!parsed || typeof parsed !== 'object') return 'Invalid YAML: expected an object with title and questions.'
  const obj = parsed as Record<string, unknown>
  if (typeof obj.title !== 'string' || !obj.title.trim()) return 'Module must have a "title" field.'
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) return 'Module must have a non-empty "questions" array.'
  for (let i = 0; i < obj.questions.length; i++) { const q = obj.questions[i] as Record<string, unknown>; if (!q || typeof q.question !== 'string' || !q.question.trim()) return `Question #${i + 1} is missing the "question" field.` }
  return null
}
export function ModuleUploadModal({ open, onClose, onUpload, existingModules, replacementFor }: Props) {
  const fileRef = useRef<HTMLInputElement>(null); const [yaml, setYaml] = useState(''); const [error, setError] = useState(''); const [duplicate, setDuplicate] = useState(''); const [busy, setBusy] = useState(false); const [live, setLive] = useState(false)
  const update = useCallback((value: string) => { setYaml(value); setError(validateYAML(value) ?? ''); setDuplicate('') }, [])
  const choose = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; try { update(await file.text()) } catch { setError('Failed to read file.') } e.target.value = '' }, [update])
  const finish = useCallback(async () => { const validation = validateYAML(yaml); if (validation) { setError(validation); return } setBusy(true); setDuplicate(''); try { const hash = await computeFileHash(yaml); const module = parseModule(yaml, `pasted-${Date.now()}`); module.hash = hash; module.visibility = live ? 'live' : 'private'; const dup = existingModules.find(m => m.id !== replacementFor?.id && (m.hash === hash || m.title.toLowerCase() === module.title.toLowerCase())); if (dup) { setDuplicate(dup.hash === hash ? `File already uploaded: ${dup.title}` : `Module with same title exists: ${module.title}. Please rename.`); return } await onUpload([module]); onClose() } catch (e) { setError(`Failed to process module: ${e instanceof Error ? e.message : String(e)}`) } finally { setBusy(false) } }, [existingModules, live, onClose, onUpload, replacementFor?.id, yaml])
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{replacementFor ? `Replace ${replacementFor.title}` : 'Upload module'}</DialogTitle><DialogDescription>{replacementFor ? 'Upload revised YAML. It is published immediately after validation.' : 'Choose a YAML file or paste its contents below.'}</DialogDescription></DialogHeader>
    <input ref={fileRef} type="file" accept=".yaml,.yml" onChange={choose} className="sr-only" aria-label="Choose YAML file" />
    <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Choose YAML file</Button>
    <Textarea value={yaml} onChange={e => update(e.target.value)} placeholder="Paste YAML content here…" aria-label="Paste YAML content" spellCheck={false} className="min-h-56 font-mono" aria-invalid={Boolean(error)} />
    {!replacementFor && <Label className="flex items-center gap-2"><Checkbox checked={live} onCheckedChange={value => setLive(value === true)} /> Share as a live module</Label>}
    {error && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}{duplicate && <Alert><TriangleAlert /><AlertDescription>{duplicate}</AlertDescription></Alert>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={finish} disabled={Boolean(error) || !yaml.trim() || busy}>{busy && <LoaderCircle className="animate-spin" />}{busy ? 'Processing…' : 'Finish'}</Button></DialogFooter>
  </DialogContent></Dialog>
}
