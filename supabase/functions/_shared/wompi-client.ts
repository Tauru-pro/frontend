// Thin wrapper around the Wompi transactions API, used by reconcile-payments
// (and available to wompi-webhook) to look up the authoritative state of a
// transaction directly from Wompi instead of trusting only the webhook
// payload (proposal §24/§45 — the webhook is not trusted blindly).

export type WompiTransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export interface WompiTransaction {
  id: string;
  amount_in_cents: number;
  reference: string;
  currency: string;
  status: WompiTransactionStatus;
  status_message: string | null;
  payment_method_type: string | null;
  created_at: string;
  finalized_at: string | null;
}

interface WompiTransactionResponse {
  data: WompiTransaction;
}

function apiUrl(): string {
  const url = Deno.env.get('WOMPI_API_URL');
  if (!url) throw new Error('WOMPI_API_URL is not configured');
  return url.replace(/\/+$/, '');
}

export async function getTransaction(transactionId: string): Promise<WompiTransaction> {
  const res = await fetch(`${apiUrl()}/v1/transactions/${transactionId}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Wompi getTransaction failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as WompiTransactionResponse;
  return json.data;
}
