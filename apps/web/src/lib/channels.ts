import { Facebook, Instagram, MessageSquare, Send, type LucideIcon } from 'lucide-react';

export type ChannelSlug = 'whatsapp' | 'messenger' | 'instagram' | 'telegram';

export type ChannelProvider = 'WHATSAPP_BAILEYS' | 'META_MESSENGER' | 'META_INSTAGRAM' | 'TELEGRAM';

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
  {
    slug: 'messenger',
    provider: 'META_MESSENGER',
    connectHref: '/messenger',
    inboxHref: '/inbox/messenger',
    icon: Facebook,
    navConnectKey: 'nav.messenger',
    navConnectDescKey: 'nav.messengerDesc',
    navInboxKey: 'nav.inboxMessenger',
    navInboxDescKey: 'nav.inboxMessengerDesc',
    inboxTitleKey: 'inbox.messengerTitle',
    inboxDescKey: 'inbox.messengerDesc',
    replyPlaceholderKey: 'inbox.replyMessenger',
  },
  {
    slug: 'instagram',
    provider: 'META_INSTAGRAM',
    connectHref: '/instagram',
    inboxHref: '/inbox/instagram',
    icon: Instagram,
    navConnectKey: 'nav.instagram',
    navConnectDescKey: 'nav.instagramDesc',
    navInboxKey: 'nav.inboxInstagram',
    navInboxDescKey: 'nav.inboxInstagramDesc',
    inboxTitleKey: 'inbox.instagramTitle',
    inboxDescKey: 'inbox.instagramDesc',
    replyPlaceholderKey: 'inbox.replyInstagram',
  },
  {
    slug: 'telegram',
    provider: 'TELEGRAM',
    connectHref: '/telegram',
    inboxHref: '/inbox/telegram',
    icon: Send,
    navConnectKey: 'nav.telegram',
    navConnectDescKey: 'nav.telegramDesc',
    navInboxKey: 'nav.inboxTelegram',
    navInboxDescKey: 'nav.inboxTelegramDesc',
    inboxTitleKey: 'inbox.telegramTitle',
    inboxDescKey: 'inbox.telegramDesc',
    replyPlaceholderKey: 'inbox.replyTelegram',
  },
];

export const channelBySlug = Object.fromEntries(
  channelDefinitions.map((c) => [c.slug, c]),
) as Record<ChannelSlug, ChannelDefinition>;

export const defaultInboxHref = '/inbox/whatsapp';
