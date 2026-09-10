import { describe, expect, it } from 'vitest';
import { canTransition, isProduction, mapMidtransStatus, PAYMENT_PRODUCTS, signatureFor, validateProviderPayment } from '../../worker/midtrans';

describe('Midtrans payment policy', () => {
  it('keeps the initial product server-owned', () => {
    expect(PAYMENT_PRODUCTS).toMatchObject([
      { code: 'vip-1m', amount: 30_000, duration: { unit: 'months', value: 1 } },
      { code: 'vip-plus-6m', amount: 40_000, duration: { unit: 'months', value: 6 } },
      { code: 'mvp-lifetime', amount: 100_000, duration: { unit: 'lifetime', value: null } },
    ]);
  });

  it('maps provider statuses and fraud decisions', () => {
    expect(mapMidtransStatus({ transaction_status: 'settlement' })).toBe('succeeded');
    expect(mapMidtransStatus({ transaction_status: 'capture', fraud_status: 'accept' })).toBe('succeeded');
    expect(mapMidtransStatus({ transaction_status: 'capture', fraud_status: 'challenge' })).toBe('pending');
    expect(mapMidtransStatus({ transaction_status: 'authorize' })).toBe('pending');
    expect(mapMidtransStatus({ transaction_status: 'failure' })).toBe('failed');
    expect(mapMidtransStatus({ transaction_status: 'deny' })).toBe('failed');
    expect(mapMidtransStatus({ transaction_status: 'partial_refund' })).toBe('refunded');
    expect(mapMidtransStatus({ transaction_status: 'chargeback' })).toBe('charged_back');
  });

  it('does not allow stale notifications to regress terminal states', () => {
    expect(canTransition('pending', 'succeeded')).toBe(true);
    expect(canTransition('pending', 'charged_back')).toBe(true);
    expect(canTransition('succeeded', 'pending')).toBe(false);
    expect(canTransition('succeeded', 'refunded')).toBe(true);
    expect(canTransition('refunded', 'succeeded')).toBe(false);
  });

  it('selects production only when explicitly enabled', () => {
    expect(isProduction({ MIDTRANS_IS_PRODUCTION: 'true' })).toBe(true);
    expect(isProduction({ MIDTRANS_IS_PRODUCTION: 'false' })).toBe(false);
    expect(isProduction({})).toBe(false);
  });

  it('generates the documented SHA-512 notification signature input', async () => {
    const actual = await signatureFor({ order_id: 'order-1', status_code: '200', gross_amount: '30000.00' }, 'server-key');
    const bytes = await crypto.subtle.digest('SHA-512', new TextEncoder().encode('order-120030000.00server-key'));
    const expected = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    expect(actual).toBe(expected);
  });

  it('validates notifications against the stored order amount and currency', () => {
    const payload = {
      order_id: 'order-1',
      status_code: '200',
      gross_amount: '30000.00',
      currency: 'IDR',
      transaction_status: 'settlement',
    };
    expect(() => validateProviderPayment(payload, { orderId: 'order-1', amount: 30_000, currency: 'IDR' })).not.toThrow();
    expect(() => validateProviderPayment(payload, { orderId: 'order-1', amount: 1, currency: 'IDR' })).toThrowError(/do not match/);
  });
});
