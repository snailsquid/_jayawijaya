export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

export type SubscriptionTier = 'free' | 'premium';

export interface Subscription {
  tier: SubscriptionTier;
  expiresAt?: string;
  invoiceId?: string;
  createdAt: string;
}
