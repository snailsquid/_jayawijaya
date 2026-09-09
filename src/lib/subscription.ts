import type { Payment, SubscriptionSummary } from '@/types/payment';

const DAY_MS = 24 * 60 * 60 * 1_000;

export function getSubscriptionSummary(payments: Payment[], now = new Date()): SubscriptionSummary {
  const expirations = payments
    .filter(payment => payment.status === 'succeeded' && payment.entitlementDays)
    .map(payment => {
      const start = payment.verifiedAt ?? payment.updatedAt;
      const timestamp = new Date(start).getTime();
      return Number.isFinite(timestamp) ? timestamp + (payment.entitlementDays ?? 0) * DAY_MS : 0;
    });
  const expiresAtMs = Math.max(0, ...expirations);
  const remainingMs = expiresAtMs - now.getTime();

  return {
    active: remainingMs > 0,
    expiresAt: expiresAtMs > 0 ? new Date(expiresAtMs) : null,
    daysRemaining: remainingMs > 0 ? Math.ceil(remainingMs / DAY_MS) : 0,
  };
}
