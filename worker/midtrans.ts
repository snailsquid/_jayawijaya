import type { Env } from './env';

export const PASS_PRODUCT = {
  code: 'pro-pass-30d',
  name: '_jayawijaya 30-day pass',
  amount: 15_000,
  currency: 'IDR',
  entitlementDays: 30,
} as const;

export type PaymentStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'canceled' | 'expired' | 'refunded' | 'charged_back';

export interface MidtransStatusPayload {
  order_id: string;
  gross_amount: string;
  currency?: string;
  status_code: string;
  signature_key?: string;
  transaction_status: string;
  transaction_id?: string;
  payment_type?: string;
  fraud_status?: string;
}

export interface ProviderUpdate {
  status: PaymentStatus;
  providerStatus: string;
  transactionId: string | null;
  paymentType: string | null;
  fraudStatus: string | null;
}

export interface ExpectedPayment {
  orderId: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  createTransaction(input: { orderId: string; amount: number; customer: { name: string; email: string } }): Promise<{ token: string; redirectUrl: string }>;
  getStatus(orderId: string): Promise<MidtransStatusPayload>;
}

export class PaymentError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = 'PAYMENT_ERROR') {
    super(message);
  }
}

export function isProduction(env: Pick<Env, 'MIDTRANS_IS_PRODUCTION'>) {
  return env.MIDTRANS_IS_PRODUCTION === 'true';
}

function basicAuth(serverKey: string) {
  return `Basic ${btoa(`${serverKey}:`)}`;
}

async function midtransRequest<T>(url: string, env: Env, init?: RequestInit): Promise<T> {
  const requestInit = {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth(env.MIDTRANS_SERVER_KEY),
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  };
  const response = env.MIDTRANS
    ? await env.MIDTRANS.fetch(new Request(url, requestInit))
    : await fetch(url, requestInit);
  const body = await response.json().catch(() => null) as (T & { status_message?: string }) | null;
  if (!response.ok || !body) {
    throw new PaymentError(body?.status_message ?? 'Midtrans request failed.', 502, 'PROVIDER_ERROR');
  }
  return body;
}

export function createMidtransProvider(env: Env): PaymentProvider {
  const production = isProduction(env);
  const snapBase = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const apiBase = production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  return {
    createTransaction: async ({ orderId, amount, customer }) => {
      const result = await midtransRequest<{ token: string; redirect_url: string }>(`${snapBase}/snap/v1/transactions`, env, {
        method: 'POST',
        body: JSON.stringify({
          transaction_details: { order_id: orderId, gross_amount: amount },
          item_details: [{ id: PASS_PRODUCT.code, price: amount, quantity: 1, name: PASS_PRODUCT.name }],
          customer_details: { first_name: customer.name, email: customer.email },
          credit_card: { secure: true },
        }),
      });
      return { token: result.token, redirectUrl: result.redirect_url };
    },
    getStatus: orderId => midtransRequest<MidtransStatusPayload>(`${apiBase}/v2/${encodeURIComponent(orderId)}/status`, env),
  };
}

export function mapMidtransStatus(payload: Pick<MidtransStatusPayload, 'transaction_status' | 'fraud_status'>): PaymentStatus {
  switch (payload.transaction_status) {
    case 'settlement': return 'succeeded';
    case 'capture': return payload.fraud_status === 'accept' ? 'succeeded' : payload.fraud_status === 'deny' ? 'failed' : 'pending';
    case 'authorize':
    case 'challenge':
    case 'pending': return 'pending';
    case 'deny': return 'failed';
    case 'failure': return 'failed';
    case 'cancel': return 'canceled';
    case 'expire': return 'expired';
    case 'refund':
    case 'partial_refund': return 'refunded';
    case 'chargeback':
    case 'partial_chargeback': return 'charged_back';
    default: throw new PaymentError('Unsupported Midtrans transaction status.', 422, 'UNKNOWN_PROVIDER_STATUS');
  }
}

const allowedTransitions: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  created: new Set(['created', 'pending', 'succeeded', 'failed', 'canceled', 'expired', 'refunded', 'charged_back']),
  pending: new Set(['pending', 'succeeded', 'failed', 'canceled', 'expired', 'refunded', 'charged_back']),
  succeeded: new Set(['succeeded', 'refunded', 'charged_back']),
  failed: new Set(['failed']),
  canceled: new Set(['canceled']),
  expired: new Set(['expired']),
  refunded: new Set(['refunded', 'charged_back']),
  charged_back: new Set(['charged_back']),
};

export function canTransition(from: PaymentStatus, to: PaymentStatus) {
  return allowedTransitions[from].has(to);
}

export function toProviderUpdate(payload: MidtransStatusPayload): ProviderUpdate {
  return {
    status: mapMidtransStatus(payload),
    providerStatus: payload.transaction_status,
    transactionId: payload.transaction_id ?? null,
    paymentType: payload.payment_type ?? null,
    fraudStatus: payload.fraud_status ?? null,
  };
}

export async function signatureFor(payload: Pick<MidtransStatusPayload, 'order_id' | 'status_code' | 'gross_amount'>, serverKey: string) {
  const input = `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`;
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifySignature(payload: MidtransStatusPayload, serverKey: string) {
  if (typeof payload.signature_key !== 'string' || payload.signature_key.length === 0) return false;
  const expected = await signatureFor(payload, serverKey);
  return constantTimeEqual(expected, payload.signature_key.toLowerCase());
}

export function validateProviderPayment(payload: MidtransStatusPayload, expected: string | ExpectedPayment) {
  const expectedPayment: ExpectedPayment = typeof expected === 'string'
    ? { orderId: expected, amount: PASS_PRODUCT.amount, currency: PASS_PRODUCT.currency }
    : expected;
  if (!payload.order_id || !payload.status_code || !payload.gross_amount || !payload.transaction_status) {
    throw new PaymentError('Incomplete Midtrans notification.', 400, 'INVALID_NOTIFICATION');
  }
  const grossAmount = Number(payload.gross_amount);
  if (!Number.isFinite(grossAmount)
    || payload.order_id !== expectedPayment.orderId
    || grossAmount !== expectedPayment.amount
    || (payload.currency ?? expectedPayment.currency) !== expectedPayment.currency) {
    throw new PaymentError('Payment details do not match the order.', 409, 'PAYMENT_MISMATCH');
  }
}
