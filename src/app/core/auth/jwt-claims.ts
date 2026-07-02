import type { SupabaseClient } from '@supabase/supabase-js';

// Decodes the current session's JWT to read a custom claim injected by
// custom_access_token_hook (e.g. tenant_id). Safe to decode client-side
// without re-verifying: the token's signature was already verified by
// Supabase when the session was established/refreshed.
export async function getJwtClaim(
  supabase: SupabaseClient,
  claim: string
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const payload = token.split('.')[1] ?? '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(normalized)) as Record<string, unknown>;
  return (claims[claim] as string | undefined) ?? null;
}
