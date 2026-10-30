import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { AdminSession } from './admin-session.entity';
import { allowedResources, resolveAdminRole } from '../admin/security/admin-roles';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // matches the 7d JWT lifetime
const TOUCH_INTERVAL_MS = 60_000;
const RECOVERY_CODE_COUNT = 8;

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex');
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = randomBytes(8).toString('hex');
    return hex.match(/.{4}/g)!.join('-');
  });
}

@Injectable()
export class AdminSecurityService {
  constructor(
    @InjectRepository(AdminSession) private readonly sessions: Repository<AdminSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ---- Sessions -----------------------------------------------------------

  async startSession(userId: number, meta: { ip?: string | null; userAgent?: string | null }) {
    const now = new Date();
    const session = this.sessions.create({
      id: randomUUID(),
      userId,
      ip: meta.ip?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      revokedAt: null,
    });
    await this.sessions.save(session);
    return session;
  }

  /** Called for every request that carries a session id; revoked or expired sessions are rejected. */
  async assertActive(sessionId: string, userId: number): Promise<void> {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesi admin sudah dicabut atau berakhir. Silakan login kembali.');
    }
    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.sessions.update({ id: session.id }, { lastSeenAt: new Date() });
    }
  }

  async listSessions(userId: number, currentSessionId?: string) {
    const items = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { lastSeenAt: 'DESC' },
      take: 50,
    });
    return items.map((session) => ({
      id: session.id,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      current: session.id === currentSessionId,
    }));
  }

  /** The login before the current one, so an admin can spot a sign-in they did not make. */
  async lastLogin(userId: number, currentSessionId?: string) {
    const recent = await this.sessions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 2 });
    const previous = recent.find((session) => session.id !== currentSessionId);
    return previous
      ? { at: previous.createdAt, ip: previous.ip, userAgent: previous.userAgent }
      : null;
  }

  async revokeSession(userId: number, sessionId: string) {
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Sesi tidak ditemukan atau sudah dicabut.');
    return { revoked: 1 };
  }

  async revokeOtherSessions(userId: number, currentSessionId?: string) {
    const active = await this.sessions.find({ where: { userId, revokedAt: IsNull() } });
    const others = active.filter((session) => session.id !== currentSessionId);
    if (others.length) {
      await this.sessions.update(others.map((session) => session.id), { revokedAt: new Date() });
    }
    return { revoked: others.length };
  }

  // ---- TOTP ---------------------------------------------------------------

  async status(userId: number, currentSessionId?: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, isAdmin: true, adminRole: true, totpEnabled: true },
    });
    const role = user ? resolveAdminRole(user) : null;
    const withHashes = await this.users
      .createQueryBuilder('user')
      .addSelect('user.totpRecoveryHashes')
      .where('user.id = :userId', { userId })
      .getOne();
    return {
      adminRole: role,
      allowedResources: role ? allowedResources(role) : [],
      totpEnabled: Boolean(user?.totpEnabled),
      // Sign-in does not ask for the code yet; turning that on is a separate, explicit decision.
      totpRequiredAtLogin: false,
      recoveryCodesRemaining: withHashes?.totpRecoveryHashes?.length ?? 0,
      lastLogin: await this.lastLogin(userId, currentSessionId),
      sessions: await this.listSessions(userId, currentSessionId),
    };
  }

  async setup(userId: number) {
    const user = await this.requireUser(userId);
    if (user.totpEnabled) {
      throw new BadRequestException(
        'TOTP sudah aktif. Nonaktifkan dengan kode atau recovery code sebelum mengganti perangkat.',
      );
    }
    const secret = generateSecret();
    user.totpSecret = secret;
    await this.users.save(user);
    const otpauthUrl = generateURI({ issuer: 'Satu Undangan Admin', label: user.email, secret });
    return { otpauthUrl, secret, qrCode: await QRCode.toDataURL(otpauthUrl) };
  }

  async activate(userId: number, code: string) {
    const user = await this.requireUser(userId);
    if (!user.totpSecret) throw new BadRequestException('Setup TOTP dulu sebelum aktivasi');
    if (!verifySync({ token: String(code ?? ''), secret: user.totpSecret }).valid) {
      throw new BadRequestException('Kode OTP tidak valid, coba lagi');
    }
    const recoveryCodes = generateRecoveryCodes();
    user.totpEnabled = true;
    user.totpRecoveryHashes = recoveryCodes.map(hashRecoveryCode);
    await this.users.save(user);
    return {
      message: 'TOTP berhasil diaktifkan',
      // Shown once. Only hashes are stored, so they cannot be shown again.
      recoveryCodes,
    };
  }

  async regenerateRecoveryCodes(userId: number, proof: { code?: string; recoveryCode?: string }) {
    const user = await this.loadWithRecovery(userId);
    if (!user.totpEnabled) throw new BadRequestException('TOTP belum aktif.');
    this.consumeProof(user, proof);
    const recoveryCodes = generateRecoveryCodes();
    user.totpRecoveryHashes = recoveryCodes.map(hashRecoveryCode);
    await this.users.save(user);
    return { recoveryCodes };
  }

  /** Turns TOTP off using a current code or a recovery code (lost or replaced device). */
  async disable(userId: number, proof: { code?: string; recoveryCode?: string }) {
    const user = await this.loadWithRecovery(userId);
    if (!user.totpEnabled) throw new BadRequestException('TOTP belum aktif.');
    this.consumeProof(user, proof);
    user.totpEnabled = false;
    user.totpSecret = null;
    user.totpRecoveryHashes = null;
    await this.users.save(user);
    return { message: 'TOTP dinonaktifkan. Setup ulang untuk perangkat baru.' };
  }

  private consumeProof(user: User, proof: { code?: string; recoveryCode?: string }) {
    if (proof.code && user.totpSecret && verifySync({ token: String(proof.code), secret: user.totpSecret }).valid) {
      return;
    }
    if (proof.recoveryCode) {
      const hash = hashRecoveryCode(proof.recoveryCode);
      const hashes = user.totpRecoveryHashes ?? [];
      if (hashes.includes(hash)) {
        user.totpRecoveryHashes = hashes.filter((item) => item !== hash);
        return;
      }
    }
    throw new BadRequestException('Kode OTP atau recovery code tidak valid.');
  }

  private async requireUser(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private async loadWithRecovery(userId: number) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.totpSecret', 'user.totpRecoveryHashes'])
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
