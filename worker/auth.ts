import { betterAuth } from 'better-auth';
import { oAuthProxy } from 'better-auth/plugins';
import type { Env } from './env';

export function createAuth(env: Env) {
  const proxyTrustedOrigins = env.OAUTH_PROXY_TRUSTED_ORIGINS
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean) ?? [];
  const productionHost = new URL(env.BETTER_AUTH_URL).host;
  const allowedHosts = [
    productionHost,
    'acromion.org',
    '*.acromion.org',
    ...proxyTrustedOrigins.map(origin => origin.replace(/^https?:\/\//, '').split('/')[0]),
    ...(env.ENVIRONMENT === 'test' ? ['localhost:5173', '127.0.0.1:5173'] : []),
  ];

  return betterAuth({
    database: env.DB,
    baseURL: { allowedHosts: [...new Set(allowedHosts)], protocol: 'auto', fallback: env.BETTER_AUTH_URL },
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      'https://acromion.org',
      'https://*.acromion.org',
      ...proxyTrustedOrigins,
      ...(env.ENVIRONMENT === 'test' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ],
    plugins: [
      oAuthProxy({
        productionURL: env.BETTER_AUTH_URL,
        secret: env.OAUTH_PROXY_SECRET,
      }),
    ],
    advanced: {
      oauthConfig: {
        // Preview OAuth crosses hosts via the production proxy. Persisting each
        // flow independently avoids a retry overwriting the browser state cookie.
        storeStateStrategy: 'database',
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        role: {
          type: ['user', 'admin'],
          required: true,
          defaultValue: 'user',
          input: false,
        },
        tier: {
          type: ['free', 'pro'],
          required: true,
          defaultValue: 'free',
          input: false,
        },
      },
    },
    emailAndPassword: { enabled: env.ENVIRONMENT === 'test' },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
