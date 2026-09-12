import type { Auth } from './auth';
import type { Env } from './env';
import {
  PaymentError,
  canTransition,
  createMidtransProvider,
  isProduction,
  toProviderUpdate,
  validateProviderPayment,
  verifySignature,
  findPaymentProduct,
  paymentProductsForHostname,
  type ExpectedPayment,
  type MidtransStatusPayload,
  type PaymentProvider,
  type PaymentStatus,
  type ProviderUpdate,
} from './midtrans';
import { effectiveTier } from './entitlements';

interface AuthUser { id: string; name: string; email: string }
interface PaymentRow extends Record<string, unknown> {
  id: string;
  order_id: string;
  user_id: string;
  product_code: string;
  amount: number;
  currency: string;
  entitlement_days: number | null;
  status: PaymentStatus;
  provider_status: string | null;
  provider_transaction_id: string | null;
  payment_type: string | null;
  fraud_status: string | null;
  snap_token: string | null;
  redirect_url: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

const ABANDONED_CREATION_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function fromRow(row: PaymentRow) {
  const isActive = row.status === 'created' || row.status === 'pending';
  return {
    id: row.id,
    orderId: row.order_id,
    productCode: row.product_code,
    amount: Number(row.amount),
    currency: row.currency,
    entitlementDays: row.entitlement_days == null ? null : Number(row.entitlement_days),
    status: row.status,
    providerStatus: row.provider_status,
    transactionId: row.provider_transaction_id,
    paymentType: row.payment_type,
    fraudStatus: row.fraud_status,
    snapToken: isActive ? row.snap_token : null,
    redirectUrl: isActive ? row.redirect_url : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedAt: row.verified_at,
  };
}

function clientConfig(env: Env) {
  return {
    clientKey: env.MIDTRANS_CLIENT_KEY,
    snapJsUrl: isProduction(env)
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
  };
}

async function currentUser(auth: Auth, request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user as AuthUser | null;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    const body: unknown = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new PaymentError('Request body must be a JSON object.', 400, 'INVALID_JSON');
    }
    return body as T;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
}

async function findPayment(env: Env, orderId: string, userId?: string) {
  const query = userId
    ? env.DB.prepare('SELECT * FROM payments WHERE order_id = ? AND user_id = ?').bind(orderId, userId)
    : env.DB.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId);
  return query.first<PaymentRow>();
}

async function applyUpdate(env: Env, row: PaymentRow, update: ProviderUpdate) {
  let current = row;
  for (;;) {
    if (!canTransition(current.status, update.status)) return current;
    const now = new Date().toISOString();
    const verifiedAt = update.status === 'succeeded' ? current.verified_at ?? now : current.verified_at;
    const providerTransactionId = update.transactionId ?? current.provider_transaction_id;
    const paymentType = update.paymentType ?? current.payment_type;
    const fraudStatus = update.fraudStatus ?? current.fraud_status;
    const result = await env.DB.prepare(`UPDATE payments SET status = ?, provider_status = ?, provider_transaction_id = ?,
      payment_type = ?, fraud_status = ?, updated_at = ?, verified_at = ? WHERE id = ? AND status = ?`)
      .bind(update.status, update.providerStatus, providerTransactionId, paymentType,
        fraudStatus, now, verifiedAt, current.id, current.status).run();
    const latest = await findPayment(env, current.order_id);
    if (!latest) throw new PaymentError('Payment disappeared while it was being updated.', 409, 'PAYMENT_CONFLICT');
    if (result.meta.changes > 0) {
      await syncEntitlement(env, latest);
      return latest;
    }
    current = latest;
  }
}

function addCalendarMonths(iso: string, months: number) {
  const date = new Date(iso);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString();
}

interface EntitlementRow extends Record<string, unknown> {
  id: string;
  product_code: string;
  starts_at: string;
  expires_at: string | null;
}

async function revokeAndRescheduleEntitlement(env: Env, payment: PaymentRow, now: string) {
  await env.DB.prepare(`INSERT OR IGNORE INTO entitlement_allocation_versions (user_id, version)
    VALUES (?, 0)`).bind(payment.user_id).run();
  for (;;) {
    const allocation = await env.DB.prepare('SELECT version FROM entitlement_allocation_versions WHERE user_id = ?')
      .bind(payment.user_id).first<{ version: number }>();
    const revoked = await env.DB.prepare(`SELECT id, product_code, starts_at, expires_at FROM entitlements
      WHERE payment_id = ? AND active = 1`).bind(payment.id).first<EntitlementRow>();
    if (!revoked) return;
    const downstream = revoked.expires_at === null ? { results: [] as EntitlementRow[] } : await env.DB.prepare(`SELECT id, product_code, starts_at, expires_at FROM entitlements
      WHERE user_id = ? AND active = 1 AND starts_at >= ? AND id <> ? ORDER BY starts_at, created_at`)
      .bind(payment.user_id, revoked.expires_at, revoked.id).all<EntitlementRow>();
    const version = Number(allocation?.version ?? 0);
    let cursor = revoked.starts_at > now ? revoked.starts_at : now;
    const statements = [
      env.DB.prepare(`UPDATE entitlements SET active = 0, updated_at = ? WHERE id = ?
        AND (SELECT version FROM entitlement_allocation_versions WHERE user_id = ?) = ?`)
        .bind(now, revoked.id, payment.user_id, version),
    ];
    for (const entitlement of downstream.results) {
      const product = findPaymentProduct(entitlement.product_code);
      if (!product) continue;
      const expiresAt = product.duration.unit === 'lifetime'
        ? null
        : addCalendarMonths(cursor, product.duration.value);
      statements.push(env.DB.prepare(`UPDATE entitlements SET starts_at = ?, expires_at = ?, updated_at = ?
        WHERE id = ? AND (SELECT version FROM entitlement_allocation_versions WHERE user_id = ?) = ?`)
        .bind(cursor, expiresAt, now, entitlement.id, payment.user_id, version));
      if (expiresAt === null) break;
      cursor = expiresAt;
    }
    statements.push(env.DB.prepare(`UPDATE entitlement_allocation_versions SET version = version + 1
      WHERE user_id = ? AND version = ?`).bind(payment.user_id, version));
    const results = await env.DB.batch(statements);
    if (results.at(-1)?.meta.changes === 1) return;
  }
}

async function syncEntitlement(env: Env, payment: PaymentRow) {
  const product = findPaymentProduct(payment.product_code);
  if (!product) return;
  const now = new Date().toISOString();
  if (payment.status === 'succeeded') {
    await env.DB.prepare(`INSERT OR IGNORE INTO entitlement_allocation_versions (user_id, version)
      VALUES (?, 0)`).bind(payment.user_id).run();
    for (;;) {
      const existing = await env.DB.prepare('SELECT 1 ok FROM entitlements WHERE payment_id = ?')
        .bind(payment.id).first();
      if (existing) return;
      const allocation = await env.DB.prepare('SELECT version FROM entitlement_allocation_versions WHERE user_id = ?')
        .bind(payment.user_id).first<{ version: number }>();
      const latest = await env.DB.prepare(`SELECT expires_at FROM entitlements
        WHERE user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY expires_at IS NULL DESC, expires_at DESC LIMIT 1`)
        .bind(payment.user_id, now).first<{ expires_at: string | null }>();
      if (latest?.expires_at === null) return;
      const startsAt = latest?.expires_at ?? now;
      const expiresAt = product.duration.unit === 'lifetime'
        ? null
        : addCalendarMonths(startsAt, product.duration.value);
      const version = Number(allocation?.version ?? 0);
      const results = await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO entitlements
          (id, user_id, payment_id, product_code, plan, starts_at, expires_at, active, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
          WHERE (SELECT version FROM entitlement_allocation_versions WHERE user_id = ?) = ?`)
          .bind(crypto.randomUUID(), payment.user_id, payment.id, product.code, product.plan,
            startsAt, expiresAt, now, now, payment.user_id, version),
        env.DB.prepare(`UPDATE entitlement_allocation_versions SET version = version + 1
          WHERE user_id = ? AND version = ?`).bind(payment.user_id, version),
      ]);
      if (results.at(-1)?.meta.changes === 1) return;
    }
  } else if (payment.status === 'refunded' || payment.status === 'charged_back') {
    await revokeAndRescheduleEntitlement(env, payment, now);
  }
}

async function findActivePayment(env: Env, userId: string, productCode: string) {
  return env.DB.prepare(`SELECT * FROM payments WHERE user_id = ? AND product_code = ?
    AND status IN ('created', 'pending') ORDER BY created_at DESC LIMIT 1`)
    .bind(userId, productCode).first<PaymentRow>();
}

async function recoverAbandonedCreation(env: Env, active: PaymentRow | null) {
  if (!active || active.status !== 'created' || active.snap_token) return active;
  const createdAt = Date.parse(active.created_at);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt < ABANDONED_CREATION_MS) return active;
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE payments SET status = 'expired', provider_status = 'creation_abandoned',
    updated_at = ? WHERE id = ? AND status = 'created' AND snap_token IS NULL`)
    .bind(now, active.id).run();
  return result.meta.changes > 0 ? null : findActivePayment(env, active.user_id, active.product_code);
}

async function reconcile(env: Env, row: PaymentRow, provider: PaymentProvider) {
  const payload = await provider.getStatus(row.order_id);
  const expected: ExpectedPayment = { orderId: row.order_id, amount: Number(row.amount), currency: row.currency };
  validateProviderPayment(payload, expected);
  return applyUpdate(env, row, toProviderUpdate(payload));
}

async function createPayment(request: Request, env: Env, user: AuthUser, provider: PaymentProvider) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new PaymentError('Invalid request origin.', 403, 'INVALID_ORIGIN');
  }
  const url = new URL(request.url);
  const availableProducts = paymentProductsForHostname(url.hostname);
  const body = await readJson<{ productCode?: unknown; amount?: unknown }>(request);
  const product = findPaymentProduct(body.productCode);
  if (!product || !availableProducts.some(candidate => candidate.code === product.code)) {
    throw new PaymentError('Unknown payment product.', 422, 'INVALID_PRODUCT');
  }
  let amount = product.amount;
  if (product.pricing.type === 'flexible') {
    if (!Number.isSafeInteger(body.amount)
      || (body.amount as number) < product.pricing.minimumAmount
      || (body.amount as number) > product.pricing.maximumAmount) {
      throw new PaymentError(
        `Amount must be a whole rupiah value from ${product.pricing.minimumAmount} through ${product.pricing.maximumAmount}.`,
        422,
        'INVALID_AMOUNT',
      );
    }
    amount = body.amount as number;
  }
  const lifetime = await env.DB.prepare(`SELECT 1 ok FROM entitlements
    WHERE user_id = ? AND active = 1 AND expires_at IS NULL LIMIT 1`).bind(user.id).first();
  if (lifetime && product.code !== 'acromion-lifetime') {
    throw new PaymentError('Lifetime access is already active.', 409, 'LIFETIME_ALREADY_ACTIVE');
  }
  const active = await recoverAbandonedCreation(env, await findActivePayment(env, user.id, product.code));
  if (active?.snap_token) return json({ payment: fromRow(active), config: clientConfig(env) });
  if (active) throw new PaymentError('A payment is already being prepared. Try again shortly.', 409, 'PAYMENT_IN_PROGRESS');

  const id = crypto.randomUUID();
  const orderId = `JW-${Date.now()}-${id.slice(0, 8)}`;
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO payments
      (id, order_id, user_id, product_code, amount, currency, entitlement_days, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)`)
      .bind(id, orderId, user.id, product.code, amount, product.currency,
        product.entitlementDays, now, now).run();
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      const existing = await recoverAbandonedCreation(env, await findActivePayment(env, user.id, product.code));
      if (existing?.snap_token) return json({ payment: fromRow(existing), config: clientConfig(env) });
      if (existing) throw new PaymentError('A payment is already being prepared. Try again shortly.', 409, 'PAYMENT_IN_PROGRESS');
    }
    throw error;
  }

  try {
    const transaction = await provider.createTransaction({
      orderId,
      product,
      amount,
      customer: { name: user.name, email: user.email },
    });
    if (!transaction.token) throw new PaymentError('Midtrans did not return a payment token.', 502, 'PROVIDER_ERROR');
    await env.DB.prepare(`UPDATE payments SET status = 'pending', provider_status = 'pending', snap_token = ?,
      redirect_url = ?, updated_at = ? WHERE id = ?`)
      .bind(transaction.token, transaction.redirectUrl, new Date().toISOString(), id).run();
    const created = await findPayment(env, orderId, user.id);
    return json({ payment: fromRow(created!), config: clientConfig(env) }, 201);
  } catch (error) {
    await env.DB.prepare('DELETE FROM payments WHERE id = ?').bind(id).run();
    throw error;
  }
}

async function cancelPayment(request: Request, env: Env, user: AuthUser, provider: PaymentProvider, orderId: string) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new PaymentError('Invalid request origin.', 403, 'INVALID_ORIGIN');
  }
  const row = await findPayment(env, orderId, user.id);
  if (!row) return json({ error: { code: 'NOT_FOUND', message: 'Payment not found.' } }, 404);
  if (row.status !== 'created' && row.status !== 'pending') {
    throw new PaymentError('Only an active payment can be canceled.', 409, 'PAYMENT_NOT_ACTIVE');
  }
  if (!row.snap_token) {
    const updated = await applyUpdate(env, row, {
      status: 'canceled', providerStatus: 'cancel', transactionId: null, paymentType: null, fraudStatus: null,
    });
    return json({ payment: fromRow(updated) });
  }
  const payload = await provider.cancel(orderId);
  validateProviderPayment(payload, { orderId: row.order_id, amount: Number(row.amount), currency: row.currency });
  const updated = await applyUpdate(env, row, toProviderUpdate(payload));
  return json({ payment: fromRow(updated) });
}

export async function handlePayments(request: Request, env: Env, auth: Auth): Promise<Response> {
  const user = await currentUser(auth, request);
  if (!user) return json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, 401);
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/payments(?:\/([^/]+))?$/);
  if (!match) return json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
  const provider = createMidtransProvider(env);

  try {
    let orderId: string | null = null;
    if (match[1]) {
      try {
        orderId = decodeURIComponent(match[1]);
      } catch {
        throw new PaymentError('Payment order ID is invalid.', 400, 'INVALID_ORDER_ID');
      }
    }
    if (request.method === 'POST' && !orderId) return await createPayment(request, env, user, provider);
    if (request.method === 'GET' && !orderId) {
      const result = await env.DB.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC')
        .bind(user.id).all<PaymentRow>();
      const now = new Date().toISOString();
      const entitlement = await env.DB.prepare(`SELECT plan, starts_at, expires_at FROM entitlements
        WHERE user_id = ? AND active = 1 AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY expires_at IS NULL DESC, expires_at DESC LIMIT 1`)
        .bind(user.id, now, now).first();
      return json({
        payments: result.results.map(fromRow), products: paymentProductsForHostname(url.hostname),
        tier: await effectiveTier(env.DB, user.id),
        entitlement: entitlement ? {
          plan: entitlement.plan, startsAt: entitlement.starts_at, expiresAt: entitlement.expires_at,
        } : null,
        config: clientConfig(env),
      });
    }
    if (request.method === 'GET' && orderId) {
      let row = await findPayment(env, orderId, user.id);
      if (!row) return json({ error: { code: 'NOT_FOUND', message: 'Payment not found.' } }, 404);
      if (row.status === 'created' || row.status === 'pending') row = await reconcile(env, row, provider);
      return json({ payment: fromRow(row) });
    }
    if (request.method === 'DELETE' && orderId) return cancelPayment(request, env, user, provider, orderId);
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }, 405);
  } catch (error) {
    if (error instanceof PaymentError) return json({ error: { code: error.code, message: error.message } }, error.status);
    console.error(error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } }, 500);
  }
}

export async function handleMidtransNotification(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }, 405);
    const payload = await readJson<MidtransStatusPayload>(request);
    if (!payload.order_id || !payload.status_code || !payload.gross_amount || !payload.transaction_status || !payload.signature_key) {
      throw new PaymentError('Incomplete Midtrans notification.', 400, 'INVALID_NOTIFICATION');
    }
    if (!await verifySignature(payload, env.MIDTRANS_SERVER_KEY)) {
      throw new PaymentError('Invalid Midtrans signature.', 401, 'INVALID_SIGNATURE');
    }
    const row = await findPayment(env, payload.order_id);
    if (!row) throw new PaymentError('Payment not found.', 404, 'NOT_FOUND');
    validateProviderPayment(payload, { orderId: row.order_id, amount: Number(row.amount), currency: row.currency });
    const updated = await applyUpdate(env, row, toProviderUpdate(payload));
    return json({ accepted: true, payment: { orderId: updated.order_id, status: updated.status } });
  } catch (error) {
    if (error instanceof PaymentError) return json({ error: { code: error.code, message: error.message } }, error.status);
    console.error(error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } }, 500);
  }
}
