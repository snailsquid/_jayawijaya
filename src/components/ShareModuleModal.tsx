import { useEffect, useState } from 'react'
import { Hash, Link, RadioTower } from 'lucide-react'
import type { Module } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Props { module: Module; url: string; onClose: () => void; onDisable?: () => Promise<void> }
const copy = (value: string, message: string) => navigator.clipboard.writeText(value).then(() => toast.success(message)).catch(() => toast.error('Could not copy to the clipboard.'))

export function ShareModuleModal({ module, url, onClose, onDisable }: Props) {
  const code = module.shareCode
  const [disabling, setDisabling] = useState(false)
  useEffect(() => { void copy(url, 'Share link copied.') }, [url])
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Share {module.title}</DialogTitle><DialogDescription>The share link was copied automatically. People can use the link or module code to subscribe and receive future updates.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div><p className="mb-1 text-xs font-medium text-muted-foreground">Share URL</p><div className="min-w-0 rounded-md border bg-muted p-3 font-mono text-sm break-all">{url}</div></div>
        <div><p className="mb-1 text-xs font-medium text-muted-foreground">Module code</p><div className="rounded-md border bg-muted p-3 text-center font-mono text-2xl font-bold tracking-[0.35em]">{code ?? 'Unavailable'}</div></div>
      </div>
      <DialogFooter className="sm:justify-start">
        <Button variant="outline" onClick={() => void copy(url, 'Share link copied.')}><Link /> Copy URL</Button>
        <Button variant="outline" disabled={!code} onClick={() => { if (code) void copy(code, 'Module code copied.') }}><Hash /> Copy code</Button>
        {onDisable && <Button variant="destructive" disabled={disabling} onClick={() => { setDisabling(true); void onDisable().catch(() => undefined).finally(() => setDisabling(false)) }}><RadioTower /> {disabling ? 'Disabling…' : 'Disable live module'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
