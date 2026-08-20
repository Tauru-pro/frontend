// Thin wrapper around the atomic RPC functions defined in migration 0036
// (design.md Decision 4b). Edge Functions call these instead of issuing raw
// `payments`/`orders` table updates, so the payment+order transition (and,
// for failures/expiry, the stock restore) always happens in one Postgres
// transaction.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export async function applyApprovedPayment(
  admin: SupabaseClient,
  args: { paymentId: string; orderId: string; providerTransactionId: string | null; rawResponse: unknown },
): Promise<boolean> {
  const { data, error } = await admin.rpc('apply_payment_approved', {
    p_payment_id: args.paymentId,
    p_order_id: args.orderId,
    p_provider_transaction_id: args.providerTransactionId,
    p_raw_response: args.rawResponse,
  });
  if (error) throw new Error(`apply_payment_approved failed: ${error.message}`);
  return data === true;
}

export async function applyDeclinedOrErrorPayment(
  admin: SupabaseClient,
  args: {
    paymentId: string;
    orderId: string;
    status: 'DECLINED' | 'ERROR' | 'VOIDED';
    providerTransactionId: string | null;
    failureReason: string | null;
    rawResponse: unknown;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc('apply_payment_failed', {
    p_payment_id: args.paymentId,
    p_order_id: args.orderId,
    p_status: args.status,
    p_provider_transaction_id: args.providerTransactionId,
    p_failure_reason: args.failureReason,
    p_raw_response: args.rawResponse,
  });
  if (error) throw new Error(`apply_payment_failed failed: ${error.message}`);
  return data === true;
}

export async function expireOrder(admin: SupabaseClient, orderId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('expire_order', { p_order_id: orderId });
  if (error) throw new Error(`expire_order failed: ${error.message}`);
  return data === true;
}
