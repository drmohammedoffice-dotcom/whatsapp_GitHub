import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, SUB_COOKIE } from '@/lib/subscription-cookie';
import { isSubscriptionProtectedPath } from '@/lib/subscription-routes';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  if (subCookie === 'inactive') {
    const pricingUrl = request.nextUrl.clone();
    pricingUrl.pathname = '/plans';
    return NextResponse.redirect(pricingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/pricing',
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
