// Pure helpers for event-watch. No Nest/TypeORM imports and no server-local
// timezone getters: everything is derived from getTime()/getUTC* so results are
// identical regardless of the host TZ. Asia/Jakarta is a fixed UTC+7 (no DST).

export type EventType = 'resepsi' | 'akad' | 'dateTime';

export interface OwnerLike {
  email?: string | null;
  isAdmin?: boolean | null;
}

export interface EventSourceInvitation {
  id: number;
  slug?: string | null;
  title?: string | null;
  coupleName?: string | null;
  groomName?: string | null;
  brideName?: string | null;
  package?: string | null;
  dateTime?: Date | string | null;
  akadLocation?: { dateTime?: string | null } | null;
  resepsiLocation?: { dateTime?: string | null } | null;
  user?: OwnerLike | null;
}

export interface UpcomingEventItem {
  invitationId: number;
  slug: string;
  coupleNames: string;
  ownerEmail: string;
  package: string | null;
  eventType: EventType;
  eventAt: string;
  eventAtWib: string;
  akadAtWib?: string;
  resepsiAtWib?: string;
  daysUntil: number;
}

export interface SmokeResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

export interface ExcludeList {
  localParts: string[];
  emails: string[];
}

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DEFAULT_EXCLUDE_EMAILS = 'undangdongofficial';
export const PUBLIC_BASE_URL = 'https://satuundangan.id/inv/';

const DAY_MS = 86_400_000;
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const HAS_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/;

/**
 * Parses the date shapes found in the DB: ISO strings with zone, naive
 * "YYYY-MM-DDTHH:mm" strings (Asia/Jakarta wall time) and Date columns.
 */
export function parseEventDate(v: unknown): Date | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : new Date(v.getTime());
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  let parsed: Date;
  if (HAS_OFFSET_RE.test(s)) {
    parsed = new Date(s);
  } else if (NAIVE_RE.test(s)) {
    let iso = s;
    if (!iso.includes('T')) iso += 'T00:00';
    if (!/T\d{2}:\d{2}:\d{2}/.test(iso)) iso += ':00';
    parsed = new Date(`${iso}+07:00`);
  } else {
    return null;
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const wibDayNumber = (d: Date): number =>
  Math.floor((d.getTime() + WIB_OFFSET_MS) / DAY_MS);

export function daysUntilWib(event: Date, now: Date): number {
  return wibDayNumber(event) - wibDayNumber(now);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function formatWibDate(d: Date): string {
  const s = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${DAY_NAMES[s.getUTCDay()]}, ${pad2(s.getUTCDate())} ${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

export function formatWib(d: Date): string {
  const s = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${formatWibDate(d)} ${pad2(s.getUTCHours())}:${pad2(s.getUTCMinutes())} WIB`;
}

const splitList = (raw: string): string[] =>
  raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

/** `undefined` env means "use default"; an explicit (even empty) value replaces it. */
export function parseExcludeList(raw: string | undefined): ExcludeList {
  const entries = splitList(raw === undefined ? DEFAULT_EXCLUDE_EMAILS : raw);
  return {
    emails: entries.filter((e) => e.includes('@')),
    localParts: entries.filter((e) => !e.includes('@')),
  };
}

export function isExcludedOwner(
  user: OwnerLike | null | undefined,
  list: ExcludeList,
): boolean {
  if (!user) return true;
  if (user.isAdmin === true) return true;
  const email = (user.email ?? '').trim().toLowerCase();
  if (!email) return true;
  if (/playwright|tester/i.test(email)) return true;
  const at = email.lastIndexOf('@');
  const local = at >= 0 ? email.slice(0, at) : email;
  const domain = at >= 0 ? email.slice(at + 1) : '';
  // "test", "test123", "test.user", "testing_01" — but not real names like "testiana".
  if (/^test(ing)?(\d|[._+-]|$)/.test(local) || local === 'admin') return true;
  if (domain === 'test.com' || domain === 'example.com') return true;
  // Reserved TLDs used by seeds/bots (e.g. @satuundangan.local, @example.test) and our own domain.
  if (/\.(local|test|example|invalid)$/.test(domain)) return true;
  if (/^satuundangan\./.test(domain)) return true;
  if (list.emails.includes(email)) return true;
  if (list.localParts.includes(local)) return true;
  return false;
}

function resolveEvent(inv: EventSourceInvitation): {
  primary: Date;
  eventType: EventType;
  akad: Date | null;
  resepsi: Date | null;
} | null {
  const resepsi = parseEventDate(inv.resepsiLocation?.dateTime);
  const akad = parseEventDate(inv.akadLocation?.dateTime);
  const col = parseEventDate(inv.dateTime);
  if (resepsi) return { primary: resepsi, eventType: 'resepsi', akad, resepsi };
  if (akad) return { primary: akad, eventType: 'akad', akad, resepsi };
  if (col) return { primary: col, eventType: 'dateTime', akad, resepsi };
  return null;
}

function coupleNamesOf(inv: EventSourceInvitation): string {
  const groom = inv.groomName?.trim();
  const bride = inv.brideName?.trim();
  if (groom && bride) return `${groom} & ${bride}`;
  return inv.coupleName?.trim() || inv.title?.trim() || `Undangan #${inv.id}`;
}

export function selectUpcomingEvents(
  invs: EventSourceInvitation[],
  opts: { days: number; now: Date; excludeList: ExcludeList },
): UpcomingEventItem[] {
  const items: UpcomingEventItem[] = [];
  for (const inv of invs) {
    const slug = inv.slug?.trim();
    if (!slug) continue;
    if (isExcludedOwner(inv.user, opts.excludeList)) continue;
    const ev = resolveEvent(inv);
    if (!ev) continue;
    const daysUntil = daysUntilWib(ev.primary, opts.now);
    if (daysUntil < 0 || daysUntil > opts.days) continue;

    const item: UpcomingEventItem = {
      invitationId: inv.id,
      slug,
      coupleNames: coupleNamesOf(inv),
      ownerEmail: (inv.user?.email ?? '').trim(),
      package: inv.package ?? null,
      eventType: ev.eventType,
      eventAt: ev.primary.toISOString(),
      eventAtWib: formatWib(ev.primary),
      daysUntil,
    };
    if (ev.akad) item.akadAtWib = formatWib(ev.akad);
    if (ev.resepsi) item.resepsiAtWib = formatWib(ev.resepsi);
    items.push(item);
  }
  return items.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.eventAt.localeCompare(b.eventAt),
  );
}

function smokeLine(s: SmokeResult | undefined): string {
  if (!s) return 'Smoke: -';
  if (s.ok) return 'Smoke: OK';
  if (s.status !== null && s.status !== undefined)
    return `Smoke: FAIL (${s.status})`;
  return `Smoke: FAIL (${s.error ?? 'unknown'})`;
}

export function buildDigestMessage(
  items: UpcomingEventItem[],
  smoke: Record<string, SmokeResult>,
  now: Date,
): string {
  const lines: string[] = ['*Event Watch SatuUndangan*', formatWibDate(now)];
  const groups: Array<{ days: number; label: string }> = [
    { days: 0, label: 'Hari-H' },
    { days: 1, label: 'H-1' },
    { days: 7, label: 'H-7' },
  ];

  for (const g of groups) {
    const group = items.filter((i) => i.daysUntil === g.days);
    if (group.length === 0) continue;
    lines.push('', `*${g.label} (${group.length})*`);
    group.forEach((it, idx) => {
      const pkg = it.package ? ` (${it.package.toUpperCase()})` : '';
      lines.push(`${idx + 1}. ${it.coupleNames}${pkg}`);
      if (it.akadAtWib || it.resepsiAtWib) {
        if (it.akadAtWib) lines.push(`   Akad: ${it.akadAtWib}`);
        if (it.resepsiAtWib) lines.push(`   Resepsi: ${it.resepsiAtWib}`);
      } else {
        lines.push(`   Acara: ${it.eventAtWib}`);
      }
      lines.push(`   ${PUBLIC_BASE_URL}${it.slug}`);
      lines.push(`   Owner: ${it.ownerEmail}`);
      lines.push(`   ${smokeLine(smoke[it.slug])}`);
    });

    if (g.days === 7) {
      lines.push(
        '',
        '*Checklist H-7:*',
        '- Halaman undangan /inv/:slug terbuka normal',
        '- RSVP & ucapan berfungsi',
        '- Musik & gambar R2 termuat',
        '- SSL valid',
        '- Disk & backup DB aman',
        '- Tidak ada deploy besar pending',
      );
    }
  }
  return lines.join('\n');
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLoopbackAddress(addr?: string | null): boolean {
  return !!addr && LOOPBACK.has(addr);
}

export function parseWaNumbers(raw?: string): string[] {
  if (!raw) return [];
  const nums = raw
    .split(',')
    .map((x) => x.replace(/\D/g, ''))
    .filter(Boolean);
  return [...new Set(nums)];
}

export function parseEmailList(raw?: string): string[] {
  if (!raw) return [];
  const emails = raw
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.includes('@'));
  return [...new Set(emails)];
}
