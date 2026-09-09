import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/app-shell';
import { paymentsApi } from '@/lib/api';
import { loadSnap } from '@/lib/snap';
import type { MidtransClientConfig, Payment, PaymentProduct, PaymentStatus } from '@/types/payment';

const labels: Record<PaymentStatus, string> = {
  created: 'Creating', pending: 'Pending', succeeded: 'Verified', failed: 'Failed',
  canceled: 'Canceled', expired: 'Expired', refunded: 'Refunded', charged_back: 'Charged back',
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function Pricing() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [config, setConfig] = useState<MidtransClientConfig | null>(null);
  const [busy, setBusy] = useState(false);
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
        ? 'Payment verified. Entitlements are not activated in this release.'
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

  const active = payments.find(payment => payment.status === 'created' || payment.status === 'pending');

  return (
    <PageShell>
      <PageHeader title="Pricing" actions={<Button variant="outline" onClick={() => navigate('/')}><ArrowLeft /> Home</Button>} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard /> 30-day pass</CardTitle>
            <CardDescription>A one-time Midtrans payment. Manual renewal only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-bold">{product ? money.format(product.amount) : 'Rp15.000'}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Payment validity metadata: 30 days</li>
              <li>• Secure checkout through Midtrans Snap</li>
              <li>• This release records payments only</li>
            </ul>
            {message && <Alert><CheckCircle2 /><AlertTitle>Payment update</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
            {error && <Alert variant="destructive"><AlertTitle>Payment unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg" disabled={busy || !product || !config} onClick={() => void openPayment()}>
              {busy ? <><RefreshCw className="animate-spin" /> Opening…</> : active ? 'Resume payment' : 'Pay with Midtrans'}
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
                <div className="flex items-center gap-2"><Badge variant={payment.status === 'succeeded' ? 'default' : 'outline'}>{labels[payment.status]}</Badge><Button size="sm" variant="ghost" onClick={() => void refresh(payment.orderId)}><RefreshCw /> Check</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
