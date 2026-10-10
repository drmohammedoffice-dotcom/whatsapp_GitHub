import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { FacebookSdkLoader } from '@/components/integrations/facebook-sdk-loader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PersistentAssistant } from '@/components/assistant/persistent-assistant';

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com'),
  title: {
    default: 'ChatLoora — AI Customer Conversations Platform',
    template: '%s · ChatLoora',
  },
  description:
    'Manage WhatsApp, Meta, and Telegram conversations with AI replies, TikTok Ads integration, appointments, and team inbox tools. Start a 3-day free trial.',
  keywords: [
    'ChatLoora',
    'WhatsApp inbox',
    'AI customer support',
    'TikTok Ads WhatsApp',
    'clinic AI receptionist',
    'omnichannel messaging',
    'صندوق وارد واتساب',
    'ذكاء اصطناعي للمحادثات',
  ],
  openGraph: {
    type: 'website',
    locale: 'ar_IQ',
    alternateLocale: ['en_US'],
    siteName: 'ChatLoora',
    title: 'ChatLoora — AI Customer Conversations Platform',
    description:
      'Unified inbox, AI replies, TikTok & Meta integrations, and clinic appointments — grow from every conversation.',
    images: [{ url: '/chatloora-logo.png', width: 1200, height: 630, alt: 'ChatLoora' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatLoora — AI Customer Conversations Platform',
    description: 'Manage every customer conversation. Powered by AI.',
    images: ['/chatloora-logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoArabic.variable} font-sans antialiased`}>
        <LocaleProvider>
          <ThemeProvider>
            <TooltipProvider>
              <FacebookSdkLoader />
              {children}
              <PersistentAssistant />
            </TooltipProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
