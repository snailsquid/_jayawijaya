import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, LogOut, Mail, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PageShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { paymentsApi } from '@/lib/api';
import { clearActiveQuizSnapshot } from '@/lib/quiz-snapshot';
import { getSubscriptionSummary } from '@/lib/subscription';
import type { Payment } from '@/types/payment';
import type { WorkspaceIdentity } from '@/types/offline';

export function Account({ user }: { user: WorkspaceIdentity }) {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const accountIsPro = user.tier === 'pro' || getSubscriptionSummary(payments).active;

  useEffect(() => {
    void paymentsApi.list().then(result => setPayments(result.payments)).catch(() => undefined);
  }, []);

  const signOut = () => {
    clearActiveQuizSnapshot();
    void authClient.signOut({ fetchOptions: { onSuccess: () => navigate('/', { replace: true }) } });
  };

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Account" actions={<Button variant="outline" onClick={() => navigate('/start')}><ArrowLeft /> Quiz setup</Button>} />
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          {user.image
            ? <img src={user.image} alt="" className="size-14 rounded-full border object-cover" referrerPolicy="no-referrer" />
            : <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden="true">{initials}</div>}
          <div className="min-w-0">
            <CardTitle>{user.name}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2"><Mail className="size-4" /> <span className="truncate">{user.email}</span></CardDescription>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Plan and billing</CardTitle><CardDescription>Manage your access and review payment history.</CardDescription></div>
            <Badge variant={accountIsPro ? 'default' : 'secondary'}>{accountIsPro ? 'Pro' : 'Free'}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/pricing')}><CreditCard /> {accountIsPro ? 'Manage plan' : 'View plans'}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserRound /> Session</CardTitle><CardDescription>Sign out of this account on this device.</CardDescription></CardHeader>
        <CardContent><Button variant="outline" onClick={signOut}><LogOut /> Log out</Button></CardContent>
      </Card>
    </PageShell>
  );
}
