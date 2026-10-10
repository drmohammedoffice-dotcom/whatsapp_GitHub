import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { tiktokPixelInlineScript } from './tiktok-pixel-inline';
import { TikTokIntegrationTrackingService } from './tiktok-integration-tracking.service';

@ApiTags('TikTok Integration Public')
@Controller()
export class TikTokIntegrationPublicController {
  constructor(private readonly tracking: TikTokIntegrationTrackingService) {}

  @Get('r/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'TikTok Pixel landing — base code + WhatsApp CTA (Events API conversion on real message)' })
  async redirect(
    @Param('slug') slug: string,
    @Query('ttclid') ttclid: string | undefined,
    @Query('clickid') clickid: string | undefined,
    @Query('CLICKID') clickIdUpper: string | undefined,
    @Query('campaign_id') campaignId: string | undefined,
    @Query('adgroup_id') adgroupId: string | undefined,
    @Query('ad_id') adId: string | undefined,
    @Query('advertiser_id') advertiserId: string | undefined,
    @Query('setup') setup: string | undefined,
    @Query('builder') builder: string | undefined,
    @Query('event_builder') eventBuilder: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const setupMode =
      setup === '1' || setup === 'true' || builder === '1' || eventBuilder === '1';

    let pixelCode: string | null = null;
    let whatsappUrl = 'https://wa.me/';
    let externalDestination = false;

    if (setupMode) {
      const config = await this.tracking.getPixelConfig(slug);
      pixelCode = config?.pixelCode ?? null;
      if (!config) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).send(this.renderInactiveLandingHtml());
      }
    } else {
      const result = await this.tracking.handleRedirect({
        slug,
        ttclid: ttclid ?? clickid ?? clickIdUpper,
        campaignId,
        adgroupId,
        adId,
        advertiserId,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      if (result.subscriptionExpired || result.active === false || !result.redirectUrl) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).send(this.renderInactiveLandingHtml());
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, result.redirectUrl);
    }

    const pixelScript = pixelCode ? tiktokPixelInlineScript(pixelCode, []) : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(
      this.renderWhatsAppLandingHtml({
        whatsappUrl,
        pixelScript,
        setupMode,
        externalDestination,
      }),
    );
  }

  @Get('api/tiktok-integration/public/pixel-config/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public pixel config for SSR landing pages (no tracking)' })
  async pixelConfig(@Param('slug') slug: string) {
    const config = await this.tracking.getPixelConfig(slug);
    if (!config) return { configured: false };
    return { configured: true, ...config };
  }

  @Get('api/tiktok-integration/public/track/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Track click server-side and return WhatsApp redirect payload' })
  async track(
    @Param('slug') slug: string,
    @Query('ttclid') ttclid: string | undefined,
    @Query('clickid') clickid: string | undefined,
    @Query('CLICKID') clickIdUpper: string | undefined,
    @Query('campaign_id') campaignId: string | undefined,
    @Query('adgroup_id') adgroupId: string | undefined,
    @Query('ad_id') adId: string | undefined,
    @Query('advertiser_id') advertiserId: string | undefined,
    @Req() req: Request,
  ) {
    return this.tracking.getTrackPayload({
      slug,
      ttclid: ttclid ?? clickid ?? clickIdUpper,
      campaignId,
      adgroupId,
      adId,
      advertiserId,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  private renderInactiveLandingHtml() {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>الرابط غير متاح</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: Tahoma, Arial, sans-serif; color: #fff; text-align: center;
      background: radial-gradient(120% 80% at 50% -10%, #3a3a3a 0%, #1f1f1f 55%, #0d0d0d 100%);
      padding: 2rem 1.25rem;
    }
    .card { max-width: 26rem; width: 100%; }
    h1 { margin: 0 0 .75rem; font-size: clamp(1.5rem, 4vw, 2rem); }
    p { margin: 0; line-height: 1.7; font-size: 1.05rem; color: rgba(255,255,255,.85); }
  </style>
</head>
<body>
  <main class="card">
    <h1>الرابط غير متاح حالياً</h1>
    <p>تم إيقاف صفحة الهبوط مؤقتاً بسبب انتهاء الاشتراك. ستعود للعمل تلقائياً بعد إعادة تفعيل الباقة.</p>
  </main>
</body>
</html>`;
  }

  private escapeHtmlAttr(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private renderWhatsAppLandingHtml(input: {
    whatsappUrl: string;
    pixelScript: string;
    setupMode: boolean;
    externalDestination: boolean;
  }) {
    const headPixel = input.pixelScript
      ? `<script>${input.pixelScript}</script>`
      : '';

    const safeUrl = this.escapeHtmlAttr(input.whatsappUrl);
    const redirectScript = input.setupMode
      ? ''
      : `<script>setTimeout(function(){location.replace(${JSON.stringify(input.whatsappUrl)});},180);</script>`;
    const ctaBlock = input.setupMode
      ? `<p class="hint setup">تم تفعيل كود TikTok Pixel على هذه الصفحة. يمكنك الآن استخدام Launch Event Builder.<br/>حدث Contact يُرسل عبر Events API بعد أول رسالة واتساب فعلية.</p>`
      : '';

    if (!input.setupMode) {
      return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>واتساب</title>
  <meta http-equiv="refresh" content="1;url=${safeUrl}" />
  ${headPixel}
  ${redirectScript}
  <style>body{margin:0;min-height:100vh;background:#fff}</style>
</head>
<body></body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>واتساب</title>
  ${input.setupMode ? '' : `<meta http-equiv="refresh" content="1;url=${safeUrl}" />`}
  ${headPixel}
  ${redirectScript}
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: Tahoma, Arial, sans-serif; color: #fff; text-align: center;
      background: radial-gradient(120% 80% at 50% -10%, #1faa59 0%, #128c45 38%, #075e54 72%, #041f1a 100%);
      padding: 2rem 1.25rem;
    }
    .card { max-width: 26rem; width: 100%; }
    .logo {
      width: 5.5rem; height: 5.5rem; margin: 0 auto 1.5rem; border-radius: 1.5rem;
      background: #fff; display: grid; place-items: center;
      box-shadow: 0 18px 50px rgba(0,0,0,.28);
    }
    h1 { margin: 0 0 .75rem; font-size: clamp(1.8rem, 5vw, 2.25rem); }
    p { margin: 0 0 1.75rem; line-height: 1.7; font-size: 1.05rem; color: rgba(255,255,255,.92); }
    a.btn {
      display: inline-flex; align-items: center; justify-content: center; gap: .75rem;
      width: 100%; min-height: 3.5rem; border-radius: 1rem; text-decoration: none;
      background: #fff; color: #075e54; font-weight: 700; font-size: 1.1rem;
      box-shadow: 0 14px 35px rgba(0,0,0,.28);
    }
    .hint { margin-top: 1.1rem; font-size: .8rem; color: rgba(255,255,255,.65); line-height: 1.6; }
    .hint.setup { font-size: .85rem; color: rgba(255,255,255,.85); }
  </style>
</head>
<body>
  <main class="card">
    <div class="logo" aria-hidden="true">
      <svg width="54" height="54" viewBox="0 0 32 32">
        <path fill="#25D366" d="M16.02 3C9.4 3 4.03 8.37 4.03 15c0 2.28.64 4.4 1.75 6.22L4 29l7.98-1.72A11.9 11.9 0 0 0 16.02 27C22.64 27 28 21.63 28 15S22.64 3 16.02 3z"/>
        <path fill="#fff" d="M21.7 18.8c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.23 5.14 4.53.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.79-.73 2.04-1.44.25-.71.25-1.32.18-1.44-.08-.12-.28-.2-.58-.35z"/>
      </svg>
    </div>
    <h1>${input.externalDestination ? 'تابع معنا' : 'واتساب'}</h1>
    <p>${input.externalDestination ? 'اضغط على الزر للانتقال إلى الرابط' : 'للطلب اضغط هنا وراسلونا عبر الواتساب'}</p>
    ${ctaBlock}
  </main>
</body>
</html>`;
  }
}
