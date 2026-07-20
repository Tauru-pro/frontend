// Shared transactional-email helper for Edge Functions. Sends via the Resend
// HTTP API (Supabase's SMTP only covers Auth emails). Requires the secrets
// RESEND_API_KEY and EMAIL_FROM; EMAIL_APP_URL is optional (defaults to :4200).
//
// The welcome HTML is embedded here (mirrors supabase/email-templates/
// welcome-*.html) because deployed functions cannot read repo files at runtime.

const APP_URL = (Deno.env.get('EMAIL_APP_URL') ?? 'http://localhost:4200').replace(/\/+$/, '');

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) {
    console.warn('send-email: RESEND_API_KEY / EMAIL_FROM not set — skipping send');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

const shell = (heading: string, bodyHtml: string) => `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'IBM Plex Sans',Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(6,13,26,0.08);">
<tr><td style="background-color:#060d1a;padding:24px 32px;">
<span style="font-size:22px;font-weight:700;color:#ffffff;">Tauru</span><span style="font-size:22px;font-weight:700;color:#f59e0b;">.</span>
<span style="display:block;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#7b8aa0;margin-top:2px;">Market</span>
</td></tr>
<tr><td style="padding:36px 32px 8px;">${bodyHtml}</td></tr>
<tr><td style="padding:28px 32px;border-top:1px solid #f1f5f9;"><p style="margin:0;font-size:11px;color:#94a3b8;">© 2026 Tauru Market · Genética bovina</p></td></tr>
</table></td></tr></table></body></html>`;

const button = (url: string, label: string, bg: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background-color:${bg};">
<a href="${url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>
</td></tr></table>`;

export function buyerWelcome(name: string): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#060d1a;">¡Bienvenido, ${name}! 🐂</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Tu cuenta en Tauru Market ya está activa. Explora nuestro catálogo de genética bovina —toros y pajillas de semen de la mejor calidad— y encuentra lo que necesitas para tu hato.</p>
    ${button(`${APP_URL}/catalog`, 'Explorar el catálogo', '#00bf63')}
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">¿Tienes ganado y quieres vender? Desde tu perfil puedes unirte como proveedor cuando quieras.</p>`;
  return { subject: '¡Bienvenido a Tauru Market!', html: shell('welcome-buyer', body) };
}

export function sellerWelcome(name: string): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#060d1a;">¡Ya eres proveedor, ${name}! 🎉</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Tu cuenta de proveedor en Tauru Market quedó activa. Desde tu panel puedes publicar tus toros, gestionar tu inventario y tus sucursales, y empezar a vender tu genética bovina.</p>
    ${button(`${APP_URL}/seller`, 'Ir a mi panel de proveedor', '#f59e0b')}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Consejo: completa los datos de tu tienda en Configuración para que los compradores te conozcan.</p>`;
  return { subject: 'Tu cuenta de proveedor está lista', html: shell('welcome-seller', body) };
}

const notesBlock = (label: string, notes: string) => `
  <div style="margin:0 0 24px;padding:14px 16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c2410c;">${label}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#7c2d12;white-space:pre-line;">${notes}</p>
  </div>`;

export function productApproved(name: string, itemName: string): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#060d1a;">¡Buenas noticias, ${name}! ✅</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Tu producto <strong>«${itemName}»</strong> fue revisado y <strong style="color:#00bf63;">aprobado</strong>. Ya está publicado y visible para los compradores en el catálogo de Tauru Market.</p>
    ${button(`${APP_URL}/seller/products`, 'Ver mis productos', '#00bf63')}`;
  return { subject: `Tu producto «${itemName}» fue aprobado`, html: shell('product-approved', body) };
}

export function productRejected(
  name: string,
  itemName: string,
  notes: string,
): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#060d1a;">Revisión de tu producto</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Hola ${name}, tu producto <strong>«${itemName}»</strong> fue <strong style="color:#ef4444;">rechazado</strong> durante la revisión.</p>
    ${notesBlock('Motivo del rechazo', notes)}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Puedes ajustar la información y volver a enviarlo a revisión desde tu panel.</p>
    ${button(`${APP_URL}/seller/products`, 'Revisar y ajustar', '#f59e0b')}`;
  return { subject: `Tu producto «${itemName}» fue rechazado`, html: shell('product-rejected', body) };
}

export function productChangesRequested(
  name: string,
  itemName: string,
  notes: string,
): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#060d1a;">Tu producto necesita cambios</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">Hola ${name}, para publicar <strong>«${itemName}»</strong> necesitamos que hagas algunos ajustes.</p>
    ${notesBlock('Cambios solicitados', notes)}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Realiza los cambios y vuelve a enviarlo a revisión desde tu panel.</p>
    ${button(`${APP_URL}/seller/products`, 'Ajustar y reenviar', '#f59e0b')}`;
  return { subject: `«${itemName}» necesita cambios`, html: shell('product-changes', body) };
}

export function nameFromClaims(claims: Record<string, unknown>): string {
  const meta = (claims['user_metadata'] as Record<string, unknown> | undefined) ?? {};
  const full = (meta['full_name'] as string | undefined)?.trim();
  if (full) return full.split(' ')[0];
  const email = claims['email'] as string | undefined;
  return email ? email.split('@')[0] : 'ganadero';
}
