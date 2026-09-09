import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ baseURL: window.location.origin });

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: 'user' | 'admin';
  tier: 'free' | 'pro';
};

