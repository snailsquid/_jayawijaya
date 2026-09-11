import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pricing } from '../../src/pages/Pricing';
import { ThemeProvider } from '../../src/components/theme-provider';
import type { Payment, PaymentProduct } from '../../src/types/payment';

const mocks = vi.hoisted(() => ({
  list: vi.fn(), create: vi.fn(), get: vi.fn(), cancel: vi.fn(), loadSnap: vi.fn(), pay: vi.fn(),
}));

vi.mock('../../src/lib/api', () => ({
  paymentsApi: { list: mocks.list, create: mocks.create, get: mocks.get, cancel: mocks.cancel },
}));
vi.mock('../../src/lib/snap', () => ({ loadSnap: mocks.loadSnap }));

const product: PaymentProduct = {
  code: 'acromion-lifetime', name: 'Acromion — lifetime', plan: 'Acromion', amount: 30_000,
  currency: 'IDR', entitlementDays: null, duration: { unit: 'lifetime', value: null },
  benefits: ['200 modules', 'Live module creation'],
  pricing: { type: 'flexible', minimumAmount: 30_000, maximumAmount: 10_000_000 },
};

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1', orderId: 'order-1', productCode: product.code, amount: 40_000,
  currency: 'IDR', entitlementDays: null, status: 'pending', providerStatus: 'pending',
  transactionId: null, paymentType: null, fraudStatus: null, snapToken: 'snap-token', redirectUrl: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), verifiedAt: null,
  ...overrides,
});

const response = (payments: Payment[] = [], entitlement: { plan: 'Acromion'; startsAt: string; expiresAt: null } | null = null) => ({
  payments, products: [product], entitlement,
  config: { clientKey: 'client-key', snapJsUrl: 'https://example.test/snap.js' },
});

function renderPricing() {
  return render(<MemoryRouter><ThemeProvider defaultTheme="light"><Pricing /></ThemeProvider></MemoryRouter>);
}

describe('Acromion pricing', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue(response());
    mocks.loadSnap.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue({ payment: payment(), config: response().config });
    window.snap = { pay: mocks.pay };
  });

  it('shows only a price-free Acromion card and submits a preset amount from the modal', async () => {
    const user = userEvent.setup();
    renderPricing();

    expect(await screen.findByText('Acromion')).toBeInTheDocument();
    expect(screen.queryByText('Basic')).not.toBeInTheDocument();
    expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    expect(screen.queryByText('Rp30.000')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose plan' }));
    await user.click(screen.getByLabelText(/40\.000/));
    await user.click(screen.getByRole('button', { name: /Pay.*40\.000/ }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('acromion-lifetime', 40_000));
    expect(mocks.pay).toHaveBeenCalled();
  });

  it('validates custom amounts and permits another contribution with lifetime access active', async () => {
    mocks.list.mockResolvedValue(response([], { plan: 'Acromion', startsAt: new Date().toISOString(), expiresAt: null }));
    const user = userEvent.setup();
    renderPricing();

    expect(await screen.findByText('Acromion is active')).toBeInTheDocument();
    const choose = screen.getByRole('button', { name: 'Choose plan' });
    expect(choose).toBeEnabled();
    await user.click(choose);
    await user.click(screen.getByLabelText('Custom amount'));
    const input = screen.getByLabelText('Custom contribution amount');
    await user.type(input, '29999');
    expect(screen.getByText(/whole-rupiah amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay/ })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '10000000');
    expect(screen.getByRole('button', { name: /Pay.*10\.000\.000/ })).toBeEnabled();
  });

  it('resumes an existing Acromion payment at its original amount', async () => {
    mocks.list.mockResolvedValue(response([payment()]));
    const user = userEvent.setup();
    renderPricing();

    await user.click(await screen.findByRole('button', { name: 'Resume payment' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith('acromion-lifetime', 40_000));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
