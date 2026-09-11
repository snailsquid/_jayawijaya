import type { PaymentProduct } from '@/types/payment';

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function isAcromionHostname(hostname: string) {
  return hostname === 'acromion.org' || hostname === 'www.acromion.org';
}

export function formatProductPrice(product: PaymentProduct) {
  return product.pricing.type === 'flexible' ? `From ${money.format(product.pricing.minimumAmount)}` : money.format(product.amount);
}
