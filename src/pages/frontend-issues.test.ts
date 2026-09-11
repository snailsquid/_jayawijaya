import { describe, expect, it, vi } from 'vitest';
import { formatProductPrice, isAcromionHostname, navigateBackOr } from '@/lib/frontend-display';
import type { PaymentProduct } from '@/types/payment';

const acromionProduct: PaymentProduct = {
  code: 'acromion-lifetime',
  name: 'Acromion',
  amount: 0,
  currency: 'IDR',
  plan: 'Acromion',
  entitlementDays: null,
  duration: { unit: 'lifetime', value: null },
  benefits: ['200 modules'],
  pricing: { type: 'flexible', minimumAmount: 30_000, maximumAmount: 10_000_000 },
};

describe('frontend issue regressions', () => {
  it('uses the Acromion hero only on Acromion hostnames', () => {
    expect(isAcromionHostname('acromion.org')).toBe(true);
    expect(isAcromionHostname('www.acromion.org')).toBe(true);
    expect(isAcromionHostname('jw.arkk.dev')).toBe(false);
  });

  it('shows a useful price for flexible contribution products', () => {
    expect(formatProductPrice(acromionProduct)).toContain('30.000');
    expect(formatProductPrice(acromionProduct)).toMatch(/^From /);
  });

  it('uses app history when available and a safe route for direct visits', () => {
    const navigate = vi.fn();
    navigateBackOr(navigate, '/account', { idx: 2 });
    expect(navigate).toHaveBeenLastCalledWith(-1);

    navigateBackOr(navigate, '/account', { idx: 0 });
    expect(navigate).toHaveBeenLastCalledWith('/account', { replace: true });
  });
});
