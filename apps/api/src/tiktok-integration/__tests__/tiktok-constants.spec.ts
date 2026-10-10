import { contactRetryDelayMs, TIKTOK_CONTACT_MAX_RETRIES, sanitizeTtclid, buildConversionTrackingUrl } from '../tiktok-integration.constants';

describe('tiktok-integration.constants', () => {
  it('exports Contact-first conversion tracking URL with ttclid and campaign macros', () => {
    const url = buildConversionTrackingUrl('https://app.test/', 'myslug', 'Contact');
    expect(url).toContain('/r/myslug');
    expect(url).toContain('event=Contact');
    expect(url).toContain('ttclid=__CLICKID__');
    expect(url).toContain('campaign_id=__CAMPAIGN_ID__');
    expect(url).toContain('adgroup_id=__AID__');
    expect(url).toContain('ad_id=__CID__');
  });

  it('caps retries at 5 with exponential backoff', () => {
    expect(TIKTOK_CONTACT_MAX_RETRIES).toBe(5);
    const delays = [1, 2, 3, 4, 5].map(contactRetryDelayMs);
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[4]).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('sanitizes fake click ids', () => {
    expect(sanitizeTtclid(null)).toBeNull();
    expect(sanitizeTtclid('  ')).toBeNull();
    expect(sanitizeTtclid('__CLICK_ID__')).toBeNull();
    expect(sanitizeTtclid('abc123')).toBe('abc123');
  });
});
