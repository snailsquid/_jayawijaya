import { useEffect } from 'react'
import { Hash, Link } from 'lucide-react'
import type { Module } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props { module: Module; url: string; onClose: () => void; onCopied: (message: string) => void }
const copy = (value: string) => navigator.clipboard.writeText(value)

export function ShareModuleModal({ module, url, onClose, onCopied }: Props) {
  const code = module.shareCode
  useEffect(() => { void copy(url).then(() => onCopied('Share link copied.')).catch(() => undefined) }, [onCopied, url])
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Share {module.title}</DialogTitle><DialogDescription>The share link was copied automatically. People can use the link or module code to subscribe and receive future updates.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div><p className="mb-1 text-xs font-medium text-muted-foreground">Share URL</p><div className="min-w-0 rounded-md border bg-muted p-3 font-mono text-sm break-all">{url}</div></div>
        <div><p className="mb-1 text-xs font-medium text-muted-foreground">Module code</p><div className="rounded-md border bg-muted p-3 text-center font-mono text-2xl font-bold tracking-[0.35em]">{code ?? 'Unavailable'}</div></div>
      </div>
      <DialogFooter className="sm:justify-start">
        <Button variant="outline" onClick={() => void copy(url).then(() => onCopied('Share link copied.'))}><Link /> Copy URL</Button>
        <Button variant="outline" disabled={!code} onClick={() => { if (code) void copy(code).then(() => onCopied('Module code copied.')) }}><Hash /> Copy code</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
