import { useState, type ReactNode } from 'react';
import { authClient, type AppUser } from '../lib/auth-client';
import type { WorkspaceIdentity } from '../types/offline';
import { cacheAccount, cachedAccount, hasExplicitGuestWorkspace, setActiveWorkspace } from '../lib/workspace';
import { guestWorkspace } from '../lib/offline-db';
import { PageShell } from './app-shell';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader } from './ui/card';

export function AuthGate({ children, callbackURL = '/start', allowGuest = false }: {
  children: (user: WorkspaceIdentity) => ReactNode;
  callbackURL?: string;
  allowGuest?: boolean;
}) {
  const { data, isPending } = authClient.useSession();
  const [guest, setGuest] = useState(() => allowGuest && hasExplicitGuestWorkspace());
  const offlineAccount = !navigator.onLine ? cachedAccount() : null;

  if (data?.user) return children(cacheAccount(data.user as unknown as AppUser));
  if (allowGuest && guest) return children(guestWorkspace);
  if (offlineAccount) { setActiveWorkspace(offlineAccount); return children(offlineAccount); }
  if (isPending) return <main className="grid min-h-screen place-items-center p-6 font-semibold">Loading account…</main>;
  return (
    <PageShell className="grid min-h-screen max-w-md place-items-center">
      <Card className="w-full text-center">
        <CardHeader><h1 className="text-xl font-semibold">Choose a workspace</h1><CardDescription>Sign in for cloud sync, or use a private guest workspace stored on this device.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL })}>Continue with Google</Button>
          {allowGuest && <Button className="w-full" variant="secondary" onClick={() => { setActiveWorkspace(guestWorkspace); setGuest(true); }}>Continue as guest</Button>}
        </CardContent>
      </Card>
    </PageShell>
  );
}
