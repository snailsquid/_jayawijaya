import { betterAuth } from 'better-auth';
import type { Env } from './env';

export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      ...(env.ENVIRONMENT === 'test' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ],
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
