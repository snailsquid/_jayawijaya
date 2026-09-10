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
        OAUTH_PROXY_SECRET: 'test-oauth-proxy-secret-at-least-32-characters',
        OAUTH_PROXY_TRUSTED_ORIGINS: 'http://preview.example.test',
        GOOGLE_CLIENT_ID: 'test-google-id',
        GOOGLE_CLIENT_SECRET: 'test-google-secret',
        MIDTRANS_SERVER_KEY: 'test-midtrans-server-key',
        MIDTRANS_CLIENT_KEY: 'test-midtrans-client-key',
        MIDTRANS_IS_PRODUCTION: 'false',
        TEST_MIGRATIONS: migrations,
      },
      serviceBindings: {
        ASSETS: () => new Response('asset'),
        MIDTRANS: (request: Request) => {
          const url = new URL(request.url);
          if (url.pathname === '/snap/v1/transactions' && request.method === 'POST') {
            return Response.json({ token: 'snap-token', redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token' }, { status: 201 });
          }
          const statusMatch = url.pathname.match(/^\/v2\/([^/]+)\/status$/);
          if (statusMatch && request.method === 'GET') {
            return Response.json({
              order_id: decodeURIComponent(statusMatch[1]),
              status_code: '200',
              gross_amount: '30000.00',
              currency: 'IDR',
              transaction_status: 'settlement',
              transaction_id: 'midtrans-transaction',
              payment_type: 'qris',
              fraud_status: 'accept',
            });
          }
          const cancelMatch = url.pathname.match(/^\/v2\/([^/]+)\/cancel$/);
          if (cancelMatch && request.method === 'POST') {
            return Response.json({
              order_id: decodeURIComponent(cancelMatch[1]), status_code: '200', gross_amount: '30000.00', currency: 'IDR',
              transaction_status: 'cancel', transaction_id: 'midtrans-transaction', payment_type: 'qris', fraud_status: 'accept',
            });
          }
          return Response.json({ status_message: 'Unmocked Midtrans request' }, { status: 500 });
        },
      },
    },
  })],
  test: { include: ['tests/integration/**/*.test.ts'], fileParallelism: false },
});
