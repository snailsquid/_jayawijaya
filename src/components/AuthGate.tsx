import type { ReactNode } from 'react';
import { authClient, type AppUser } from '../lib/auth-client';
import { PageShell } from './app-shell';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader } from './ui/card';

export function AuthGate({ children }: { children: (user: AppUser) => ReactNode }) {
  const { data, isPending } = authClient.useSession();

  if (isPending) return <main className="grid min-h-screen place-items-center p-6 font-semibold">Loading account…</main>;
  if (!data?.user) {
    return (
      <PageShell className="grid min-h-screen max-w-md place-items-center">
        <Card className="w-full text-center">
          <CardHeader><h1 className="text-xl font-semibold">Sign in</h1><CardDescription>Your modules are private and linked to your Google account.</CardDescription></CardHeader>
          <CardContent><Button className="w-full" onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/start' })}>Continue with Google</Button></CardContent>
        </Card>
      </PageShell>
    );
  }
  return children(data.user as unknown as AppUser);
}
