import { useLocalStorage } from './useLocalStorage';
import type { GoogleUser, Subscription } from '../types/auth';

const AUTH_KEY = 'jayawijaya-auth';
const SUB_KEY = 'jayawijaya-subscription';

export function useAuth() {
  const [user, setUser, removeUser] = useLocalStorage<GoogleUser | null>(AUTH_KEY, null);
  const [subscription, setSubscription] = useLocalStorage<Subscription | null>(
    SUB_KEY,
    null,
  );

  const login = (googleUser: GoogleUser) => {
    setUser(googleUser);
    if (!subscription) {
      setSubscription({ tier: 'free', createdAt: new Date().toISOString() });
    }
  };

  const logout = () => {
    removeUser();
    setSubscription(null);
  };

  const setPremium = (invoiceId: string) => {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    setSubscription({
      tier: 'premium',
      expiresAt: expiry.toISOString(),
      invoiceId,
      createdAt: subscription?.createdAt ?? new Date().toISOString(),
    });
  };

  const isPremium = subscription?.tier === 'premium'
    && subscription.expiresAt
    && new Date(subscription.expiresAt) > new Date();

  return { user, subscription, isPremium, login, logout, setPremium };
}
