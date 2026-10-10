import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/inbox', '/dashboard', '/settings'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
