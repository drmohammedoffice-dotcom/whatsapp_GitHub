import { MessageSquare, type LucideIcon } from 'lucide-react';

export type ChannelSlug = 'whatsapp';

export type ChannelProvider =
  | 'WHATSAPP_BAILEYS'
  | 'WHATSAPP_CLOUD'
  | 'META_MESSENGER'
  | 'META_INSTAGRAM'
  | 'TELEGRAM'
  | 'TELEGRAM_USER';

export type ChannelDefinition = {
  slug: ChannelSlug;
  provider: ChannelProvider;
  connectHref: string;
  inboxHref: string;
  icon: LucideIcon;
  navConnectKey: string;
  navConnectDescKey: string;
  navInboxKey: string;
  navInboxDescKey: string;
  inboxTitleKey: string;
  inboxDescKey: string;
  replyPlaceholderKey: string;
};

export const channelDefinitions: ChannelDefinition[] = [
  {
    slug: 'whatsapp',
    provider: 'WHATSAPP_BAILEYS',
    connectHref: '/whatsapp',
    inboxHref: '/inbox/whatsapp',
    icon: MessageSquare,
    navConnectKey: 'nav.whatsapp',
    navConnectDescKey: 'nav.whatsappDesc',
    navInboxKey: 'nav.inboxWhatsapp',
    navInboxDescKey: 'nav.inboxWhatsappDesc',
    inboxTitleKey: 'inbox.whatsappTitle',
    inboxDescKey: 'inbox.whatsappDesc',
    replyPlaceholderKey: 'inbox.replyWhatsapp',
  },
];

export const channelBySlug = Object.fromEntries(
  channelDefinitions.map((c) => [c.slug, c]),
) as Record<ChannelSlug, ChannelDefinition>;

export const defaultInboxHref = '/inbox/whatsapp';
