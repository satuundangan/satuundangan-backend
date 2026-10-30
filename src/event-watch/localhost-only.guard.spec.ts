import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { LocalhostOnlyGuard } from './localhost-only.guard';

const ctx = (req: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('LocalhostOnlyGuard', () => {
  const guard = new LocalhostOnlyGuard();

  it('allows loopback socket addresses', () => {
    expect(guard.canActivate(ctx({ socket: { remoteAddress: '127.0.0.1' } }))).toBe(
      true,
    );
    expect(guard.canActivate(ctx({ socket: { remoteAddress: '::1' } }))).toBe(true);
    expect(
      guard.canActivate(ctx({ socket: { remoteAddress: '::ffff:127.0.0.1' } })),
    ).toBe(true);
  });

  it('rejects non-loopback even with spoofed X-Forwarded-For / req.ip', () => {
    const req = {
      socket: { remoteAddress: '172.18.0.1' },
      headers: { 'x-forwarded-for': '127.0.0.1' },
      ip: '127.0.0.1',
    };
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
  });

  it('rejects when socket is missing', () => {
    expect(() => guard.canActivate(ctx({ ip: '127.0.0.1' }))).toThrow(
      ForbiddenException,
    );
  });
});
