import type { ReactNode } from 'react';
import { authClient, type AppUser } from '../lib/auth-client';

export function AuthGate({ children }: { children: (user: AppUser) => ReactNode }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) return <div style={{ padding: 24, fontWeight: 800 }}>Loading account…</div>;
  if (!data?.user) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section className="neu-box" style={{ padding: 32, maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 900 }}>SIGN IN</h1>
          <p>Your modules are private and linked to your Google account.</p>
          <button className="neu-btn neu-btn-primary" onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/start' })}>
            Continue with Google
          </button>
        </section>
      </main>
    );
  }
  return children(data.user as unknown as AppUser);
}
