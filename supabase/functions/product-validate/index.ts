// Applies an admin validation decision (approve / reject / request changes) to a
// batch of products (all the STRAW products of a bull, or a single supply) and
// notifies the seller by email. Uses the service_role key (never in the frontend
// bundle) to update the rows and to read the seller's email across tenants.
//
// Deploy with: supabase functions deploy product-validate
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  productApproved,
  productChangesRequested,
  productRejected,
  sendEmail,
} from '../_shared/send-email.ts';

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

function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized));
}

function firstName(full: string | null | undefined): string {
  const name = (full ?? '').trim();
  return name ? name.split(' ')[0] : 'ganadero';
}

type Decision = 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

interface Body {
  productIds?: string[];
  decision?: Decision;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'UNAUTHORIZED' }, 401);

  // The JWT signature/expiry is verified by the runtime (verify_jwt) before this runs.
  let claims: Record<string, unknown>;
  try {
    claims = decodeJwtClaims(token);
  } catch {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const role = claims['user_role'];
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return json({ error: 'FORBIDDEN' }, 403);

  const body = (await req.json().catch(() => null)) as Body | null;
  const productIds = body?.productIds ?? [];
  const decision = body?.decision;
  const notes = (body?.notes ?? '').trim();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return json({ error: 'INVALID_BODY' }, 400);
  }
  if (decision !== 'APPROVED' && decision !== 'REJECTED' && decision !== 'CHANGES_REQUESTED') {
    return json({ error: 'INVALID_DECISION' }, 400);
  }
  if ((decision === 'REJECTED' || decision === 'CHANGES_REQUESTED') && !notes) {
    return json({ error: 'NOTES_REQUIRED' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Fetch the target products (for display name + tenant) before updating.
  const { data: products, error: fetchErr } = await admin
    .from('products')
    .select('id, name, bull_id, tenant_id, bulls(name)')
    .in('id', productIds);
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!products || products.length === 0) return json({ error: 'NOT_FOUND' }, 404);

  // Apply the decision.
  const patch =
    decision === 'APPROVED'
      ? { status: 'ACTIVE', validation_notes: null }
      : decision === 'REJECTED'
        ? { status: 'REJECTED', validation_notes: notes }
        : { status: 'CHANGES_REQUESTED', validation_notes: notes };

  const { error: updErr } = await admin.from('products').update(patch).in('id', productIds);
  if (updErr) return json({ error: updErr.message }, 500);

  // Best-effort seller email — never fail the decision on email issues.
  try {
    const first = products[0] as {
      name: string;
      bull_id: string | null;
      tenant_id: string;
      bulls: { name: string } | null;
    };
    const sameBull = first.bull_id && products.every((p) => (p as { bull_id: string | null }).bull_id === first.bull_id);
    const itemName = sameBull ? first.bulls?.name ?? first.name : first.name;

    const { data: seller } = await admin
      .from('seller_profiles')
      .select('profiles(email, full_name)')
      .eq('id', first.tenant_id)
      .single();
    const profile = (seller as { profiles: { email: string; full_name: string | null } | null } | null)?.profiles;

    if (profile?.email) {
      const name = firstName(profile.full_name);
      const mail =
        decision === 'APPROVED'
          ? productApproved(name, itemName)
          : decision === 'REJECTED'
            ? productRejected(name, itemName, notes)
            : productChangesRequested(name, itemName, notes);
      await sendEmail(profile.email, mail.subject, mail.html);
    }
  } catch (e) {
    console.error('product-validate email failed:', e instanceof Error ? e.message : e);
  }

  return json({ ok: true }, 200);
});
