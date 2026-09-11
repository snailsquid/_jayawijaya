import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageHeader, PageShell } from '@/components/app-shell';
import { paymentsApi } from '@/lib/api';
import { formatProductPrice } from '@/lib/frontend-display';
import { loadSnap } from '@/lib/snap';
import type { ActiveEntitlement, MidtransClientConfig, Payment, PaymentProduct, PaymentStatus } from '@/types/payment';

const labels: Record<PaymentStatus, string> = {
  created: 'Creating', pending: 'Pending', succeeded: 'Verified', failed: 'Failed',
  canceled: 'Canceled', expired: 'Expired', refunded: 'Refunded', charged_back: 'Charged back',
};

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function Pricing() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [products, setProducts] = useState<PaymentProduct[] | null>(null);
  const [entitlement, setEntitlement] = useState<ActiveEntitlement | null>(null);
  const [config, setConfig] = useState<MidtransClientConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountProduct, setAmountProduct] = useState<PaymentProduct | null>(null);
  const [amountChoice, setAmountChoice] = useState('30000');
  const [customAmount, setCustomAmount] = useState('');

  const load = useCallback(async () => {
    const result = await paymentsApi.list();
    setPayments(result.payments);
    setProducts(result.products);
    setEntitlement(result.entitlement);
    setConfig(result.config);
  }, []);

  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load payments.')); }, [load]);

  const refresh = useCallback(async (orderId: string) => {
    try {
      const { payment } = await paymentsApi.get(orderId);
      await load();
      setMessage(payment.status === 'succeeded'
        ? 'Payment verified. Your premium benefits are active.'
        : `Payment status: ${labels[payment.status]}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not verify payment status.');
    }
  }, [load]);

  const openPayment = async (product: PaymentProduct, amount?: number) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await paymentsApi.create(product.code, amount);
      setAmountProduct(null);
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

  const selectedAmount = amountChoice === 'custom' ? Number(customAmount) : Number(amountChoice);
  const flexiblePricing = amountProduct?.pricing.type === 'flexible' ? amountProduct.pricing : null;
  const amountIsValid = Boolean(flexiblePricing)
    && Number.isSafeInteger(selectedAmount)
    && selectedAmount >= flexiblePricing!.minimumAmount
    && selectedAmount <= flexiblePricing!.maximumAmount;

  const chooseProduct = (product: PaymentProduct) => {
    const active = payments.find(payment => payment.productCode === product.code
      && (payment.status === 'created' || payment.status === 'pending'));
    if (active) {
      void openPayment(product, product.pricing.type === 'flexible' ? active.amount : undefined);
    } else if (product.pricing.type === 'flexible') {
      setAmountChoice(String(product.pricing.minimumAmount));
      setCustomAmount('');
      setAmountProduct(product);
    } else {
      void openPayment(product);
    }
  };

  const isAcromionCatalog = products?.length === 1 && products[0]?.code === 'acromion-lifetime';

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

  return (
    <PageShell>
      <PageHeader title="Plan and billing" actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>} />
      <div className="space-y-6">
        {entitlement && <Alert><CheckCircle2 /><AlertTitle>{entitlement.plan} is active</AlertTitle><AlertDescription>{entitlement.expiresAt ? `Access through ${new Date(entitlement.expiresAt).toLocaleDateString('id-ID')}.` : 'Lifetime access.'}</AlertDescription></Alert>}
        {message && <Alert><CheckCircle2 /><AlertTitle>Payment update</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertTitle>Payment unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {!isAcromionCatalog && <Card>
            <CardHeader><CardTitle>Basic</CardTitle><CardDescription>Free</CardDescription></CardHeader>
            <CardContent><ul className="space-y-2 text-sm text-muted-foreground"><li>• 10 modules</li><li>• Private modules</li></ul></CardContent>
          </Card>}
          {products === null && !error && <Card className="md:col-span-2 lg:col-span-3"><CardContent className="flex items-center gap-2 py-8 text-muted-foreground"><RefreshCw className="animate-spin" /> Loading verified prices…</CardContent></Card>}
          {products?.map(product => {
            const active = payments.find(payment => payment.productCode === product.code && (payment.status === 'created' || payment.status === 'pending'));
            const hasLifetime = entitlement?.expiresAt === null;
            const flexible = product.pricing.type === 'flexible';
            const duration = product.duration.unit === 'lifetime' ? 'Lifetime' : product.duration.value === 1 ? '1 month' : `${product.duration.value} months`;
            return <Card key={product.code}>
              <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard /> {product.plan}</CardTitle><CardDescription>{duration} · one-time payment</CardDescription></CardHeader>
              <CardContent className="space-y-4"><p className="text-3xl font-bold">{formatProductPrice(product)}</p><ul className="space-y-2 text-sm text-muted-foreground">{product.benefits.map(benefit => <li key={benefit}>• {benefit}</li>)}</ul></CardContent>
              <CardFooter><Button className="w-full" disabled={busy || !config || (hasLifetime && !flexible)} onClick={() => chooseProduct(product)}>{hasLifetime && !flexible ? 'Lifetime access active' : busy ? <><RefreshCw className="animate-spin" /> Opening…</> : active ? 'Resume payment' : 'Choose plan'}</Button></CardFooter>
            </Card>;
          })}
        </div>
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
      <Dialog open={Boolean(amountProduct)} onOpenChange={open => !open && setAmountProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose your Acromion contribution</DialogTitle>
            <DialogDescription>Every amount grants the same lifetime Acromion access.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={amountChoice} onValueChange={setAmountChoice} aria-label="Contribution amount">
            {[30_000, 40_000, 50_000].map(amount => (
              <div key={amount} className="flex items-center gap-3 rounded-md border p-3">
                <RadioGroupItem value={String(amount)} id={`amount-${amount}`} />
                <Label htmlFor={`amount-${amount}`} className="flex-1 cursor-pointer">{money.format(amount)}</Label>
              </div>
            ))}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="custom" id="amount-custom" />
                <Label htmlFor="amount-custom" className="cursor-pointer">Custom amount</Label>
              </div>
              {amountChoice === 'custom' && <Input aria-label="Custom contribution amount" type="number" inputMode="numeric" min={flexiblePricing?.minimumAmount} max={flexiblePricing?.maximumAmount} step="1" value={customAmount} onChange={event => setCustomAmount(event.currentTarget.value)} aria-invalid={!amountIsValid} placeholder="30000" />}
              {amountChoice === 'custom' && !amountIsValid && <p className="text-sm text-destructive">Enter a whole-rupiah amount from Rp30.000 through Rp10.000.000.</p>}
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button disabled={!amountIsValid || busy || !amountProduct} onClick={() => amountProduct && void openPayment(amountProduct, selectedAmount)}>
              {busy ? <><RefreshCw className="animate-spin" /> Opening…</> : `Pay ${money.format(selectedAmount || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
