import { sanitizeAnalyticsContext } from './payment.controller';

describe('sanitizeAnalyticsContext', () => {
  it('accepts a well-formed GA client id and campaign data', () => {
    expect(sanitizeAnalyticsContext('1234567890.1699999999', { source: 'instagram', medium: 'social', campaign: 'promo-oktober' })).toEqual({
      gaClientId: '1234567890.1699999999',
      acquisition: { source: 'instagram', medium: 'social', campaign: 'promo-oktober' },
    });
  });

  it('drops malformed or hostile values instead of storing them', () => {
    const out = sanitizeAnalyticsContext("<script>alert(1)</script>", { source: '<img src=x onerror=1>', medium: 'x'.repeat(200), campaign: 42, extra: 'ignored' });
    expect(out).toEqual({ gaClientId: null, acquisition: null });
  });

  it('keeps a partial acquisition and tolerates missing input', () => {
    expect(sanitizeAnalyticsContext(undefined, { source: 'newsletter' })).toEqual({ gaClientId: null, acquisition: { source: 'newsletter' } });
    expect(sanitizeAnalyticsContext(undefined, undefined)).toEqual({ gaClientId: null, acquisition: null });
    expect(sanitizeAnalyticsContext(12345, [])).toEqual({ gaClientId: null, acquisition: null });
  });
});
