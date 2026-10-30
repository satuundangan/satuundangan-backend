import { attributionLabel, buildFunnel, classifyPayment, deriveInsights, isVerifiedPaid, qualityAlerts, reconcilePurchases } from './analytics-logic';

const NOW = new Date('2026-10-29T05:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const pay = (over: Record<string, any> = {}) => ({
  id: 1, orderId: 'INV-1-1', invitationId: 1, amount: 100000, status: 'success', purpose: 'invitation',
  paymentMethod: 'midtrans', paymentType: 'bank_transfer', settlementTime: daysAgo(1), createdAt: daysAgo(1), ...over,
});

describe('verified purchases', () => {
  it('counts only gateway-settled money', () => {
    expect(isVerifiedPaid(pay())).toBe(true);
    expect(isVerifiedPaid(pay({ paymentType: 'simulation' }))).toBe(false);
    expect(isVerifiedPaid(pay({ paymentType: 'free', paymentMethod: 'FREE_ACTIVATION', amount: 0, orderId: 'FREE-1-1' }))).toBe(false);
    expect(isVerifiedPaid(pay({ amount: 0 }))).toBe(false);
    expect(isVerifiedPaid(pay({ status: 'pending' }))).toBe(false);
    expect(isVerifiedPaid(pay({ status: 'failure' }))).toBe(false);
  });

  it('classifies the excluded kinds so they can be explained', () => {
    expect(classifyPayment(pay({ paymentType: 'simulation' }))).toBe('simulation');
    expect(classifyPayment(pay({ orderId: 'FREE-9-1', paymentType: 'free', amount: 0 }))).toBe('free');
    expect(classifyPayment(pay({ status: 'pending' }))).toBe('pending');
    expect(classifyPayment(pay({ status: 'expire' }))).toBe('failed');
  });
});

describe('funnel', () => {
  const inv = (id: number, ageDays: number, isPublished = false) => ({ id, createdAt: daysAgo(ageDays), isPublished });

  it('counts each invitation once per stage and keeps free and simulated orders out of paid', () => {
    const invitations = [inv(1, 20, true), inv(2, 20), inv(3, 20, true), inv(4, 20)];
    const payments = [
      pay({ id: 1, invitationId: 1 }),
      pay({ id: 2, invitationId: 1, orderId: 'INV-1-2' }), // second paid order, same invitation
      pay({ id: 3, invitationId: 2, status: 'pending', settlementTime: null }),
      pay({ id: 4, invitationId: 3, orderId: 'FREE-3-1', paymentType: 'free', paymentMethod: 'FREE_ACTIVATION', amount: 0 }),
      pay({ id: 5, invitationId: 4, paymentType: 'simulation' }),
    ];
    const { all } = buildFunnel(invitations, payments as any, NOW);
    const byKey = Object.fromEntries(all.stages.map((s) => [s.key, s.count]));
    expect(byKey).toEqual({ draft_created: 4, checkout_started: 2, paid: 1, published: 2 });
    expect(all.freeActivated).toBe(1);
    expect(all.dropoff[0].lost).toBe(2);
  });

  it('separates a mature cohort and explains the immature one', () => {
    const invitations = [inv(1, 30), inv(2, 1)];
    const { cohort, mature } = buildFunnel(invitations, [], NOW);
    expect(cohort).toMatchObject({ size: 2, matureSize: 1, immatureSize: 1 });
    expect(cohort.note).toContain('1 undangan');
    expect(mature.stages[0].count).toBe(1);
  });

  it('does not divide by zero and reports median time to convert', () => {
    expect(buildFunnel([], [], NOW).all.stages[1].rateFromPrevious).toBeNull();
    const created = new Date(NOW.getTime() - 10 * 86_400_000);
    const settled = new Date(created.getTime() + 5 * 3_600_000).toISOString();
    const { all } = buildFunnel([{ id: 1, createdAt: created.toISOString() }], [pay({ settlementTime: settled, createdAt: settled })] as any, NOW);
    expect(all.medianHours.toPaid).toBe(5);
  });
});

describe('purchase reconciliation', () => {
  it('shows backend and GA4 side by side and explains missing deliveries', () => {
    const payments = [
      pay({ id: 1, settlementTime: '2026-10-28T03:00:00Z', ga4PurchaseStatus: 'sent' }),
      pay({ id: 2, orderId: 'INV-2-1', settlementTime: '2026-10-28T04:00:00Z', ga4PurchaseStatus: 'skipped' }),
      pay({ id: 3, orderId: 'FREE-3', paymentType: 'free', amount: 0 }),
      pay({ id: 4, orderId: 'INV-4-1', paymentType: 'simulation' }),
    ];
    const out = reconcilePurchases(payments as any, [{ date: '2026-10-28', purchases: 1, revenue: 100000 }]);
    expect(out.backend).toEqual({ orders: 2, revenue: 200000 });
    expect(out.excluded).toMatchObject({ free: 1, simulation: 1 });
    expect(out.daily[0]).toMatchObject({ backendOrders: 2, ga4Purchases: 1, orderDifference: -1, revenueDifference: -100000 });
    expect(out.dispatch).toMatchObject({ sent: 1, skipped: 1 });
    expect(out.explanations.join(' ')).toContain('GA client id');
  });

  it('leaves GA4 values null when GA4 is not connected instead of inventing zero', () => {
    const out = reconcilePurchases([pay({ settlementTime: '2026-10-28T03:00:00Z' })] as any, null);
    expect(out.daily[0].ga4Purchases).toBeNull();
    expect(out.daily[0].orderDifference).toBeNull();
  });
});

describe('attribution', () => {
  it('keeps unknown as unknown and never credits login or gateway domains', () => {
    expect(attributionLabel(pay())).toBe('unknown');
    expect(attributionLabel(pay({ acquisition: { source: 'accounts.google.com', medium: 'referral' } }))).toBe('unknown');
    expect(attributionLabel(pay({ acquisition: { source: 'app.midtrans.com' } }))).toBe('unknown');
    expect(attributionLabel(pay({ acquisition: { source: 'Instagram', medium: 'Social' } }))).toBe('instagram / social');
    expect(attributionLabel(pay({ acquisition: { source: 'newsletter' } }))).toBe('newsletter / (not set)');
  });
});

describe('quality alerts', () => {
  const base = { today: '2026-10-29', trackingValidFrom: '2026-10-29', payments: [] as any[] };

  it('says so when GA4 is not connected rather than reporting a clean bill', () => {
    const { alerts } = qualityAlerts({ ...base, ga4: null });
    expect(alerts.map((a) => a.code)).toContain('ga4_not_connected');
  });

  it('flags a tracking gap, duplicate purchases and unknown sources', () => {
    const { alerts } = qualityAlerts({ ...base, ga4: { lastEventDate: '2026-10-26', sessions: 200, unknownSourceSessions: 150, duplicatePurchaseIds: 2 } });
    const codes = alerts.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(['events_delayed', 'duplicate_purchase', 'unknown_source', 'tracking_valid_from']));
    expect(alerts.find((a) => a.code === 'events_delayed')!.level).toBe('critical');
  });

  it('reports purchase coverage and warns below 90 percent', () => {
    const payments = [pay({ id: 1, ga4PurchaseStatus: 'sent' }), pay({ id: 2, orderId: 'b', ga4PurchaseStatus: 'skipped' })];
    const out = qualityAlerts({ ...base, ga4: { lastEventDate: '2026-10-29', sessions: 10, unknownSourceSessions: 0, duplicatePurchaseIds: 0 }, payments: payments as any });
    expect(out.purchaseCoverage).toEqual({ percent: 50, sent: 1, verified: 2 });
    expect(out.alerts.map((a) => a.code)).toContain('purchase_coverage');
  });

  it('never invents history: always states the tracking start date', () => {
    expect(qualityAlerts({ ...base, ga4: null }).alerts.some((a) => a.message.includes('2026-10-29'))).toBe(true);
  });
});

describe('insights', () => {
  const funnel = null;

  it('stays silent on small samples', () => {
    expect(deriveInsights({ channels: [{ channel: 'ig', sessions: 30, paidOrders: 0 }], devices: [{ device: 'mobile', sessions: 20, engagementRate: 0.2 }, { device: 'desktop', sessions: 20, engagementRate: 0.8 }], landingPages: [], funnel })).toEqual([]);
  });

  it('flags a busy channel that rarely converts, relative to the site itself, and labels the cause a hypothesis', () => {
    const out = deriveInsights({
      channels: [{ channel: 'google', sessions: 400, paidOrders: 20 }, { channel: 'instagram', sessions: 600, paidOrders: 1 }],
      devices: [], landingPages: [], funnel,
    });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('channel_low_paid');
    expect(out[0].hypothesis).toMatch(/Dugaan/);
    expect(out[0].sample).toMatchObject({ sessions: 600, paidOrders: 1 });
  });

  it('flags mobile drop-off only with enough sessions on both sides', () => {
    const out = deriveInsights({ channels: [], devices: [{ device: 'mobile', sessions: 300, engagementRate: 0.4 }, { device: 'desktop', sessions: 200, engagementRate: 0.7 }], landingPages: [], funnel });
    expect(out.map((i) => i.kind)).toEqual(['mobile_dropoff']);
  });

  it('flags a weak landing page against the site average', () => {
    const out = deriveInsights({ channels: [], devices: [], landingPages: [{ page: '/a', sessions: 300, engagementRate: 0.7 }, { page: '/b', sessions: 100, engagementRate: 0.3 }], funnel });
    expect(out.map((i) => i.kind)).toEqual(['landing_low_engagement']);
    expect(out[0].title).toContain('/b');
  });
});
