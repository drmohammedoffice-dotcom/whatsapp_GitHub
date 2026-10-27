import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isMobileAppBlockedPath, isMobileAppUserAgent } from '@/lib/app-mode';
import { AUTH_COOKIE, SUB_COOKIE } from '@/lib/subscription-cookie';
import { isSubscriptionProtectedPath } from '@/lib/subscription-routes';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isMobileApp = isMobileAppUserAgent(request.headers.get('user-agent'));

  // Native app (App Store / Google Play): no plans, pricing, checkout or ad-balance top-up pages.
  if (isMobileApp && isMobileAppBlockedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const isAuthenticated = request.cookies.get(AUTH_COOKIE)?.value === '1';
  const subCookie = request.cookies.get(SUB_COOKIE)?.value;

  // Logged-in subscribers must still open /pricing to upgrade or change plans.

  if (!isSubscriptionProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.next();
  }

  // Only block when cookie explicitly says inactive — missing cookie is synced client-side.
  // Inside the native app there is no plans page to send the user to; the client shows a
  // neutral "contact support" notice instead (avoids a /plans <-> /dashboard redirect loop).
  if (subCookie === 'inactive' && !isMobileApp) {
    const pricingUrl = request.nextUrl.clone();
    pricingUrl.pathname = '/plans';
    return NextResponse.redirect(pricingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/pricing',
    '/pricing/:path*',
    '/dashboard/:path*',
    '/conversations/:path*',
    '/contacts/:path*',
    '/settings/:path*',
    '/integrations/:path*',
    '/inbox/:path*',
    '/bookings/:path*',
    '/ai/:path*',
    '/customers/:path*',
    '/tiktok/:path*',
    '/whatsapp/:path*',
    '/plans/:path*',
    '/plans',
  ],
};
