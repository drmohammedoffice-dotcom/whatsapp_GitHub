'use client';

export function ActivateClient({ pixelId }: { pixelId: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-xs text-gray-400">
      {pixelId ? 'TikTok Pixel active on this page.' : 'Missing pixel ID.'}
    </div>
  );
}
