// Retries payment on an order stuck in PAYMENT_FAILED (proposal §31). The
// atomic transaction (new payment_attempts row, payments reset, orders back
// to PAYMENT_PROCESSING) lives in retry_payment() (migration 0038); this
// function forwards the caller's own JWT and computes a fresh integrity
// signature, mirroring create-checkout's response shape so the frontend can
// reuse the same "open the Wompi Widget" code path.
//
// Deploy with: supabase functions deploy retry-payment
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { toCents } from '../_shared/money.ts';
import { buildIntegritySignature } from '../_shared/wompi-signature.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Body {
  orderId?: string;
}

interface RetryPaymentRpcRow {
  payment_id: string;
  reference: string;
  currency: string;
  total: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    const orderId = body?.orderId;
    if (!orderId) return json({ error: 'MISSING_ORDER_ID' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await supabase.rpc('retry_payment', { p_order_id: orderId }).single<RetryPaymentRpcRow>();

    if (error) {
      const message = error.message ?? '';
      if (message.includes('UNAUTHENTICATED')) return json({ error: 'UNAUTHORIZED' }, 401);
      if (message.includes('ORDER_NOT_FOUND')) return json({ error: 'ORDER_NOT_FOUND' }, 404);
      if (message.includes('ORDER_NOT_RETRYABLE') || message.includes('PAYMENT_NOT_RETRYABLE')) {
        return json({ error: 'NOT_RETRYABLE', detail: message }, 409);
      }
      // Anything else is an unanticipated Postgres/RPC error — log
      // everything Postgres gives us (code/details/hint carry the real
      // cause, e.g. a constraint violation) rather than just `message`, so
      // the next failure is diagnosable from the Logs tab without guessing.
      console.error('retry-payment: retry_payment failed:', {
        message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      });
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }
    if (!data) {
      console.error('retry-payment: retry_payment returned no data and no error (unexpected)');
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }

    const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY');
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET');
    const appUrl = (Deno.env.get('EMAIL_APP_URL') ?? 'http://localhost:4200').replace(/\/+$/, '');
    if (!publicKey || !integritySecret) {
      console.error('retry-payment: WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET not configured');
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }

    const amountInCents = toCents(data.total);
    const integritySignature = await buildIntegritySignature(
      data.reference,
      amountInCents,
      data.currency,
      integritySecret,
    );

    return json({
      orderId,
      paymentId: data.payment_id,
      reference: data.reference,
      currency: data.currency,
      amountInCents,
      publicKey,
      integritySignature,
      redirectUrl: `${appUrl}/checkout/result?orderId=${orderId}`,
    });
  } catch (e) {
    console.error('retry-payment: unhandled error:', e instanceof Error ? (e.stack ?? e.message) : e);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
