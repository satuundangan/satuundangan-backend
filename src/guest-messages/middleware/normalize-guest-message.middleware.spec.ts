import { NormalizeGuestMessageMiddleware } from './normalize-guest-message.middleware';
import { Request, Response } from 'express';

describe('NormalizeGuestMessageMiddleware', () => {
  let middleware: NormalizeGuestMessageMiddleware;

  beforeEach(() => {
    middleware = new NormalizeGuestMessageMiddleware();
  });

  it('normalizes legacy name and attendance to guestName and rsvpStatus', () => {
    const req = {
      body: {
        invitationId: 1,
        name: '  Tamu Undangan Lama  ',
        attendance: 'hadir',
        message: 'Selamat!',
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.guestName).toBe('Tamu Undangan Lama');
    expect(req.body.rsvpStatus).toBe('hadir');
    expect(req.body.totalGuests).toBe(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets totalGuests to 0 when attendance is tidak_hadir and totalGuests is missing', () => {
    const req = {
      body: {
        invitationId: 2,
        name: 'Tamu Berhalangan',
        attendance: 'tidak_hadir',
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.guestName).toBe('Tamu Berhalangan');
    expect(req.body.rsvpStatus).toBe('tidak_hadir');
    expect(req.body.totalGuests).toBe(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('maps legacy token or guestToken to guestSlug', () => {
    const req = {
      body: {
        invitationId: 3,
        guestName: 'Tamu VIP',
        rsvpStatus: 'hadir',
        token: '  tok-vip-456  ',
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.body.guestSlug).toBe('tok-vip-456');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
