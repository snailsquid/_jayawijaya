import { beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env, reset, SELF, type D1Migration } from 'cloudflare:test';
import { signatureFor } from '../../worker/midtrans';

declare module 'cloudflare:test' {
  interface ProvidedEnv { DB: D1Database; TEST_MIGRATIONS: D1Migration[] }
}

async function signUp(identity: string) {
  const response = await SELF.fetch('http://example.test/api/auth/sign-up/email', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: identity, email: `${identity}@example.test`, password: 'secure-password-123' }),
  });
  return response.headers.get('set-cookie')!.split(';')[0];
}

function api(path: string, cookie?: string, init: RequestInit = {}) {
  return SELF.fetch(`http://example.test${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', origin: 'http://example.test', ...(cookie ? { cookie } : {}), ...init.headers },
  });
}

async function notification(orderId: string, overrides: Record<string, string> = {}) {
  const payload = {
    order_id: orderId, status_code: '200', gross_amount: '15000.00', currency: 'IDR',
    transaction_status: 'settlement', transaction_id: 'midtrans-transaction', payment_type: 'qris', fraud_status: 'accept',
    ...overrides,
  };
  const signature_key = await signatureFor(payload, 'test-midtrans-server-key');
  return api('/api/payments/midtrans/notification', undefined, { method: 'POST', body: JSON.stringify({ ...payload, signature_key }) });
}

describe('payment API', () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  it('requires authentication and rejects browser-controlled products', async () => {
    expect((await api('/api/payments')).status).toBe(401);
    const cookie = await signUp('alice');
    const response = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'cheap-pass', amount: 1 }) });
    expect(response.status).toBe(422);
  });

  it('rejects non-object request bodies and malformed order IDs', async () => {
    const cookie = await signUp('alice');
    const nullBody = await api('/api/payments', cookie, { method: 'POST', body: 'null' });
    expect(nullBody.status).toBe(400);
    expect(await nullBody.json()).toMatchObject({ error: { code: 'INVALID_JSON' } });
    expect((await api('/api/payments/%E0%A4%A', cookie)).status).toBe(400);
    const notificationResponse = await api('/api/payments/midtrans/notification', undefined, { method: 'POST', body: 'null' });
    expect(notificationResponse.status).toBe(400);
  });

  it('creates a fixed-price order and resumes the active Snap transaction', async () => {
    const cookie = await signUp('alice');
    const first = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d', amount: 1 }) });
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { payment: { orderId: string; amount: number; snapToken: string } };
    expect(firstBody.payment).toMatchObject({ amount: 15_000, snapToken: 'snap-token' });
    const resumed = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    expect(resumed.status).toBe(200);
    expect((await resumed.json() as { payment: { orderId: string } }).payment.orderId).toBe(firstBody.payment.orderId);
  });

  it('expires an abandoned tokenless creation and starts a replacement order', async () => {
    const cookie = await signUp('alice');
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await env.DB.prepare(`INSERT INTO payments
      (id, order_id, user_id, product_code, amount, currency, entitlement_days, status, created_at, updated_at)
      VALUES ('stale-id', 'stale-order', ?, 'pro-pass-30d', 15000, 'IDR', 30, 'created', ?, ?)`).bind(user!.id, staleTime, staleTime).run();

    const response = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    expect(response.status).toBe(201);
    const stale = await env.DB.prepare("SELECT status, provider_status FROM payments WHERE id = 'stale-id'")
      .first<{ status: string; provider_status: string }>();
    expect(stale).toEqual({ status: 'expired', provider_status: 'creation_abandoned' });
  });

  it('reconciles an active payment from the provider before returning its detail', async () => {
    const cookie = await signUp('alice');
    const created = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    const detail = await api(`/api/payments/${orderId}`, cookie);
    expect(detail.status).toBe(200);
    expect((await detail.json() as { payment: { status: string; transactionId: string } }).payment)
      .toMatchObject({ status: 'succeeded', transactionId: 'midtrans-transaction' });
  });

  it('enforces ownership of payment detail', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const created = await api('/api/payments', alice, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    expect((await api(`/api/payments/${orderId}`, bob)).status).toBe(404);
  });

  it('verifies and idempotently persists notifications without granting Pro', async () => {
    const cookie = await signUp('alice');
    const created = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    expect((await notification(orderId)).status).toBe(200);
    expect((await notification(orderId)).status).toBe(200);
    const row = await env.DB.prepare('SELECT status, verified_at FROM payments WHERE order_id = ?').bind(orderId).first<{ status: string; verified_at: string | null }>();
    expect(row?.status).toBe('succeeded');
    expect(row?.verified_at).toBeTruthy();
    const user = await env.DB.prepare("SELECT tier FROM user WHERE email = 'alice@example.test'").first<{ tier: string }>();
    expect(user?.tier).toBe('free');
  });

  it('rejects invalid signatures and mismatched amounts', async () => {
    const cookie = await signUp('alice');
    const created = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    const invalid = await api('/api/payments/midtrans/notification', undefined, {
      method: 'POST', body: JSON.stringify({ order_id: orderId, status_code: '200', gross_amount: '15000.00', transaction_status: 'settlement', signature_key: 'bad' }),
    });
    expect(invalid.status).toBe(401);
    expect((await notification(orderId, { gross_amount: '1.00' })).status).toBe(409);
  });

  it('ignores stale pending notifications after settlement', async () => {
    const cookie = await signUp('alice');
    const created = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    await notification(orderId);
    await notification(orderId, { transaction_status: 'pending' });
    const row = await env.DB.prepare('SELECT status FROM payments WHERE order_id = ?').bind(orderId).first<{ status: string }>();
    expect(row?.status).toBe('succeeded');
  });

  it('does not lose a refund racing with settlement', async () => {
    const cookie = await signUp('alice');
    const created = await api('/api/payments', cookie, { method: 'POST', body: JSON.stringify({ productCode: 'pro-pass-30d' }) });
    const orderId = (await created.json() as { payment: { orderId: string } }).payment.orderId;
    const [settlement, refund] = await Promise.all([
      notification(orderId),
      notification(orderId, { transaction_status: 'refund' }),
    ]);
    expect(settlement.status).toBe(200);
    expect(refund.status).toBe(200);
    const row = await env.DB.prepare('SELECT status FROM payments WHERE order_id = ?').bind(orderId).first<{ status: string }>();
    expect(row?.status).toBe('refunded');
  });
});
