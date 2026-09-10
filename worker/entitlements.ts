const DAY_MS = 24 * 60 * 60 * 1_000;

interface PaymentEntitlement {
  entitlement_days: number | null;
  verified_at: string | null;
  updated_at: string;
}

export function hasActivePaymentEntitlement(payments: PaymentEntitlement[], now = new Date()): boolean {
  const expiresAt = payments
    .map(payment => ({ startsAt: new Date(payment.verified_at ?? payment.updated_at).getTime(), days: Number(payment.entitlement_days ?? 0) }))
    .filter(payment => Number.isFinite(payment.startsAt) && payment.days > 0)
    .sort((a, b) => a.startsAt - b.startsAt)
    .reduce((expiry, payment) => Math.max(expiry, payment.startsAt) + payment.days * DAY_MS, 0);
  return expiresAt > now.getTime();
}

export async function effectiveTier(db: D1Database, userId: string, persistedTier?: string): Promise<'free' | 'pro'> {
  if (persistedTier === 'pro') return 'pro';
  const rows = await db.prepare(`SELECT entitlement_days, verified_at, updated_at FROM payments
    WHERE user_id = ? AND status = 'succeeded' AND entitlement_days > 0
    ORDER BY COALESCE(verified_at, updated_at)`).bind(userId).all<PaymentEntitlement>();
  return hasActivePaymentEntitlement(rows.results) ? 'pro' : 'free';
}
