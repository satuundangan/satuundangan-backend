import axios from 'axios';
import { generateKeyPairSync } from 'crypto';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

jest.mock('axios');
const post = axios.post as jest.Mock;
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const configured = { GA4_PROPERTY_ID: '123456', GA4_SERVICE_ACCOUNT_EMAIL: 'analytics-reader@test-project.iam.gserviceaccount.com', GA4_PRIVATE_KEY: privateKey };
const config = (values: Record<string, string> = {}) => ({ get: (key: string) => values[key] }) as any;

function response(body: any) {
  const metrics = body.metrics.map((m: any) => ({ name: m.name }));
  const dimensions = (body.dimensions || []).map((d: any) => ({ name: d.name }));
  const names: Record<string, string> = { date: '20261020', sessionDefaultChannelGroup: 'Organic Search', deviceCategory: 'mobile', landingPage: '/blog/:slug' };
  return { data: { dimensionHeaders: dimensions, metricHeaders: metrics, rows: [{ dimensionValues: dimensions.map((d: any) => ({ value: names[d.name] || 'value' })), metricValues: metrics.map(() => ({ value: '10' })) }], rowCount: 1, metadata: { timeZone: 'Asia/Jakarta' } } };
}

describe('read-only admin GA4 reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    post.mockImplementation((url, body) => url.includes('oauth2.googleapis.com') ? Promise.resolve({ data: { access_token: 'test-access-token', expires_in: 3600 } }) : Promise.resolve(response(body)));
  });

  it('returns not_connected with missing field names and never fabricated metrics', async () => {
    const result = await new AdminAnalyticsService(config()).getReport({ days: 7 });
    expect(result.status).toBe('not_connected');
    expect(result).not.toHaveProperty('reports');
    expect(result.missingConfiguration).toContain('GA4_PROPERTY_ID');
    expect(post).not.toHaveBeenCalled();
  });

  it('requires a numeric property ID and paired valid dates before requesting data', async () => {
    const service = new AdminAnalyticsService(config({ ...configured, GA4_PROPERTY_ID: '123/other' }));
    expect((await service.getReport({ days: 7 })).status).toBe('not_connected');
    await expect(service.getReport({ startDate: '2026-02-30', endDate: '2026-03-02' })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it('uses fixed Google endpoints, read-only scope and filters marketing hosts/paths', async () => {
    const result = await new AdminAnalyticsService(config(configured)).getReport({ startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(result.status).toBe('ready');
    expect(result.period.propertyTimeZone).toBe('Asia/Jakarta');
    const [tokenUrl, tokenBody] = post.mock.calls[0];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    const assertion = new URLSearchParams(tokenBody).get('assertion')!;
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
    expect(claims.scope).toBe('https://www.googleapis.com/auth/analytics.readonly');
    const requests = post.mock.calls.slice(1);
    expect(requests).toHaveLength(6);
    for (const [url, body] of requests) {
      expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport');
      expect(JSON.stringify(body.dimensionFilter)).toContain('hostName');
      expect(JSON.stringify(body.dimensionFilter)).toContain('pagePath');
      expect(JSON.stringify(body.dimensionFilter)).not.toContain('customEvent');
    }
    expect(JSON.stringify(result)).not.toContain(privateKey);
    expect(JSON.stringify(result)).not.toContain('test-access-token');
  });

  it('caches a complete report and does not call Google for the same period repeatedly', async () => {
    const service = new AdminAnalyticsService(config(configured));
    await service.getReport({ startDate: '2026-10-20', endDate: '2026-10-20' });
    const second = await service.getReport({ startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(post).toHaveBeenCalledTimes(7);
    expect(second.cache.hit).toBe(true);
  });

  it('keeps provider failure distinct from zero without exposing provider errors or credentials', async () => {
    post.mockRejectedValue(new Error('private key ' + privateKey + ' token=test-access-token'));
    const result = await new AdminAnalyticsService(config(configured)).getReport({ days: 7 });
    expect(result.status).toBe('error');
    expect(result).not.toHaveProperty('reports');
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE KEY|test-access-token/);
  });

  it('keeps an empty or thresholded provider result explicit and reports timezone differences', async () => {
    post.mockImplementation((url) => url.includes('oauth2.googleapis.com') ? Promise.resolve({ data: { access_token: 'test', expires_in: 3600 } }) : Promise.resolve({ data: { rows: [], metadata: { timeZone: 'America/Los_Angeles', subjectToThresholding: true, emptyReason: 'thresholding' } } }));
    const result = await new AdminAnalyticsService(config(configured)).getReport({ startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(result.status).toBe('no_data');
    expect(result.reports.summary.current).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/zona|threshold/i);
  });

  it('protects the route with both existing auth guards', () => {
    expect(Reflect.getMetadata('__guards__', AdminAnalyticsController)).toEqual([JwtAuthGuard, AdminGuard]);
  });
});
