export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MIDTRANS?: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  MIDTRANS_SERVER_KEY: string;
  MIDTRANS_CLIENT_KEY: string;
  MIDTRANS_IS_PRODUCTION?: string;
  ENVIRONMENT?: string;
  TEST_AUTH_SECRET?: string;
}
