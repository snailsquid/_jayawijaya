const DAY_MS = 24 * 60 * 60 * 1_000;

interface LegacyPaymentEntitlement {
  entitlement_days: number | null;
  verified_at: string | null;
  updated_at: string;
}

export function hasActivePaymentEntitlement(payments: LegacyPaymentEntitlement[], now = new Date()): boolean {
  const expiresAt = payments
    .map(payment => ({ startsAt: new Date(payment.verified_at ?? payment.updated_at).getTime(), days: Number(payment.entitlement_days ?? 0) }))
    .filter(payment => Number.isFinite(payment.startsAt) && payment.days > 0)
    .sort((a, b) => a.startsAt - b.startsAt)
    .reduce((expiry, payment) => Math.max(expiry, payment.startsAt) + payment.days * DAY_MS, 0);
  return expiresAt > now.getTime();
}

export async function effectiveTier(db: D1Database, userId: string, persistedTier?: string): Promise<'free' | 'pro'> {
  if (persistedTier === 'pro') return 'pro';
  const now = new Date().toISOString();
  const entitlement = await db.prepare(`SELECT 1 ok FROM entitlements
    WHERE user_id = ? AND active = 1 AND starts_at <= ?
      AND (expires_at IS NULL OR expires_at > ?)
    UNION ALL
    SELECT 1 ok FROM access_grants
    WHERE active = 1 AND tier = 'pro' AND starts_at <= ?
      AND (expires_at IS NULL OR expires_at > ?)
      AND (subject_type = 'global' OR (subject_type = 'user' AND subject_id = ?))
    LIMIT 1`).bind(userId, now, now, now, now, userId).first();
  return entitlement ? 'pro' : 'free';
}

export async function liveModuleAccess(db: D1Database, userId: string, persistedTier?: string) {
  if (persistedTier === 'pro') return { enabled: true, expiresAt: null };
  const now = new Date().toISOString();
  const rows = await db.prepare(`SELECT expires_at FROM entitlements
    WHERE user_id = ? AND active = 1 AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
    UNION ALL
    SELECT expires_at FROM access_grants
    WHERE active = 1 AND tier = 'pro' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
      AND (subject_type = 'global' OR (subject_type = 'user' AND subject_id = ?))`)
    .bind(userId, now, now, now, now, userId).all<{ expires_at: string | null }>();
  if (!rows.results.length) return { enabled: false, expiresAt: null };
  if (rows.results.some(row => row.expires_at === null)) return { enabled: true, expiresAt: null };
  return { enabled: true, expiresAt: rows.results.map(row => row.expires_at!).sort().at(-1)! };
}
