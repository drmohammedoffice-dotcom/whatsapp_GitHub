import { readFileSync } from 'fs';
import { join } from 'path';
import { tiktokPixelInlineScript } from '../tiktok-pixel-inline';

describe('Frontend pixel script parity', () => {
  it('web tiktok-pixel-script.ts hard-denies conversion events (source check)', () => {
    const webSrc = readFileSync(
      join(__dirname, '../../../../web/src/lib/tiktok-pixel-script.ts'),
      'utf8',
    );
    expect(webSrc).toContain("BROWSER_SAFE_PIXEL_EVENTS");
    expect(webSrc).toContain('PageView');
    expect(webSrc).toContain('ViewContent');
    expect(webSrc).toContain('InitiateCheckout');
    expect(webSrc).toContain('whitelistBrowserPixelEvents');
    expect(webSrc).not.toMatch(/BROWSER_SAFE_PIXEL_EVENTS = new Set\(\[[^\]]*Purchase/);
  });

  it('activate page source only allows safe browser events', () => {
    const pageSrc = readFileSync(
      join(__dirname, '../../../../web/src/app/tiktok/activate/[pixelId]/page.tsx'),
      'utf8',
    );
    expect(pageSrc).toContain('whitelistBrowserPixelEvents');
    expect(pageSrc).toContain('never fire conversion events');
  });

  it('API + web deny Contact in generated browser script', () => {
    const script = tiktokPixelInlineScript('CODE', ['Contact', 'Lead', 'ViewContent']);
    expect(script).toContain("ttq.track('ViewContent')");
    expect(script).not.toContain("ttq.track('Contact')");
    expect(script).not.toContain("ttq.track('Lead')");
  });
});
