// One-off script to provision the default SUPER_ADMIN account. Lives
// outside src/ so the Angular build never bundles it or its service_role
// usage.
//
// Run with: npm run seed:super-admin
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SEED_SUPER_ADMIN_EMAIL (SEED_SUPER_ADMIN_FULL_NAME, SEED_FRONTEND_URL are optional).
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const email = process.env['SEED_SUPER_ADMIN_EMAIL'];
  const fullName = process.env['SEED_SUPER_ADMIN_FULL_NAME'] ?? 'Super Admin';
  const frontendUrl = process.env['SEED_FRONTEND_URL'] ?? 'http://localhost:4200';

  if (!supabaseUrl || !serviceRoleKey || !email) {
    console.error(
      'Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_SUPER_ADMIN_EMAIL'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Without redirectTo, the invite email sends the user to site_url (the
  // public home page) with no chance to set a password.
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: 'SUPER_ADMIN' },
    redirectTo: `${frontendUrl}/auth/set-password`,
  });

  if (inviteError) {
    console.error('Failed to invite default SUPER_ADMIN:', inviteError.message);
    process.exit(1);
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'SUPER_ADMIN' })
    .eq('id', invited.user.id);

  if (updateError) {
    console.error('Invited the user but failed to set their role:', updateError.message);
    process.exit(1);
  }

  console.log(`SUPER_ADMIN provisioned: ${email} (${invited.user.id})`);
}

main();
