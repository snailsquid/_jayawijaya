import { createAuth } from './auth';
import type { Env } from './env';
import { handleModules } from './modules';
import { handleMidtransNotification, handlePayments } from './payments';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const auth = createAuth(env);

    if (url.pathname.startsWith('/api/auth/')) return auth.handler(request);

    if (url.pathname === '/api/payments/midtrans/notification') {
      return handleMidtransNotification(request, env);
    }

    if (url.pathname === '/api/me') {
      const session = await auth.api.getSession({ headers: request.headers });
      return session
        ? Response.json({ user: session.user })
        : Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, { status: 401 });
    }

    if (url.pathname.startsWith('/api/modules')) return handleModules(request, env, auth);
    if (url.pathname.startsWith('/api/payments')) return handlePayments(request, env, auth);

    return env.ASSETS.fetch(request);
  },
};
