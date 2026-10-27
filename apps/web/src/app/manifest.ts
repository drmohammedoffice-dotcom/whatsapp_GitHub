import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ChatLoora',
    short_name: 'ChatLoora',
    description: 'منصة جات لورا لإعلانات تيك توك وتتبع محادثات واتساب.',
    // /dashboard redirects into the app; unauthenticated visitors are sent to /login by AuthGuard.
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F8F7FC',
    theme_color: '#7C3AED',
    lang: 'ar',
    dir: 'rtl',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
