// Applies email configuration to the Supabase project via the Management API:
// branded Auth templates (Confirm signup with {{ .Token }}, Invite), site_url,
// and — when RESEND_API_KEY/EMAIL_FROM are set — Resend SMTP for delivery.
//
// Run: set -a; source ./supabase.env; set +a; npx tsx scripts/apply-email-config.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tpl = (name: string) => readFileSync(join(here, '..', 'supabase', 'email-templates', name), 'utf8');

async function main() {
  const ref = process.env['PROJECT_REF'];
  const token = process.env['SUPABASE_ACCESS_TOKEN'];
  const resendKey = process.env['RESEND_API_KEY'];
  const from = process.env['EMAIL_FROM'];
  const appUrl = (process.env['EMAIL_APP_URL'] ?? 'http://localhost:4200').replace(/\/+$/, '');
  if (!ref || !token) {
    console.error('Faltan PROJECT_REF / SUPABASE_ACCESS_TOKEN (source ./supabase.env)');
    process.exit(1);
  }

  // Keep localhost allowed too, so local set-password/recovery redirects work.
  const allow = [...new Set([`${appUrl}/**`, 'http://localhost:4200/**'])].join(',');

  const body: Record<string, unknown> = {
    site_url: appUrl,
    uri_allow_list: allow,
    mailer_subjects_confirmation: 'Tu código de verificación · Tauru Market',
    mailer_templates_confirmation_content: tpl('confirm-signup.html'),
    mailer_subjects_invite: 'Te invitaron como proveedor · Tauru Market',
    mailer_templates_invite_content: tpl('invite.html'),
  };

  if (resendKey && from) {
    Object.assign(body, {
      external_email_enabled: true,
      smtp_host: 'smtp.resend.com',
      smtp_port: '465',
      smtp_user: 'resend',
      smtp_pass: resendKey,
      smtp_admin_email: from,
      smtp_sender_name: 'Tauru Market',
      rate_limit_email_sent: 30,
    });
    console.log('· incluyendo SMTP de Resend (' + from + ')');
  } else {
    console.log('· RESEND_API_KEY/EMAIL_FROM ausentes → aplico plantillas + site_url, SIN SMTP todavía');
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error('PATCH falló', res.status, txt.slice(0, 500));
    process.exit(1);
  }
  const j = JSON.parse(txt);
  const usesToken = /\{\{\s*\.Token\s*\}\}/.test(j.mailer_templates_confirmation_content || '');
  console.log('OK →  smtp_host:', j.smtp_host, '| site_url:', j.site_url, '| confirmation usa Token:', usesToken);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
