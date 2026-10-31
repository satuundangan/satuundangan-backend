export const ADMIN_ROLES = ['superadmin', 'support', 'finance', 'content'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: 'Superadmin',
  support: 'Support',
  finance: 'Finance',
  content: 'Content',
};

interface ResourceAccess {
  read: readonly AdminRole[];
  write: readonly AdminRole[];
}

const ALL: readonly AdminRole[] = ADMIN_ROLES;
const SUPER: readonly AdminRole[] = ['superadmin'];

/**
 * Role matrix per `/admin/<resource>`. Resources that are not listed here are
 * superadmin-only, so a new admin route is closed by default instead of open.
 * An admin account with `isAdmin = true` and no `adminRole` is a superadmin,
 * which keeps every account that existed before roles were introduced working.
 */
const RESOURCE_ACCESS: Record<string, ResourceAccess> = {
  dashboard: { read: ALL, write: SUPER },
  stats: { read: ALL, write: SUPER },
  analytics: { read: ['superadmin', 'finance', 'content'], write: SUPER },
  users: { read: ['superadmin', 'support'], write: ['superadmin', 'support'] },
  invitations: {
    read: ['superadmin', 'support', 'finance'],
    write: ['superadmin', 'support'],
  },
  guests: { read: ['superadmin', 'support'], write: ['superadmin', 'support'] },
  'guest-messages': {
    read: ['superadmin', 'support'],
    write: ['superadmin', 'support'],
  },
  leads: {
    read: ['superadmin', 'support', 'finance'],
    write: ['superadmin', 'support'],
  },
  'support-tickets': {
    read: ['superadmin', 'support'],
    write: ['superadmin', 'support'],
  },
  ai: {
    read: ['superadmin', 'support', 'content', 'finance'],
    write: ['superadmin'],
  },
  payments: {
    read: ['superadmin', 'finance', 'support'],
    write: ['superadmin', 'finance'],
  },
  'promo-codes': {
    read: ['superadmin', 'finance'],
    write: ['superadmin', 'finance'],
  },
  banks: { read: ['superadmin', 'finance'], write: ['superadmin', 'finance'] },
  affiliate: { read: ['superadmin', 'finance'], write: ['superadmin', 'finance'] },
  'template-designs': {
    read: ['superadmin', 'content'],
    write: ['superadmin', 'content'],
  },
  categories: { read: ['superadmin', 'content'], write: ['superadmin', 'content'] },
  sections: { read: ['superadmin', 'content'], write: ['superadmin', 'content'] },
  'palette-colors': {
    read: ['superadmin', 'content'],
    write: ['superadmin', 'content'],
  },
  audio: { read: ['superadmin', 'content'], write: ['superadmin', 'content'] },
  articles: { read: ['superadmin', 'content'], write: ['superadmin', 'content'] },
  'whatsapp-bot': { read: ['superadmin', 'support'], write: ['superadmin', 'support'] },
  health: { read: SUPER, write: SUPER },
  logs: { read: SUPER, write: SUPER },
  'audit-logs': { read: SUPER, write: SUPER },
  maintenance: { read: SUPER, write: SUPER },
  sessions: { read: SUPER, write: SUPER },
};

export function resolveAdminRole(user: {
  isAdmin?: boolean;
  adminRole?: string | null;
}): AdminRole | null {
  if (!user?.isAdmin) return null;
  return (ADMIN_ROLES as readonly string[]).includes(user.adminRole ?? '')
    ? (user.adminRole as AdminRole)
    : 'superadmin';
}

export function adminResourceFromPath(path: string): string | null {
  const match = /^\/admin\/([^/?#]+)/.exec(path);
  return match ? match[1] : null;
}

/** Changing who is an admin or which role they hold never goes below superadmin. */
function isPrivilegeChange(method: string, path: string): boolean {
  return (
    /^\/admin\/users\/[^/]+\/admin-role/.test(path) ||
    (method !== 'GET' && /^\/admin\/users\/[^/]+\/sessions/.test(path))
  );
}

export function canAccessAdminPath(
  role: AdminRole,
  method: string,
  path: string,
): boolean {
  if (role === 'superadmin') return true;
  if (isPrivilegeChange(method, path)) return false;
  const resource = adminResourceFromPath(path);
  if (!resource) return true; // not an /admin/* path (e.g. /auth/admin/totp/*)
  const access = RESOURCE_ACCESS[resource];
  if (!access) return false;
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  return (safe ? access.read : access.write).includes(role);
}

/** Resources a role may open, used to build the admin menu from the server. */
export function allowedResources(role: AdminRole): string[] {
  return Object.entries(RESOURCE_ACCESS)
    .filter(([, access]) => access.read.includes(role))
    .map(([resource]) => resource);
}
