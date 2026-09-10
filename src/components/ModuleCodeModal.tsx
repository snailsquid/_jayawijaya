import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubscribe: (code: string) => Promise<void>;
}

export function ModuleCodeModal({ open, onClose, onSubscribe }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);

  const submit = async () => {
    if (normalized.length !== 4) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubscribe(normalized);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that module.');
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Add module from code</DialogTitle><DialogDescription>Enter the four-character code shared by the module owner.</DialogDescription></DialogHeader>
    <div className="space-y-2"><Label htmlFor="module-share-code">Module code</Label><Input id="module-share-code" value={normalized} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void submit(); }} placeholder="AB3D" maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false} autoFocus className="text-center font-mono text-2xl font-bold uppercase tracking-[0.4em]" /></div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => void submit()} disabled={normalized.length !== 4 || submitting}><KeyRound />{submitting ? 'Adding…' : 'Add module'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
