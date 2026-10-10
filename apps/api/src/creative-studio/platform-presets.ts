/**
 * Ad platform presets. Constraints change; keep this file as the single source.
 * Values are conservative recommendations, not a guarantee of current platform policy.
 */
export type AdPlatformPreset = {
  id: string;
  label: string;
  aspectRatio: '1:1' | '9:16' | '16:9' | '4:5';
  recommendedDurationSec: { min: number; max: number; default: number };
  resolution: { width: number; height: number };
  safeAreaPct: { top: number; bottom: number; left: number; right: number };
  captions: { recommended: boolean; rtlOk: boolean };
  notes: string;
};

export const AD_PLATFORM_PRESETS: AdPlatformPreset[] = [
  {
    id: 'instagram_feed',
    label: 'Instagram Feed',
    aspectRatio: '1:1',
    recommendedDurationSec: { min: 3, max: 60, default: 15 },
    resolution: { width: 1080, height: 1080 },
    safeAreaPct: { top: 8, bottom: 12, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Square feed. Keep CTA above lower UI chrome.',
  },
  {
    id: 'instagram_story',
    label: 'Instagram Story',
    aspectRatio: '9:16',
    recommendedDurationSec: { min: 3, max: 15, default: 15 },
    resolution: { width: 1080, height: 1920 },
    safeAreaPct: { top: 14, bottom: 20, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Avoid top/bottom UI overlays for stickers and reply bar.',
  },
  {
    id: 'instagram_reels',
    label: 'Instagram Reels',
    aspectRatio: '9:16',
    recommendedDurationSec: { min: 5, max: 90, default: 30 },
    resolution: { width: 1080, height: 1920 },
    safeAreaPct: { top: 12, bottom: 22, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Vertical. Captions should not sit on the right action column.',
  },
  {
    id: 'facebook_feed',
    label: 'Facebook Feed',
    aspectRatio: '1:1',
    recommendedDurationSec: { min: 5, max: 60, default: 15 },
    resolution: { width: 1080, height: 1080 },
    safeAreaPct: { top: 8, bottom: 12, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Square or 4:5 also common; default square for Creative Studio.',
  },
  {
    id: 'facebook_story',
    label: 'Facebook Story',
    aspectRatio: '9:16',
    recommendedDurationSec: { min: 3, max: 15, default: 15 },
    resolution: { width: 1080, height: 1920 },
    safeAreaPct: { top: 14, bottom: 20, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Same safe-area caution as Instagram Stories.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    aspectRatio: '9:16',
    recommendedDurationSec: { min: 5, max: 60, default: 21 },
    resolution: { width: 1080, height: 1920 },
    safeAreaPct: { top: 12, bottom: 24, left: 6, right: 18 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Keep text off the right UI and caption bar.',
  },
  {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    aspectRatio: '9:16',
    recommendedDurationSec: { min: 5, max: 60, default: 30 },
    resolution: { width: 1080, height: 1920 },
    safeAreaPct: { top: 10, bottom: 18, left: 6, right: 6 },
    captions: { recommended: true, rtlOk: true },
    notes: 'Vertical Shorts. Title-safe near top.',
  },
];

export function getAdPlatformPreset(id: string) {
  return AD_PLATFORM_PRESETS.find((row) => row.id === id) || null;
}
