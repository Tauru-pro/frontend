// Seller-facing order list/detail (read-only). Both modes go through
// security-definer RPCs (get_seller_orders / get_seller_order_detail,
// migration 0046) that resolve the caller's seller_profiles.id from
// auth.uid() server-side — this function only forwards the caller's own
// JWT (anon key + forwarded Authorization header, same pattern as
// create-checkout), so auth.uid() resolves correctly inside the RPCs.
//
// POST body with no orderId -> list mode (get_seller_orders with
// filter/pagination params). POST body with orderId -> detail mode
// (get_seller_order_detail). Detail always responds 200 with `{ data: null }`
// when the caller has no items on that order — same response whether the
// order doesn't exist or belongs entirely to other sellers, so nothing about
// the order's existence leaks.
//
// Deploy with: supabase functions deploy seller-orders
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
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function logRpcError(
  fn: string,
  error: { message: string; code?: string; details?: string; hint?: string },
): void {
  console.error(`seller-orders: ${fn} failed:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      },
    );

    if (body?.orderId) {
      const { data, error } = await supabase.rpc('get_seller_order_detail', {
        p_order_id: body.orderId,
      });
      if (error) {
        logRpcError('get_seller_order_detail', error);
        return json({ error: 'INTERNAL_ERROR' }, 500);
      }
      return json({ data: data ?? null });
    }

    const { data, error } = await supabase.rpc('get_seller_orders', {
      p_status: body?.status ?? null,
      p_payment_status: body?.paymentStatus ?? null,
      p_date_from: body?.dateFrom ?? null,
      p_date_to: body?.dateTo ?? null,
      p_search: body?.search ?? null,
      p_page: body?.page ?? 1,
      p_page_size: body?.pageSize ?? 20,
    });

    if (error) {
      logRpcError('get_seller_orders', error);
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }

    return json(data);
  } catch (e) {
    console.error(
      'seller-orders: unhandled error:',
      e instanceof Error ? (e.stack ?? e.message) : e,
    );
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
