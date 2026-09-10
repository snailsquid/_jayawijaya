import type { Payment, SubscriptionSummary } from '@/types/payment';

const DAY_MS = 24 * 60 * 60 * 1_000;

export function getSubscriptionSummary(payments: Payment[], now = new Date()): SubscriptionSummary {
  const entitlements = payments
    .filter(payment => payment.status === 'succeeded' && payment.entitlementDays)
    .map(payment => {
      const start = payment.verifiedAt ?? payment.updatedAt;
      return { startsAtMs: new Date(start).getTime(), days: payment.entitlementDays ?? 0 };
    })
    .filter(entitlement => Number.isFinite(entitlement.startsAtMs))
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
  const expiresAtMs = entitlements.reduce(
    (previousExpiry, entitlement) => Math.max(previousExpiry, entitlement.startsAtMs) + entitlement.days * DAY_MS,
    0,
  );
  const remainingMs = expiresAtMs - now.getTime();

  return {
    active: remainingMs > 0,
    expiresAt: expiresAtMs > 0 ? new Date(expiresAtMs) : null,
    daysRemaining: remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : 0,
  };
}
