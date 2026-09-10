import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Account } from '../../src/pages/Account';
import { ThemeProvider } from '../../src/components/theme-provider';
import type { Payment } from '../../src/types/payment';

const api = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../src/lib/api', () => ({ paymentsApi: api }));
vi.mock('../../src/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

const activePayment: Payment = {
  id: 'payment-1', orderId: 'order-1', productCode: 'pro-pass-30d', amount: 15_000,
  currency: 'IDR', entitlementDays: 30, status: 'succeeded', providerStatus: 'settlement',
  transactionId: null, paymentType: null, fraudStatus: null, snapToken: null, redirectUrl: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: new Date().toISOString(),
};

describe('Account', () => {
  it('shows Pro access when an active payment entitlement exists for a free-tier user', async () => {
    api.list.mockResolvedValue({ payments: [activePayment] });

    render(
      <MemoryRouter>
        <ThemeProvider defaultTheme="light">
          <Account user={{ id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'user', tier: 'free' }} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Pro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage plan/i })).toBeInTheDocument();
  });
});
