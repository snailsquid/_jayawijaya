export type PaymentStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'canceled' | 'expired' | 'refunded' | 'charged_back';

export interface Payment {
  id: string;
  orderId: string;
  productCode: string;
  amount: number;
  currency: string;
  entitlementDays: number | null;
  status: PaymentStatus;
  providerStatus: string | null;
  transactionId: string | null;
  paymentType: string | null;
  fraudStatus: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
}

export interface PaymentProduct {
  code: string;
  name: string;
  amount: number;
  currency: string;
  entitlementDays: number;
}

export interface MidtransClientConfig {
  clientKey: string;
  snapJsUrl: string;
}

export interface SubscriptionSummary {
  active: boolean;
  expiresAt: Date | null;
  daysRemaining: number;
}
