// Scheduled reconciliation: safety net for a lost/failed webhook delivery
// (proposal §24/§45). Finds payments stuck CREATED/PENDING past a threshold
// that already have a provider_transaction_id (i.e. Wompi has told us about
// them at least once via a prior webhook), asks Wompi directly for the
// current transaction state, and applies the exact same amount/reference/
// currency-validated transition the webhook path uses — never a bare
// "trust Wompi's status" shortcut. A payment that never received any
// webhook (no provider_transaction_id yet) is left for the next pass, or
// for expire-orders once its order's expires_at passes.
//
// Deploy with: supabase functions deploy reconcile-payments
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getTransaction } from '../_shared/wompi-client.ts';
import { applyApprovedPayment, applyDeclinedOrErrorPayment } from '../_shared/order-transitions.ts';

const STALE_MINUTES = 15;
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  const { data: stuck, error } = await admin
    .from('payments')
    .select('id, order_id, provider_transaction_id, reference:provider_reference, orders!inner(id, total)')
    .in('status', ['CREATED', 'PENDING'])
    .not('provider_transaction_id', 'is', null)
    .lt('updated_at', staleBefore)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('reconcile-payments: failed to list stuck payments:', error.message);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 });
  }

  let reconciledCount = 0;
  for (const row of stuck ?? []) {
    const payment = row as unknown as {
      id: string;
      order_id: string;
      provider_transaction_id: string;
      reference: string;
      orders: { id: string; total: number };
    };

    try {
      const txn = await getTransaction(payment.provider_transaction_id);

      if (txn.reference !== payment.reference) {
        console.warn(`reconcile-payments: reference mismatch for payment ${payment.id}, skipping`);
        continue;
      }
      if (txn.amount_in_cents !== payment.orders.total * 100 || txn.currency !== 'COP') {
        console.warn(`reconcile-payments: amount/currency mismatch for payment ${payment.id}, skipping`);
        continue;
      }

      if (txn.status === 'APPROVED') {
        const applied = await applyApprovedPayment(admin, {
          paymentId: payment.id,
          orderId: payment.order_id,
          providerTransactionId: txn.id,
          rawResponse: txn,
        });
        if (applied) reconciledCount++;
      } else if (txn.status === 'DECLINED' || txn.status === 'ERROR' || txn.status === 'VOIDED') {
        const applied = await applyDeclinedOrErrorPayment(admin, {
          paymentId: payment.id,
          orderId: payment.order_id,
          status: txn.status,
          providerTransactionId: txn.id,
          failureReason: txn.status_message ?? null,
          rawResponse: txn,
        });
        if (applied) reconciledCount++;
      }
      // PENDING: still pending at Wompi too — nothing to reconcile yet.
    } catch (e) {
      console.error(`reconcile-payments: failed for payment ${payment.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned: stuck?.length ?? 0, reconciled: reconciledCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
