import {
  buildDigestMessage,
  daysUntilWib,
  EventSourceInvitation,
  formatWib,
  isExcludedOwner,
  isLoopbackAddress,
  parseEmailList,
  parseEventDate,
  parseExcludeList,
  parseWaNumbers,
  selectUpcomingEvents,
  SmokeResult,
} from './event-watch.utils';

describe('parseEventDate', () => {
  it('parses ISO Z strings', () => {
    expect(parseEventDate('2026-12-01T11:00:00.000Z')?.toISOString()).toBe(
      '2026-12-01T11:00:00.000Z',
    );
  });

  it('treats naive strings as WIB (+07:00)', () => {
    expect(parseEventDate('2026-05-21T15:29')?.toISOString()).toBe(
      '2026-05-21T08:29:00.000Z',
    );
    expect(parseEventDate('2026-05-21T15:29:30')?.toISOString()).toBe(
      '2026-05-21T08:29:30.000Z',
    );
    expect(parseEventDate('2026-05-21')?.toISOString()).toBe(
      '2026-05-20T17:00:00.000Z',
    );
  });

  it('honors explicit offsets', () => {
    expect(parseEventDate('2026-05-21T15:29:00+07:00')?.toISOString()).toBe(
      '2026-05-21T08:29:00.000Z',
    );
    expect(parseEventDate('2026-05-21T15:29:00+09:00')?.toISOString()).toBe(
      '2026-05-21T06:29:00.000Z',
    );
  });

  it('accepts valid Date instances', () => {
    const d = new Date('2026-05-21T08:29:00.000Z');
    expect(parseEventDate(d)?.getTime()).toBe(d.getTime());
  });

  it('returns null for invalid input', () => {
    expect(parseEventDate(new Date('nope'))).toBeNull();
    expect(parseEventDate('')).toBeNull();
    expect(parseEventDate('   ')).toBeNull();
    expect(parseEventDate('abc')).toBeNull();
    expect(parseEventDate(null)).toBeNull();
    expect(parseEventDate(undefined)).toBeNull();
    expect(parseEventDate(12345)).toBeNull();
  });
});

describe('daysUntilWib', () => {
  const now = new Date('2026-10-30T17:30:00Z'); // 31 Oct 00:30 WIB

  it('computes WIB calendar day differences', () => {
    expect(daysUntilWib(new Date('2026-11-07T03:00:00Z'), now)).toBe(7);
    expect(daysUntilWib(new Date('2026-10-31T16:59:00Z'), now)).toBe(0);
    expect(daysUntilWib(new Date('2026-10-31T17:00:00Z'), now)).toBe(1);
    expect(daysUntilWib(new Date('2026-10-30T16:59:00Z'), now)).toBe(-1);
  });
});

describe('formatWib', () => {
  it('formats in Indonesian WIB', () => {
    expect(formatWib(new Date('2026-11-07T03:00:00Z'))).toBe(
      'Sab, 07 Nov 2026 10:00 WIB',
    );
    expect(formatWib(new Date('2026-10-30T17:30:00Z'))).toBe(
      'Sab, 31 Okt 2026 00:30 WIB',
    );
  });
});

describe('isExcludedOwner', () => {
  const def = parseExcludeList(undefined);

  it.each([
    [{ isAdmin: true, email: 'real@gmail.com' }],
    [{ email: 'playwright@test.com' }],
    [{ email: 'tester@example.com' }],
    [{ email: 'test123@gmail.com' }],
    [{ email: 'admin@x.com' }],
    [{ email: 'undangdongofficial@gmail.com' }],
    [null],
    [undefined],
    [{ email: '' }],
    [{ email: null }],
  ])('excludes %j', (user) => {
    expect(isExcludedOwner(user, def)).toBe(true);
  });

  it('keeps real customers', () => {
    expect(
      isExcludedOwner({ email: 'siskava.62@gmail.com', isAdmin: false }, def),
    ).toBe(false);
  });

  it('honors an explicit env list (and drops the default)', () => {
    const list = parseExcludeList('Foo@Bar.com, someone');
    expect(isExcludedOwner({ email: 'foo@bar.com' }, list)).toBe(true);
    expect(isExcludedOwner({ email: 'FOO@bar.com' }, list)).toBe(true);
    expect(isExcludedOwner({ email: 'someone@anything.com' }, list)).toBe(true);
    expect(isExcludedOwner({ email: 'someone2@gmail.com' }, list)).toBe(false);
    expect(
      isExcludedOwner({ email: 'undangdongofficial@gmail.com' }, list),
    ).toBe(false);
  });
});

describe('selectUpcomingEvents', () => {
  const now = new Date('2026-10-30T17:30:00Z'); // 31 Oct 00:30 WIB
  const excludeList = parseExcludeList(undefined);
  const owner = { email: 'siskava.62@gmail.com', isAdmin: false };

  const base = (
    over: Partial<EventSourceInvitation>,
  ): EventSourceInvitation => ({
    id: 1,
    slug: 'a-b',
    title: 'Title',
    groomName: 'Ali',
    brideName: 'Budi',
    package: 'premium',
    user: owner,
    ...over,
  });

  it('prefers resepsi, then akad, then dateTime column', () => {
    const items = selectUpcomingEvents(
      [
        base({
          id: 1,
          slug: 'r',
          resepsiLocation: { dateTime: '2026-11-07T10:00' },
          akadLocation: { dateTime: '2026-11-07T08:00' },
        }),
        base({
          id: 2,
          slug: 'a',
          akadLocation: { dateTime: '2026-11-01T08:00' },
        }),
        base({ id: 3, slug: 'c', dateTime: new Date('2026-10-31T03:00:00Z') }),
      ],
      { days: 7, now, excludeList },
    );
    const bySlug = Object.fromEntries(items.map((i) => [i.slug, i]));
    expect(bySlug.r.eventType).toBe('resepsi');
    expect(bySlug.r.daysUntil).toBe(7);
    expect(bySlug.r.akadAtWib).toContain('08:00 WIB');
    expect(bySlug.r.resepsiAtWib).toContain('10:00 WIB');
    expect(bySlug.a.eventType).toBe('akad');
    expect(bySlug.a.daysUntil).toBe(1);
    expect(bySlug.c.eventType).toBe('dateTime');
    expect(bySlug.c.daysUntil).toBe(0);
  });

  it('skips no slug, bad date, excluded owner, out-of-range', () => {
    const items = selectUpcomingEvents(
      [
        base({ id: 1, slug: '', dateTime: new Date('2026-11-01T03:00:00Z') }),
        base({ id: 2, slug: 'bad', dateTime: null }),
        base({
          id: 3,
          slug: 'excl',
          dateTime: new Date('2026-11-01T03:00:00Z'),
          user: { email: 'tester@x.com' },
        }),
        base({
          id: 4,
          slug: 'past',
          dateTime: new Date('2026-10-30T03:00:00Z'),
        }),
        base({
          id: 5,
          slug: 'far',
          dateTime: new Date('2026-11-20T03:00:00Z'),
        }),
        base({ id: 6, slug: 'ok', dateTime: new Date('2026-11-01T03:00:00Z') }),
      ],
      { days: 7, now, excludeList },
    );
    expect(items.map((i) => i.slug)).toEqual(['ok']);
  });

  it('sorts by daysUntil then eventAt and builds couple names', () => {
    const items = selectUpcomingEvents(
      [
        base({
          id: 1,
          slug: 'later',
          dateTime: new Date('2026-11-07T03:00:00Z'),
        }),
        base({
          id: 2,
          slug: 'late-day0',
          dateTime: new Date('2026-10-31T09:00:00Z'),
          groomName: null,
          brideName: null,
          coupleName: 'Cinta',
        }),
        base({
          id: 3,
          slug: 'early-day0',
          dateTime: new Date('2026-10-31T01:00:00Z'),
          groomName: null,
          brideName: null,
          coupleName: null,
          title: 'Judul',
        }),
      ],
      { days: 7, now, excludeList },
    );
    expect(items.map((i) => i.slug)).toEqual([
      'early-day0',
      'late-day0',
      'later',
    ]);
    expect(items[0].coupleNames).toBe('Judul');
    expect(items[1].coupleNames).toBe('Cinta');
    expect(items[2].coupleNames).toBe('Ali & Budi');
  });
});

describe('buildDigestMessage', () => {
  const now = new Date('2026-10-30T17:30:00Z');
  const excludeList = parseExcludeList(undefined);
  const mk = (id: number, slug: string, dt: string) => ({
    id,
    slug,
    groomName: 'Ali',
    brideName: 'Budi',
    package: 'premium',
    dateTime: new Date(dt),
    user: { email: 'siskava.62@gmail.com' },
  });
  const items = selectUpcomingEvents(
    [
      mk(1, 'hari-h', '2026-10-31T03:00:00Z'),
      mk(2, 'h-satu', '2026-11-01T03:00:00Z'),
      mk(3, 'h-tujuh', '2026-11-07T03:00:00Z'),
    ],
    { days: 7, now, excludeList },
  );
  const smoke: Record<string, SmokeResult> = {
    'hari-h': { ok: true, status: 200 },
    'h-satu': { ok: false, status: 500 },
    'h-tujuh': { ok: false, status: null, error: 'timeout' },
  };

  it('contains group headers, slugs, urls and smoke states', () => {
    const msg = buildDigestMessage(items, smoke, now);
    expect(msg).toContain('*Hari-H');
    expect(msg).toContain('*H-1');
    expect(msg).toContain('*H-7');
    expect(msg).toContain('https://satuundangan.id/inv/hari-h');
    expect(msg).toContain('h-satu');
    expect(msg).toContain('OK');
    expect(msg).toContain('FAIL (500)');
    expect(msg).toContain('FAIL (timeout)');
    expect(msg).toContain('RSVP & ucapan');
    expect(msg).toContain('SSL');
    expect(msg).toContain('backup DB');
    expect(msg).toContain('deploy besar');
  });

  it('omits empty groups and checklist without H-7', () => {
    const msg = buildDigestMessage(
      items.filter((i) => i.daysUntil === 0),
      smoke,
      now,
    );
    expect(msg).toContain('*Hari-H');
    expect(msg).not.toContain('*H-1');
    expect(msg).not.toContain('*H-7');
    expect(msg).not.toContain('RSVP & ucapan');
    expect(msg).not.toContain('backup DB');
    expect(msg).not.toContain('deploy besar');
  });
});

describe('isLoopbackAddress', () => {
  it('accepts loopback only', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('10.0.0.1')).toBe(false);
    expect(isLoopbackAddress('::ffff:10.0.0.1')).toBe(false);
    expect(isLoopbackAddress('')).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });
});

describe('list parsers', () => {
  it('parseWaNumbers strips non-digits and dedupes', () => {
    expect(parseWaNumbers('+62 812-111, 62812111, , 62813')).toEqual([
      '62812111',
      '62813',
    ]);
    expect(parseWaNumbers(undefined)).toEqual([]);
  });

  it('parseEmailList keeps emails and dedupes', () => {
    expect(parseEmailList(' a@b.com, junk, a@b.com ,c@d.com')).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
    expect(parseEmailList(undefined)).toEqual([]);
  });
});
