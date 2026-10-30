import { describeAdminRequest } from './admin-audit.interceptor';
import { redactForAudit } from './audit-redaction';

describe('audit redaction', () => {
  it('hides secrets and masks personal data', () => {
    const out = redactForAudit({
      name: 'Rani',
      password: 'rahasia123',
      totpSecret: 'JBSWY3DP',
      resetPasswordTokenHash: 'abc',
      email: 'rani@example.com',
      phone: '081234567890',
      nested: { apiKey: 'k', note: 'aman' },
    })!;
    expect(out.password).toBe('[disembunyikan]');
    expect(out.totpSecret).toBe('[disembunyikan]');
    expect(out.resetPasswordTokenHash).toBe('[disembunyikan]');
    expect(out.nested.apiKey).toBe('[disembunyikan]');
    expect(out.nested.note).toBe('aman');
    expect(out.email).toBe('r***@example.com');
    expect(out.phone).not.toContain('123456');
    expect(JSON.stringify(out)).not.toContain('rahasia123');
  });

  it('bounds long strings and oversized payloads', () => {
    const long = redactForAudit({ text: 'x'.repeat(2_000) })!;
    expect(long.text.length).toBeLessThan(400);
    const huge = redactForAudit(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, 'y'.repeat(250)])))!;
    expect(huge._dipangkas).toBe(true);
  });

  it('returns null for non-objects', () => {
    expect(redactForAudit(undefined)).toBeNull();
    expect(redactForAudit('teks')).toBeNull();
  });
});

describe('describeAdminRequest', () => {
  it('names create, update and delete by resource', () => {
    expect(describeAdminRequest('POST', '/admin/promo-codes')).toEqual({ entityType: 'promo-codes', entityId: null, action: 'promo-codes.create' });
    expect(describeAdminRequest('PATCH', '/admin/users/12')).toEqual({ entityType: 'users', entityId: '12', action: 'users.update' });
    expect(describeAdminRequest('DELETE', '/admin/invitations/7')).toEqual({ entityType: 'invitations', entityId: '7', action: 'invitations.delete' });
  });

  it('keeps sub-actions distinguishable', () => {
    expect(describeAdminRequest('POST', '/admin/payments/4/reconcile-publish')).toMatchObject({ entityId: '4', action: 'payments.reconcile-publish' });
    expect(describeAdminRequest('PATCH', '/admin/users/3/admin-role')).toMatchObject({ entityId: '3', action: 'users.update-admin-role' });
  });
});
