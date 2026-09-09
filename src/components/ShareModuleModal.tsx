import { useEffect } from 'react';
import { Braces, Link } from 'lucide-react';
import type { Module } from '@/types/quiz';
import { moduleToYAML } from '@/lib/parser';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props { module: Module; url: string; onClose: () => void; onCopied: (message: string) => void }
const copy = (value: string) => navigator.clipboard.writeText(value);

export function ShareModuleModal({ module, url, onClose, onCopied }: Props) {
  useEffect(() => { void copy(url).then(() => onCopied('Share link copied.')).catch(() => undefined); }, [onCopied, url]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Share {module.title}</DialogTitle><DialogDescription>The share link was copied automatically. People who open it can add the live module and receive future updates.</DialogDescription></DialogHeader>
    <div className="min-w-0 rounded-md border bg-muted p-3 font-mono text-sm break-all">{url}</div>
    <DialogFooter className="sm:justify-start"><Button variant="outline" onClick={() => void copy(url).then(() => onCopied('Share link copied.'))}><Link /> Copy URL</Button><Button variant="outline" onClick={() => void copy(moduleToYAML(module)).then(() => onCopied('Module code copied.'))}><Braces /> Copy code</Button></DialogFooter>
  </DialogContent></Dialog>;
}
