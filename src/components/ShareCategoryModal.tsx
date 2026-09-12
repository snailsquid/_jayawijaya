import { Hash, Link } from 'lucide-react';
import type { LiveCategory } from '@/types/quiz';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props { category: LiveCategory; url: string; onClose: () => void }
const copy = (value: string, message: string) => navigator.clipboard.writeText(value).then(() => toast.success(message)).catch(() => toast.error('Could not copy to the clipboard.'));

export function ShareCategoryModal({ category, url, onClose }: Props) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>Share {category.name}</DialogTitle><DialogDescription>Anyone with this link or four-character code can subscribe to this ordered set of modules and receive future category updates.</DialogDescription></DialogHeader>
    <div className="space-y-3"><div><p className="mb-1 text-xs font-medium text-muted-foreground">Share URL</p><div className="rounded-md border bg-muted p-3 font-mono text-sm break-all">{url}</div></div>
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Category code</p><div className="rounded-md border bg-muted p-3 text-center font-mono text-2xl font-bold tracking-[0.35em]">{category.shareCode ?? 'Unavailable'}</div></div></div>
    <DialogFooter className="sm:justify-start"><Button variant="outline" onClick={() => void copy(url,'Category link copied.')}><Link /> Copy URL</Button>
      <Button variant="outline" disabled={!category.shareCode} onClick={() => category.shareCode && void copy(category.shareCode,'Category code copied.')}><Hash /> Copy code</Button></DialogFooter>
  </DialogContent></Dialog>;
}
