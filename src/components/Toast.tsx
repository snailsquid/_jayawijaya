import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { message: string; onClose: () => void; duration?: number }
export function Toast({ message, onClose, duration = 3000 }: Props) {
  useEffect(() => { const timer = window.setTimeout(onClose, duration); return () => window.clearTimeout(timer); }, [duration, message, onClose]);
  return <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm shadow-lg"><CheckCircle2 className="size-4 text-primary" /><span className="min-w-0 flex-1">{message}</span><Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Dismiss notification"><X /></Button></div>;
}
