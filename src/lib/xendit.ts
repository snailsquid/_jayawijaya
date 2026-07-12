const XENDIT_API = 'https://api.xendit.co/v2/invoices';

export interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl: string;
}

export interface XenditInvoice {
  id: string;
  external_id: string;
  amount: number;
  status: string;
  invoice_url: string;
}

export async function createInvoice(
  apiKey: string,
  params: CreateInvoiceParams,
): Promise<XenditInvoice> {
  const body = new URLSearchParams();
  body.append('external_id', params.externalId);
  body.append('amount', String(params.amount));
  body.append('currency', 'IDR');
  body.append('payer_email', params.payerEmail);
  body.append('description', params.description);
  body.append('success_redirect_url', params.successRedirectUrl);
  body.append('should_send_email', 'true');

  const res = await fetch(XENDIT_API, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Failed to create invoice');
  }

  return res.json();
}
