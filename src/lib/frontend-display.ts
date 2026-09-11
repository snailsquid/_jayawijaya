import type { PaymentProduct } from '@/types/payment';
import type { NavigateFunction } from 'react-router-dom';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function isAcromionHostname(hostname: string) {
  return hostname === 'acromion.org' || hostname === 'www.acromion.org';
}

export function formatProductPrice(product: PaymentProduct) {
  return product.pricing.type === 'flexible' ? `From ${money.format(product.pricing.minimumAmount)}` : money.format(product.amount);
}

export function navigateBackOr(navigate: NavigateFunction, fallback: string, historyState: unknown = window.history.state) {
  const index = historyState && typeof historyState === 'object' && 'idx' in historyState
    ? (historyState as { idx?: unknown }).idx
    : undefined;
  if (typeof index === 'number' && index > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
