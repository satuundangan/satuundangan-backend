// Subdomain validation + normalization for custom invitation subdomains
// (e.g. namapasangan.satuundangan.id). Tier Eksklusif feature.

// Labels users cannot claim — system/app subdomains + abuse-prone words.
export const RESERVED_SUBDOMAINS = new Set<string>([
  'www',
  'api',
  'app',
  'admin',
  'administrator',
  'dashboard',
  'auth',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'oauth',
  'callback',
  'mail',
  'email',
  'smtp',
  'imap',
  'ftp',
  'cdn',
  'static',
  'assets',
  'img',
  'images',
  'media',
  'upload',
  'uploads',
  'files',
  'download',
  'demo',
  'test',
  'staging',
  'dev',
  'preview',
  'blog',
  'docs',
  'help',
  'support',
  'status',
  'billing',
  'payment',
  'pay',
  'checkout',
  'invoice',
  'account',
  'accounts',
  'profile',
  'settings',
  'root',
  'system',
  'internal',
  'private',
  'public',
  'null',
  'undefined',
  'undangan',
  'satuundangan',
  'satu-undangan',
]);

export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 63; // RFC 1035 label limit

// Lowercase, trim, collapse spaces/underscores to hyphen, strip invalid chars,
// strip leading/trailing hyphens. Does NOT enforce length/reserved (validate does).
export function normalizeSubdomain(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SubdomainCheckResult {
  available: boolean;
  normalized: string;
  reason?: string;
}

// Format/reserved validation only (no DB lookup). Returns reason on failure.
export function validateSubdomainFormat(
  normalized: string,
): { valid: boolean; reason?: string } {
  if (!normalized) {
    return { valid: false, reason: 'Subdomain tidak boleh kosong' };
  }
  if (normalized.length < SUBDOMAIN_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Minimal ${SUBDOMAIN_MIN_LENGTH} karakter`,
    };
  }
  if (normalized.length > SUBDOMAIN_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Maksimal ${SUBDOMAIN_MAX_LENGTH} karakter`,
    };
  }
  // Belt-and-suspenders: normalize already guarantees this charset/shape.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return {
      valid: false,
      reason: 'Hanya huruf, angka, dan tanda hubung (tidak di awal/akhir)',
    };
  }
  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, reason: 'Subdomain ini sudah dipesan sistem' };
  }
  return { valid: true };
}
