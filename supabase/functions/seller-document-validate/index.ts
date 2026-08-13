// Applies an admin review decision (approve / reject) to one seller legal
// document and, on approval, recomputes the seller's verification status:
// once both required document types (RUT, LEGAL_REP) are APPROVED, the
// seller's PENDING profile flips to ACTIVE, which is what unlocks direct
// product publishing (see enforce_product_publish_gate in migration 0023).
// Uses the service_role key (never in the frontend bundle) to update the
// rows and to read the seller's email, and notifies the seller by email.
//
// Deploy with: supabase functions deploy seller-document-validate
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sellerDocumentRejected, sellerVerified, sendEmail } from '../_shared/send-email.ts';

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

const REQUIRED_DOC_TYPES = ['RUT', 'LEGAL_REP'] as const;

const DOC_LABELS: Record<string, string> = {
  RUT: 'RUT',
  LEGAL_REP: 'Certificado de representación legal',
};

type Decision = 'APPROVED' | 'REJECTED';

interface Body {
  documentId?: string;
  decision?: Decision;
  reason?: string;
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
  const documentId = body?.documentId;
  const decision = body?.decision;
  const reason = (body?.reason ?? '').trim();

  if (!documentId) return json({ error: 'INVALID_BODY' }, 400);
  if (decision !== 'APPROVED' && decision !== 'REJECTED') return json({ error: 'INVALID_DECISION' }, 400);
  if (decision === 'REJECTED' && !reason) return json({ error: 'REASON_REQUIRED' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: document, error: fetchErr } = await admin
    .from('seller_documents')
    .select('id, seller_id, doc_type')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!document) return json({ error: 'NOT_FOUND' }, 404);

  const patch =
    decision === 'APPROVED'
      ? { status: 'APPROVED', rejection_reason: null }
      : { status: 'REJECTED', rejection_reason: reason };

  const { error: updErr } = await admin.from('seller_documents').update(patch).eq('id', documentId);
  if (updErr) return json({ error: updErr.message }, 500);

  let justVerified = false;
  if (decision === 'APPROVED') {
    const { data: sellerDocs, error: docsErr } = await admin
      .from('seller_documents')
      .select('doc_type, status')
      .eq('seller_id', document.seller_id);
    if (docsErr) return json({ error: docsErr.message }, 500);

    const approvedTypes = new Set(
      (sellerDocs ?? []).filter((d) => d.status === 'APPROVED').map((d) => d.doc_type),
    );
    const allRequiredApproved = REQUIRED_DOC_TYPES.every((t) => approvedTypes.has(t));

    if (allRequiredApproved) {
      const { data: seller, error: sellerErr } = await admin
        .from('seller_profiles')
        .select('status')
        .eq('id', document.seller_id)
        .single();
      if (sellerErr) return json({ error: sellerErr.message }, 500);

      // Only promote out of PENDING — never override an admin-set SUSPENDED.
      if ((seller as { status: string }).status === 'PENDING') {
        const { error: verifyErr } = await admin
          .from('seller_profiles')
          .update({ status: 'ACTIVE' })
          .eq('id', document.seller_id);
        if (verifyErr) return json({ error: verifyErr.message }, 500);
        justVerified = true;
      }
    }
  }

  // Best-effort seller email — never fail the decision on email issues.
  try {
    const { data: seller } = await admin
      .from('seller_profiles')
      .select('profiles(email, full_name)')
      .eq('id', document.seller_id)
      .single();
    const profile = (seller as { profiles: { email: string; full_name: string | null } | null } | null)
      ?.profiles;

    if (profile?.email) {
      const name = firstName(profile.full_name);
      if (justVerified) {
        const mail = sellerVerified(name);
        await sendEmail(profile.email, mail.subject, mail.html);
      } else if (decision === 'REJECTED') {
        const label = DOC_LABELS[document.doc_type as string] ?? document.doc_type;
        const mail = sellerDocumentRejected(name, label, reason);
        await sendEmail(profile.email, mail.subject, mail.html);
      }
    }
  } catch (e) {
    console.error('seller-document-validate email failed:', e instanceof Error ? e.message : e);
  }

  return json({ ok: true, sellerVerified: justVerified }, 200);
});
