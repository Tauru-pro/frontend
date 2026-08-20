// The only path to update_order_fulfillment_status (migration 0047) from
// the client — order_seller_fulfillments has no client-facing write RLS
// policy at all, so this Edge Function (forwarding the caller's own JWT,
// same anon-key + forwarded-Authorization pattern as create-checkout /
// retry-payment) is what actually performs the transition.
//
// Deploy with: supabase functions deploy seller-orders-fulfillment
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
  status?: string;
  reason?: string;
}

const VALID_STATUSES = ['PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    const orderId = body?.orderId;
    const status = body?.status;
    const reason = body?.reason?.trim() || null;

    if (!orderId) return json({ error: 'MISSING_ORDER_ID' }, 400);
    if (!status || !VALID_STATUSES.includes(status)) return json({ error: 'INVALID_STATUS' }, 400);
    if (status === 'CANCELLED' && !reason) return json({ error: 'REASON_REQUIRED' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    const { data, error } = await supabase.rpc('update_order_fulfillment_status', {
      p_order_id: orderId,
      p_new_status: status,
      p_reason: reason,
    });

    if (error) {
      const message = error.message ?? '';
      if (message.includes('UNAUTHENTICATED')) return json({ error: 'UNAUTHORIZED' }, 401);
      if (message.includes('FULFILLMENT_NOT_FOUND')) return json({ error: 'NOT_FOUND' }, 404);
      if (message.includes('REASON_REQUIRED')) return json({ error: 'REASON_REQUIRED' }, 400);
      if (message.includes('INVALID_STATUS')) return json({ error: 'INVALID_STATUS' }, 400);
      // Anything else is an unanticipated Postgres/RPC error — log
      // code/details/hint (not just message), same defensive pattern as
      // retry-payment, so the next failure is diagnosable from the Logs tab.
      console.error('seller-orders-fulfillment: update_order_fulfillment_status failed:', {
        message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      });
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }

    if (data !== true) return json({ error: 'CONFLICT' }, 409);

    return json({ ok: true });
  } catch (e) {
    console.error(
      'seller-orders-fulfillment: unhandled error:',
      e instanceof Error ? (e.stack ?? e.message) : e,
    );
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
