import { ConfigService } from '@nestjs/config';
import { TikTokMarketingOAuthService } from '../tiktok-marketing-oauth.service';

describe('TikTok Marketing OAuth return origin', () => {
  function makeService(cors: string, webPublic: string) {
    const config = {
      get: (key: string) => (key === 'CORS_ORIGINS' ? cors : key === 'WEB_PUBLIC_URL' ? webPublic : undefined),
      getOrThrow: (key: string) => {
        if (key === 'WEB_PUBLIC_URL') return webPublic;
        throw new Error(key);
      },
    } as unknown as ConfigService;
    return new TikTokMarketingOAuthService(
      {} as any,
      config,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('keeps the browser origin when it is allowed by CORS', () => {
    const svc = makeService(
      'https://almutamayiziq.com,https://www.almutamayiziq.com',
      'https://almutamayiziq.com',
    );
    expect(svc.resolveWebBase('https://www.almutamayiziq.com')).toBe('https://www.almutamayiziq.com');
  });

  it('falls back to WEB_PUBLIC_URL when origin is not allowed', () => {
    const svc = makeService('https://almutamayiziq.com', 'https://almutamayiziq.com');
    expect(svc.resolveWebBase('https://evil.example')).toBe('https://almutamayiziq.com');
  });
});
