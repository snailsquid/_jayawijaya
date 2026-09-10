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
  plan: 'VIP' | 'VIP+' | 'MVP';
  entitlementDays: number | null;
  duration: { unit: 'months'; value: number } | { unit: 'lifetime'; value: null };
  benefits: readonly string[];
}

export interface ActiveEntitlement {
  plan: PaymentProduct['plan'];
  startsAt: string;
  expiresAt: string | null;
}

export interface MidtransClientConfig {
  clientKey: string;
  snapJsUrl: string;
}
