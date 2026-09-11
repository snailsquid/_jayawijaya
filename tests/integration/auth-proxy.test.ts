import { beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env, reset, SELF, type D1Migration } from 'cloudflare:test';

declare module 'cloudflare:test' {
  interface ProvidedEnv { DB: D1Database; TEST_MIGRATIONS: D1Migration[] }
}

describe('OAuth preview proxy', () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  it('uses the production Google callback while retaining the trusted preview callback', async () => {
    const response = await SELF.fetch('http://preview.example.test/api/auth/sign-in/social', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://preview.example.test',
      },
      body: JSON.stringify({ provider: 'google', callbackURL: '/start' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { redirect: boolean; url: string };
    const providerURL = new URL(body.url);

    expect(body.redirect).toBe(true);
    expect(providerURL.searchParams.get('redirect_uri')).toBe('http://example.test/api/auth/callback/google');
    expect(providerURL.searchParams.get('state')).toBeTruthy();

    const storedStates = await env.DB.prepare('SELECT COUNT(*) AS count FROM verification').first<{ count: number }>();
    expect(storedStates?.count).toBe(1);
  });

  it.each(['https://acromion.org', 'https://learn.acromion.org'])(
    'uses the fixed Google callback and accepts %s as the final-session host',
    async origin => {
      const response = await SELF.fetch(`${origin}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ provider: 'google', callbackURL: '/pricing' }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as { redirect: boolean; url: string };
      expect(new URL(body.url).searchParams.get('redirect_uri'))
        .toBe('http://example.test/api/auth/callback/google');
    },
  );
});
