import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const migrations = await readD1Migrations(resolve(import.meta.dirname, 'migrations'));

export default defineConfig({
  plugins: [cloudflareTest({
    main: './worker/index.ts',
    miniflare: {
      compatibilityDate: '2026-08-22',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: {
        ENVIRONMENT: 'test',
        BETTER_AUTH_URL: 'http://example.test',
        BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        GOOGLE_CLIENT_ID: 'test-google-id',
        GOOGLE_CLIENT_SECRET: 'test-google-secret',
        TEST_MIGRATIONS: migrations,
      },
      serviceBindings: {
        ASSETS: () => new Response('asset'),
      },
    },
  })],
  test: { include: ['tests/integration/**/*.test.ts'] },
});
