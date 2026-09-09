import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/app-shell';
import { paymentsApi } from '@/lib/api';
import { loadSnap } from '@/lib/snap';
import { getSubscriptionSummary } from '@/lib/subscription';
import type { AppUser } from '@/lib/auth-client';
import type { MidtransClientConfig, Payment, PaymentProduct, PaymentStatus } from '@/types/payment';

const labels: Record<PaymentStatus, string> = {
  created: 'Creating', pending: 'Pending', succeeded: 'Verified', failed: 'Failed',
  canceled: 'Canceled', expired: 'Expired', refunded: 'Refunded', charged_back: 'Charged back',
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function Pricing({ user }: { user: AppUser }) {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [config, setConfig] = useState<MidtransClientConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await paymentsApi.list();
    setPayments(result.payments);
    setProduct(result.product);
    setConfig(result.config);
  }, []);

  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load payments.')); }, [load]);

  const refresh = useCallback(async (orderId: string) => {
    try {
      const { payment } = await paymentsApi.get(orderId);
      setPayments(current => [payment, ...current.filter(item => item.orderId !== payment.orderId)]);
      setMessage(payment.status === 'succeeded'
        ? 'Payment verified. Your 30-day Pro pass is active.'
        : `Payment status: ${labels[payment.status]}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not verify payment status.');
    }
  }, []);

  const openPayment = async () => {
    if (!product) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await paymentsApi.create(product.code);
      setConfig(result.config);
      setPayments(current => [result.payment, ...current.filter(item => item.orderId !== result.payment.orderId)]);
      if (!result.payment.snapToken) throw new Error('Payment token is unavailable.');
      await loadSnap(result.config.snapJsUrl, result.config.clientKey);
      window.snap!.pay(result.payment.snapToken, {
        onSuccess: () => void refresh(result.payment.orderId),
        onPending: () => void refresh(result.payment.orderId),
        onError: () => void refresh(result.payment.orderId),
        onClose: () => setMessage('Payment window closed. You can resume the pending payment.'),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start payment.');
    } finally {
      setBusy(false);
    }
  };

  const cancelPayment = async () => {
    if (!cancelTarget) return;
    const orderId = cancelTarget.orderId;
    setCanceling(orderId);
    setError(null);
    setMessage(null);
    setCancelTarget(null);
    try {
      const { payment } = await paymentsApi.cancel(orderId);
      setPayments(current => [payment, ...current.filter(item => item.orderId !== payment.orderId)]);
      setMessage('Payment canceled. You can start a new payment whenever you are ready.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not cancel payment.');
      await refresh(orderId);
    } finally {
      setCanceling(null);
    }
  };

  const active = payments.find(payment => payment.status === 'created' || payment.status === 'pending');
  const subscription = getSubscriptionSummary(payments);
  const accountIsPro = subscription.active || user.tier === 'pro';
  const hasExpiredPass = !subscription.active && subscription.expiresAt !== null;
  const expirationLabel = subscription.expiresAt?.toLocaleDateString('id-ID', { dateStyle: 'long' });

  return (
    <PageShell>
      <PageHeader title="Plan and billing" actions={<Button variant="outline" onClick={() => navigate('/account')}><ArrowLeft /> Account</Button>} />
      <Alert variant={accountIsPro ? 'default' : undefined}>
        {accountIsPro ? <Sparkles /> : <CalendarDays />}
        <AlertTitle>{accountIsPro ? 'Your Pro pass is active' : hasExpiredPass ? 'Your Pro pass has expired' : 'You are on the Free plan'}</AlertTitle>
        <AlertDescription>
          {subscription.active
            ? `${subscription.daysRemaining} ${subscription.daysRemaining === 1 ? 'day' : 'days'} remaining · Access ends ${expirationLabel}.`
            : user.tier === 'pro'
              ? 'Your account has Pro access. Contact support if your renewal date is missing.'
              : hasExpiredPass
                ? `Your previous access ended ${expirationLabel}. Renew to regain Pro access.`
                : 'Upgrade with a one-time payment. There is no automatic renewal.'}
        </AlertDescription>
      </Alert>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard /> 30-day pass</CardTitle>
            <CardDescription>{accountIsPro ? 'Extend your access with another one-time payment.' : 'One-time payment. No recurring charges.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-bold">{product ? money.format(product.amount) : 'Rp15.000'}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• 30 days of Pro access</li>
              <li>• Secure checkout through Midtrans Snap</li>
              <li>• Manual renewal — cancel anytime by simply not renewing</li>
            </ul>
            {message && <Alert><CheckCircle2 /><AlertTitle>Payment update</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
            {error && <Alert variant="destructive"><AlertTitle>Payment unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg" disabled={busy || !product || !config} onClick={() => void openPayment()}>
              {busy ? <><RefreshCw className="animate-spin" /> Opening…</> : active ? 'Resume payment' : accountIsPro ? 'Extend Pro access' : 'Upgrade to Pro'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment history</CardTitle><CardDescription>Status is verified by the server, not the browser callback.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {payments.map(payment => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div><p className="font-medium">{money.format(payment.amount)}</p><p className="text-xs text-muted-foreground">{new Date(payment.createdAt).toLocaleString('id-ID')}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant={payment.status === 'succeeded' ? 'default' : 'outline'}>{labels[payment.status]}</Badge>
                  {(payment.status === 'created' || payment.status === 'pending') && <Button size="sm" variant="outline" disabled={canceling === payment.orderId} onClick={() => setCancelTarget(payment)}>{canceling === payment.orderId ? <RefreshCw className="animate-spin" /> : <XCircle />} Cancel</Button>}
                  <Button size="sm" variant="ghost" disabled={canceling === payment.orderId} onClick={() => void refresh(payment.orderId)}><RefreshCw /> Check</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel this payment?</AlertDialogTitle><AlertDialogDescription>This closes the pending Midtrans transaction. You will need to start a new payment if you change your mind.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep payment</AlertDialogCancel><AlertDialogAction onClick={() => void cancelPayment()}>Cancel payment</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
