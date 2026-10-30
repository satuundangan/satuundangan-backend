import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AdminSecurityService, hashRecoveryCode } from './admin-security.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'SECRET123'),
  generateURI: jest.fn(() => 'otpauth://totp/x'),
  verifySync: jest.fn(({ token }: { token: string }) => ({ valid: token === '123456' })),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(async () => 'data:image/png;base64,QR') }));

function build() {
  const sessionRows: any[] = [];
  const user: any = { id: 1, email: 'a@x.id', totpEnabled: false, totpSecret: null, totpRecoveryHashes: null };
  const sessions: any = {
    create: (row: any) => row,
    save: jest.fn(async (row: any) => { sessionRows.push(row); return row; }),
    findOne: jest.fn(async ({ where }: any) => sessionRows.find((s) => s.id === where.id && s.userId === where.userId)),
    find: jest.fn(async ({ where }: any) => sessionRows.filter((s) => s.userId === where.userId && (where.revokedAt === undefined || s.revokedAt === null)).sort((a, b) => b.createdAt - a.createdAt)),
    update: jest.fn(async (criteria: any, patch: any) => {
      const ids = Array.isArray(criteria) ? criteria : [criteria.id];
      let affected = 0;
      sessionRows.forEach((s) => { if (ids.includes(s.id) && (!criteria.userId || s.userId === criteria.userId) && (!('revokedAt' in (criteria.id ? criteria : {})) || s.revokedAt === null)) { Object.assign(s, patch); affected++; } });
      return { affected };
    }),
  };
  const qb: any = { addSelect: () => qb, where: () => qb, getOne: async () => user };
  const users: any = { findOne: jest.fn(async () => user), save: jest.fn(async (u: any) => Object.assign(user, u)), createQueryBuilder: () => qb };
  return { svc: new AdminSecurityService(sessions, users), user, sessionRows };
}

describe('AdminSecurityService sessions', () => {
  it('accepts an active session and rejects a revoked one', async () => {
    const { svc } = build();
    const session = await svc.startSession(1, { ip: '1.1.1.1', userAgent: 'UA' });
    await expect(svc.assertActive(session.id, 1)).resolves.toBeUndefined();
    await svc.revokeSession(1, session.id);
    await expect(svc.assertActive(session.id, 1)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown, foreign or expired session', async () => {
    const { svc, sessionRows } = build();
    await expect(svc.assertActive('nope', 1)).rejects.toThrow(UnauthorizedException);
    const session = await svc.startSession(1, {});
    await expect(svc.assertActive(session.id, 2)).rejects.toThrow(UnauthorizedException);
    sessionRows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.assertActive(session.id, 1)).rejects.toThrow(UnauthorizedException);
  });

  it('revokes every session except the current one', async () => {
    const { svc } = build();
    const current = await svc.startSession(1, {});
    const other = await svc.startSession(1, {});
    expect(await svc.revokeOtherSessions(1, current.id)).toEqual({ revoked: 1 });
    await expect(svc.assertActive(current.id, 1)).resolves.toBeUndefined();
    await expect(svc.assertActive(other.id, 1)).rejects.toThrow(UnauthorizedException);
  });
});

describe('AdminSecurityService TOTP', () => {
  it('returns recovery codes once and stores only their hashes', async () => {
    const { svc, user } = build();
    await svc.setup(1);
    const result = await svc.activate(1, '123456');
    expect(result.recoveryCodes).toHaveLength(8);
    expect(user.totpEnabled).toBe(true);
    expect(user.totpRecoveryHashes).toEqual(result.recoveryCodes.map(hashRecoveryCode));
    expect(JSON.stringify(user.totpRecoveryHashes)).not.toContain(result.recoveryCodes[0]);
  });

  it('refuses a wrong activation code', async () => {
    const { svc } = build();
    await svc.setup(1);
    await expect(svc.activate(1, '000000')).rejects.toThrow(BadRequestException);
  });

  it('will not replace the device while TOTP is active', async () => {
    const { svc } = build();
    await svc.setup(1);
    await svc.activate(1, '123456');
    await expect(svc.setup(1)).rejects.toThrow(BadRequestException);
  });

  it('disables with a recovery code that works only once', async () => {
    const { svc, user } = build();
    await svc.setup(1);
    const { recoveryCodes } = await svc.activate(1, '123456');
    await svc.disable(1, { recoveryCode: recoveryCodes[0] });
    expect(user.totpEnabled).toBe(false);
    expect(user.totpSecret).toBeNull();
    // re-enable, then reuse the old code: it was wiped with the previous hashes
    await svc.setup(1);
    await svc.activate(1, '123456');
    await expect(svc.disable(1, { recoveryCode: recoveryCodes[0] })).rejects.toThrow(BadRequestException);
  });

  it('refuses disabling with neither a valid code nor recovery code', async () => {
    const { svc } = build();
    await svc.setup(1);
    await svc.activate(1, '123456');
    await expect(svc.disable(1, { code: '999999' })).rejects.toThrow(BadRequestException);
    await expect(svc.disable(1, {})).rejects.toThrow(BadRequestException);
  });

  it('regenerates codes and invalidates the old ones', async () => {
    const { svc, user } = build();
    await svc.setup(1);
    const first = await svc.activate(1, '123456');
    const second = await svc.regenerateRecoveryCodes(1, { code: '123456' });
    expect(second.recoveryCodes).toHaveLength(8);
    expect(user.totpRecoveryHashes).not.toContain(hashRecoveryCode(first.recoveryCodes[0]));
  });
});
