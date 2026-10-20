import { Camera, MessageCircle, MessageSquare, Send, Share2, type LucideIcon } from 'lucide-react';

export type AiTrainingPlatform = 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM' | 'TIKTOK';

export type AiPlatformSlug = 'whatsapp' | 'telegram' | 'messenger' | 'instagram' | 'tiktok';

export type AiPlatformDefinition = {
  slug: AiPlatformSlug;
  platform: AiTrainingPlatform;
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
  trainingHref: string;
};

export const aiPlatformDefinitions: AiPlatformDefinition[] = [
  {
    slug: 'whatsapp',
    platform: 'WHATSAPP',
    icon: MessageSquare,
    labelKey: 'ai.platformWhatsapp',
    descKey: 'ai.platformWhatsappDesc',
    trainingHref: '/ai/whatsapp',
  },
  {
    slug: 'telegram',
    platform: 'TELEGRAM',
    icon: Send,
    labelKey: 'ai.platformTelegram',
    descKey: 'ai.platformTelegramDesc',
    trainingHref: '/ai/telegram',
  },
  {
    slug: 'messenger',
    platform: 'MESSENGER',
    icon: MessageCircle,
    labelKey: 'ai.platformMessenger',
    descKey: 'ai.platformMessengerDesc',
    trainingHref: '/ai/messenger',
  },
  {
    slug: 'instagram',
    platform: 'INSTAGRAM',
    icon: Camera,
    labelKey: 'ai.platformInstagram',
    descKey: 'ai.platformInstagramDesc',
    trainingHref: '/ai/instagram',
  },
  {
    slug: 'tiktok',
    platform: 'TIKTOK',
    icon: Share2,
    labelKey: 'ai.platformTiktok',
    descKey: 'ai.platformTiktokDesc',
    trainingHref: '/ai/tiktok',
  },
];

const slugByPlatform = Object.fromEntries(aiPlatformDefinitions.map((item) => [item.slug, item])) as Record<
  AiPlatformSlug,
  AiPlatformDefinition
>;

/** @deprecated use messenger */
export const legacyMetaSlug = 'meta';

export function getAiPlatformBySlug(slug: string): AiPlatformDefinition | undefined {
  if (slug === legacyMetaSlug) return slugByPlatform.messenger;
  return slugByPlatform[slug as AiPlatformSlug];
}

export function isAiPlatformSlug(slug: string): slug is AiPlatformSlug {
  return slug in slugByPlatform || slug === legacyMetaSlug;
}
