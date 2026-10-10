import { NextRequest, NextResponse } from 'next/server';
import { tiktokPixelInlineScript } from '@/lib/tiktok-pixel-script';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';

function isSetup(url: URL) {
  const value = url.searchParams.get('setup') ?? url.searchParams.get('builder') ?? url.searchParams.get('event_builder');
  return value === '1' || value === 'true' || value === 'yes';
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
}

function safeTarget(value: string) {
  try {
    const target = new URL(value);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
    return target.toString();
  } catch {
    return null;
  }
}

function inactivePage() {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>الرابط غير متاح</title></head><body style="font-family:Tahoma,Arial,sans-serif;text-align:center;padding:3rem 1rem"><h1>الرابط غير متاح حالياً</h1><p>سيعود للعمل بعد إعادة تفعيل الاشتراك.</p></body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const url = new URL(request.url);

  if (isSetup(url)) {
    const configRes = await fetch(`${API_URL}/api/tiktok-integration/public/pixel-config/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null);
    const config = configRes?.ok ? await configRes.json() as { configured?: boolean; pixelCode?: string | null } : null;
    const pixel = config?.configured && config.pixelCode ? tiktokPixelInlineScript(config.pixelCode, []) : '';
    const html = `<!DOCTYPE html><html lang="ar"><head><meta charset="utf-8"><title>TikTok Pixel</title>${pixel ? `<script>${pixel}</script>` : ''}</head><body style="font-family:Tahoma,Arial,sans-serif;padding:2rem">${pixel ? `TikTok Pixel ${config?.pixelCode} نشط. يمكن استخدام Event Builder.` : 'إعداد البكسل غير موجود.'}</body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  // مسار سريع: استخدم تحويل API المباشر (302) بدل JSON ثم إعادة توجيه
  const apiRedirect = new URL(`${API_URL}/r/${encodeURIComponent(slug)}`);
  url.searchParams.forEach((value, key) => apiRedirect.searchParams.append(key, value));
  const proxied = await fetch(apiRedirect, {
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      'x-forwarded-for': clientIp(request),
      'user-agent': request.headers.get('user-agent') ?? '',
    },
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);

  if (proxied) {
    const location = proxied.headers.get('location');
    if (location && (proxied.status === 301 || proxied.status === 302 || proxied.status === 307 || proxied.status === 308)) {
      const target = safeTarget(location);
      if (target) {
        const response = NextResponse.redirect(target, 302);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
    }
    if (proxied.status === 403) return inactivePage();
  }

  return inactivePage();
}
