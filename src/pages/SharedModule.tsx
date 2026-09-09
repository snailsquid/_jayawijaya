import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Module } from '@/types/quiz';
import { modulesApi } from '@/lib/api';
import { PageHeader, PageShell } from '@/components/app-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SharedModule() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void modulesApi.resolveShare(token).then(result => setModule(result.module))
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to open this share link.'));
  }, [token]);

  const subscribe = async () => {
    setBusy(true); setError('');
    try { await modulesApi.subscribe(token); navigate('/start', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to subscribe.'); setBusy(false); }
  };

  return <PageShell className="max-w-xl"><PageHeader title="Shared live module" />
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!error && !module && <p>Loading module…</p>}
    {module && <Card><CardHeader><CardTitle>{module.title}</CardTitle><CardDescription>{module.description || 'No description provided.'}</CardDescription></CardHeader>
      <CardContent className="space-y-4"><p>{module.questions.length} questions · version {module.currentVersion}</p><p className="text-sm text-muted-foreground">Updates are applied when you open quiz setup or check manually. A quiz already in progress always keeps its starting version.</p><Button onClick={() => void subscribe()} disabled={busy}>{busy ? 'Adding…' : 'Add to my modules'}</Button></CardContent></Card>}
  </PageShell>;
}
