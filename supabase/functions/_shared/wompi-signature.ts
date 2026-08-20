// Wompi integrity signature (outbound, create-checkout) and event checksum
// (inbound, wompi-webhook). Both are SHA-256 over a concatenated string —
// see design.md Decision 6: the checksum properties are read dynamically
// from signature.properties on each event rather than a hardcoded field
// list, because Wompi documents that the property set can vary by event
// type.

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string,
): Promise<string> {
  return sha256Hex(`${reference}${amountInCents}${currency}${integritySecret}`);
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export interface WompiEventSignature {
  properties: string[];
  checksum: string;
}

export interface WompiEventPayload {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature: WompiEventSignature;
  timestamp: number;
  sent_at?: string;
}

export async function verifyEventChecksum(
  payload: WompiEventPayload,
  eventsSecret: string,
): Promise<boolean> {
  const { properties, checksum } = payload.signature ?? {};
  if (!Array.isArray(properties) || properties.length === 0 || !checksum) return false;

  const values = properties.map((path) => {
    const value = getByPath(payload.data, path);
    return value === null || value === undefined ? '' : String(value);
  });

  const concatenated = `${values.join('')}${payload.timestamp}${eventsSecret}`;
  const computed = await sha256Hex(concatenated);
  return computed.toLowerCase() === checksum.toLowerCase();
}
