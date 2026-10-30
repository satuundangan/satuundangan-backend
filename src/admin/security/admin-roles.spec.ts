import { allowedResources, canAccessAdminPath, resolveAdminRole } from './admin-roles';

describe('admin roles', () => {
  it('treats an admin without a role as superadmin so existing accounts keep working', () => {
    expect(resolveAdminRole({ isAdmin: true, adminRole: null })).toBe('superadmin');
    expect(resolveAdminRole({ isAdmin: true, adminRole: 'tidak-dikenal' })).toBe('superadmin');
    expect(resolveAdminRole({ isAdmin: false, adminRole: 'finance' })).toBeNull();
  });

  it('lets a superadmin reach everything, including unlisted routes', () => {
    expect(canAccessAdminPath('superadmin', 'DELETE', '/admin/users/5')).toBe(true);
    expect(canAccessAdminPath('superadmin', 'GET', '/admin/rute-baru')).toBe(true);
  });

  it('separates read from write per resource', () => {
    expect(canAccessAdminPath('finance', 'GET', '/admin/payments')).toBe(true);
    expect(canAccessAdminPath('finance', 'POST', '/admin/payments/3/reconcile-publish')).toBe(true);
    expect(canAccessAdminPath('support', 'GET', '/admin/payments/3')).toBe(true);
    expect(canAccessAdminPath('support', 'POST', '/admin/payments/3/reconcile-publish')).toBe(false);
    expect(canAccessAdminPath('content', 'GET', '/admin/payments')).toBe(false);
  });

  it('keeps content roles on content and support roles on customers', () => {
    expect(canAccessAdminPath('content', 'POST', '/admin/articles')).toBe(true);
    expect(canAccessAdminPath('content', 'PATCH', '/admin/users/1')).toBe(false);
    expect(canAccessAdminPath('support', 'PATCH', '/admin/users/1')).toBe(true);
    expect(canAccessAdminPath('support', 'POST', '/admin/promo-codes')).toBe(false);
  });

  it('denies unlisted resources and system controls to non-superadmins', () => {
    for (const role of ['support', 'finance', 'content'] as const) {
      expect(canAccessAdminPath(role, 'GET', '/admin/rute-baru')).toBe(false);
      expect(canAccessAdminPath(role, 'GET', '/admin/health')).toBe(false);
      expect(canAccessAdminPath(role, 'GET', '/admin/audit-logs')).toBe(false);
      expect(canAccessAdminPath(role, 'PUT', '/admin/maintenance')).toBe(false);
    }
  });

  it('never lets a non-superadmin change roles, even with user write access', () => {
    expect(canAccessAdminPath('support', 'PATCH', '/admin/users/9/admin-role')).toBe(false);
  });

  it('does not restrict paths outside /admin such as the auth TOTP routes', () => {
    expect(canAccessAdminPath('content', 'POST', '/auth/admin/totp/activate')).toBe(true);
  });

  it('lists the resources a role can open for menu building', () => {
    expect(allowedResources('content')).toEqual(expect.arrayContaining(['articles', 'audio', 'dashboard']));
    expect(allowedResources('content')).not.toContain('payments');
    expect(allowedResources('finance')).toContain('payments');
  });
});
