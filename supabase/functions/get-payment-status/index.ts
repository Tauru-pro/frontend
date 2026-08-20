// Buyer-facing status read, used by the /checkout/result page while it
// waits for the webhook to land (proposal §21 — the widget/redirect is UX
// only, this is what actually reflects backend-confirmed state). anon key +
// forwarded Authorization header, so RLS scopes the read to the caller's
// own order. POST + JSON body (not GET + query param) so the frontend can
// call it with the same `supabase.functions.invoke(name, { body })` pattern
// used by every other function in this change.
//
// Deploy with: supabase functions deploy get-payment-status
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

  const body = (await req.json().catch(() => null)) as Body | null;
  const orderId = body?.orderId;
  if (!orderId) return json({ error: 'MISSING_ORDER_ID' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, status, total, currency, paid_at, payments(id, status, payment_method, failure_reason, approved_at)',
    )
    .eq('id', orderId)
    .single();

  if (error || !data) return json({ error: 'NOT_FOUND' }, 404);

  return json({
    orderId: data.id,
    orderStatus: data.status,
    total: data.total,
    currency: data.currency,
    paidAt: data.paid_at,
    payments: data.payments,
  });
});
