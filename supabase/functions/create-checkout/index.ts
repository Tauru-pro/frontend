// Buyer-facing checkout initiation. The heavy lifting (idempotency,
// pricing, stock, order/payment persistence) happens inside the
// create_order_with_items() Postgres function (migration 0037) — this
// function only forwards the caller's own JWT (so auth.uid() resolves
// inside that RPC to the real buyer, never a client-supplied id), then
// computes the Wompi integrity signature, which must stay server-side
// (design.md Decision 4 / proposal §17-18).
//
// Deploy with: supabase functions deploy create-checkout
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

interface CartItem {
  productId: string;
  quantity: number;
}

interface Body {
  idempotencyKey?: string;
  pickupPointId?: string;
  items?: CartItem[];
  buyerFullName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  notes?: string;
}

interface CreateOrderRpcRow {
  order_id: string;
  payment_id: string;
  reference: string;
  currency: string;
  total: number;
  is_existing: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

  const body = (await req.json().catch(() => null)) as Body | null;
  const idempotencyKey = (body?.idempotencyKey ?? '').trim();
  const pickupPointId = body?.pickupPointId;
  const items = body?.items ?? [];
  const buyerFullName = (body?.buyerFullName ?? '').trim();
  const buyerEmail = (body?.buyerEmail ?? '').trim();

  if (!idempotencyKey) return json({ error: 'MISSING_IDEMPOTENCY_KEY' }, 400);
  if (!pickupPointId) return json({ error: 'MISSING_PICKUP_POINT' }, 400);
  if (!Array.isArray(items) || items.length === 0) return json({ error: 'EMPTY_CART' }, 400);
  if (!buyerFullName || !buyerEmail) return json({ error: 'MISSING_BUYER_INFO' }, 400);

  // anon key + the caller's own Authorization header forwarded, so RLS and
  // auth.uid() inside create_order_with_items() resolve to the real buyer —
  // never a service-role client for this buyer-facing function.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const rpcItems = items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));

  const { data, error } = await supabase
    .rpc('create_order_with_items', {
      p_idempotency_key: idempotencyKey,
      p_pickup_point_id: pickupPointId,
      p_items: rpcItems,
      p_buyer_full_name: buyerFullName,
      p_buyer_email: buyerEmail,
      p_buyer_phone: body?.buyerPhone ?? null,
      p_buyer_address: body?.buyerAddress ?? null,
      p_notes: body?.notes ?? null,
    })
    .single<CreateOrderRpcRow>();

  if (error) {
    const message = error.message ?? '';
    if (message.includes('UNAUTHENTICATED')) return json({ error: 'UNAUTHORIZED' }, 401);
    if (message.includes('PRODUCT_NOT_FOUND') || message.includes('PRODUCT_UNAVAILABLE')) {
      return json({ error: 'PRODUCT_UNAVAILABLE', detail: message }, 409);
    }
    if (message.includes('INSUFFICIENT_STOCK')) return json({ error: 'INSUFFICIENT_STOCK', detail: message }, 409);
    if (message.includes('EMPTY_CART') || message.includes('INVALID_QUANTITY')) {
      return json({ error: 'INVALID_CART', detail: message }, 400);
    }
    console.error('create-checkout: create_order_with_items failed:', message);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }

  if (!data) return json({ error: 'INTERNAL_ERROR' }, 500);

  const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY');
  const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET');
  const appUrl = (Deno.env.get('EMAIL_APP_URL') ?? 'http://localhost:4200').replace(/\/+$/, '');
  if (!publicKey || !integritySecret) {
    console.error('create-checkout: WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET not configured');
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
    orderId: data.order_id,
    paymentId: data.payment_id,
    reference: data.reference,
    currency: data.currency,
    amountInCents,
    publicKey,
    integritySignature,
    redirectUrl: `${appUrl}/checkout/result?orderId=${data.order_id}`,
  });
});
