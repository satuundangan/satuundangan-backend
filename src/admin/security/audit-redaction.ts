const SECRET_KEY = /pass(word)?|secret|token|totp|otp|authorization|api[-_]?key|private[-_]?key|recovery|hash|credential|cookie/i;
const PII_KEY = /e-?mail|phone|whatsapp|^hp$|no_?hp|address|alamat|^nik$|ktp|rekening|account_?number|accountnumber/i;
const MAX_STRING = 300;
const MAX_DEPTH = 4;
const MAX_JSON_BYTES = 8_000;

function maskPii(value: string): string {
  const at = value.indexOf('@');
  if (at > 0) return `${value[0]}***${value.slice(at)}`;
  return value.length <= 4 ? '***' : `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[${value.length} karakter]` : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[dipangkas]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (SECRET_KEY.test(key)) return [key, '[disembunyikan]'];
      if (PII_KEY.test(key) && typeof item === 'string') return [key, maskPii(item)];
      return [key, redactValue(item, depth + 1)];
    }),
  );
}

/** Removes secrets, masks personal data and bounds the size of a payload before it is stored. */
export function redactForAudit(value: unknown): Record<string, any> | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const redacted = redactValue(value, 0) as Record<string, any>;
  return JSON.stringify(redacted).length > MAX_JSON_BYTES
    ? { _dipangkas: true, kolom: Object.keys(redacted) }
    : redacted;
}
