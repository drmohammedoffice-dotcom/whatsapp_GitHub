import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { THEME_INIT_SCRIPT } from '@/components/providers/theme-config';
import { FacebookSdkLoader } from '@/components/integrations/facebook-sdk-loader';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
  preload: true,
});

/*
 * Font stacks for the two UI directions. next/font gives "Face, Face Fallback";
 * the generated fallbacks are local Arial without a unicode-range, so they are
 * split off and placed after both real faces — otherwise Noto's fallback would
 * capture Latin text before Inter. Noto Sans Arabic only covers Arabic code
 * points, so Latin text and digits always render in Inter (or its fallback).
 */
const splitFamilies = (stack: string) =>
  stack
    .split(',')
    .map((family) => family.trim())
    .filter(Boolean);
const [interFace, ...interFallbacks] = splitFamilies(inter.style.fontFamily);
const [arabicFace] = splitFamilies(notoArabic.style.fontFamily);
const ARABIC_FALLBACK = "'ChatLoora Arabic Fallback'"; // @font-face in globals.css (Arabic range only)
const SYSTEM_SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif';
const fontStacks = {
  '--font-stack-arabic': [arabicFace, interFace, ARABIC_FALLBACK, ...interFallbacks, SYSTEM_SANS].join(', '),
  '--font-stack-latin': [interFace, arabicFace, ARABIC_FALLBACK, ...interFallbacks, SYSTEM_SANS].join(', '),
} as CSSProperties;

const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'ChatLoora — إعلانات تيك توك وتتبع واتساب',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com'),
  applicationName: 'ChatLoora',
  title: {
    default: 'ChatLoora — TikTok Ads & WhatsApp Tracking',
    template: '%s · ChatLoora',
  },
  description:
    'Run TikTok ads, track conversions from WhatsApp with the TikTok Pixel and Events API, and manage WhatsApp conversations. Start a 3-day free trial.',
  keywords: [
    'ChatLoora',
    'WhatsApp inbox',
    'TikTok Ads WhatsApp',
    'TikTok Pixel',
    'TikTok Events API',
    'صندوق وارد واتساب',
    'إعلانات تيك توك',
  ],
  openGraph: {
    type: 'website',
    locale: 'ar_IQ',
    alternateLocale: ['en_US'],
    siteName: 'ChatLoora',
    title: 'ChatLoora — TikTok Ads & WhatsApp Tracking',
    description:
      'TikTok ads, WhatsApp conversion tracking, and a WhatsApp inbox — grow from every conversation.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatLoora — TikTok Ads & WhatsApp Tracking',
    description: 'TikTok ads and WhatsApp conversion tracking in one place.',
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    title: 'ChatLoora',
    statusBarStyle: 'default',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F7FC' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0B1A' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${inter.variable} ${notoArabic.variable}`}
      style={fontStacks}
      suppressHydrationWarning
    >
      <head>
        {/* Applies `.dark` from the OS preference before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <LocaleProvider>
          <ThemeProvider>
            <TooltipProvider>
              <FacebookSdkLoader />
              {children}
            </TooltipProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
