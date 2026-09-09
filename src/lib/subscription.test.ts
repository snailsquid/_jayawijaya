import { describe, expect, it } from 'vitest';
import type { Payment } from '@/types/payment';
import { getSubscriptionSummary } from './subscription';

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1', orderId: 'order-1', productCode: 'pro-pass-30d', amount: 15_000,
  currency: 'IDR', entitlementDays: 30, status: 'succeeded', providerStatus: 'settlement',
  transactionId: null, paymentType: null, fraudStatus: null, snapToken: null, redirectUrl: null,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  verifiedAt: '2026-08-01T00:00:00.000Z', ...overrides,
});

describe('getSubscriptionSummary', () => {
  it('reports remaining time for the furthest active verified pass', () => {
    const summary = getSubscriptionSummary([
      payment(),
      payment({ id: 'payment-2', verifiedAt: '2026-08-10T00:00:00.000Z' }),
    ], new Date('2026-09-01T12:00:00.000Z'));
    expect(summary).toMatchObject({ active: true, daysRemaining: 8 });
    expect(summary.expiresAt?.toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  it('does not count failed or expired passes as active', () => {
    const summary = getSubscriptionSummary([
      payment({ status: 'failed' }),
      payment({ verifiedAt: '2026-06-01T00:00:00.000Z' }),
    ], new Date('2026-09-01T00:00:00.000Z'));
    expect(summary.active).toBe(false);
    expect(summary.daysRemaining).toBe(0);
  });
});
