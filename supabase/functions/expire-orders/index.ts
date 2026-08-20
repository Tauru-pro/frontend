// Scheduled (pg_cron -> pg_net, or an external scheduler) sweep that expires
// stale unpaid orders (proposal §32). Deployed with default JWT
// verification — invoke with the service_role key as the bearer token (the
// same key pg_net/an external scheduler is configured with), never exposed
// to the browser. Batches to avoid one giant transaction if the backlog is
// large; expire_order() itself only touches orders still PENDING_PAYMENT or
// PAYMENT_PROCESSING (the resting state for an abandoned checkout — see
// migration 0039) with expires_at in the past, so it never expires an
// already-APPROVED order (design.md — orders/payments guard triggers +
// expire_order's own WHERE).
//
// Deploy with: supabase functions deploy expire-orders
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { expireOrder } from '../_shared/order-transitions.ts';

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: staleOrders, error } = await admin
    .from('orders')
    .select('id')
    .in('status', ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'])
    .lt('expires_at', new Date().toISOString())
    .limit(BATCH_SIZE);

  if (error) {
    console.error('expire-orders: failed to list stale orders:', error.message);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 });
  }

  let expiredCount = 0;
  for (const order of staleOrders ?? []) {
    try {
      const applied = await expireOrder(admin, order.id as string);
      if (applied) expiredCount++;
    } catch (e) {
      console.error(`expire-orders: failed to expire order ${order.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ ok: true, scanned: staleOrders?.length ?? 0, expired: expiredCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
