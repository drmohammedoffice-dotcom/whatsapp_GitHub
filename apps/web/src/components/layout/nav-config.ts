import {
  BarChart3,
  Bot,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Megaphone,
  Handshake,
  Palette,
  Settings,
  Share2,
  Store,
  Target,
  UserRound,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import type { BrandKey } from '@/components/channels/channel-brand-icon';

export type NavItem = {
  href: string;
  labelKey: string;
  descKey: string;
  icon?: LucideIcon;
  brand?: BrandKey;
  featured?: boolean;
  badgeKey?: string | null;
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.messages',
    items: [
      {
        href: '/inbox/whatsapp',
        labelKey: 'nav.whatsapp',
        descKey: 'nav.inboxWhatsappDesc',
        brand: 'whatsapp',
        featured: true,
      },
      {
        href: '/inbox/messenger',
        labelKey: 'nav.messenger',
        descKey: 'nav.inboxMessengerDesc',
        brand: 'messenger',
      },
      {
        href: '/inbox/instagram',
        labelKey: 'nav.instagram',
        descKey: 'nav.inboxInstagramDesc',
        brand: 'instagram',
      },
      {
        href: '/inbox/telegram',
        labelKey: 'nav.telegram',
        descKey: 'nav.inboxTelegramDesc',
        brand: 'telegram',
      },
      {
        href: '/inbox/social',
        labelKey: 'nav.socialInbox',
        descKey: 'nav.socialInboxDesc',
        brand: 'social',
      },
    ],
  },
  {
    labelKey: 'nav.connectAccounts',
    items: [
      {
        href: '/connect',
        labelKey: 'nav.socialConnectHub',
        descKey: 'nav.socialConnectHubDesc',
        icon: Share2,
        featured: true,
      },
    ],
  },
  {
    labelKey: 'nav.workspace',
    items: [
      { href: '/bookings', labelKey: 'nav.bookings', descKey: 'nav.bookingsDesc', icon: ClipboardList },
      { href: '/appointments', labelKey: 'nav.appointments', descKey: 'nav.appointmentsDesc', icon: CalendarClock },
    ],
  },
  {
    labelKey: 'nav.team',
    items: [
      { href: '/agents', labelKey: 'nav.agents', descKey: 'nav.agentsDesc', icon: UserRoundCog },
      { href: '/analytics', labelKey: 'nav.analytics', descKey: 'nav.analyticsDesc', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'nav.intelligence',
    items: [
      { href: '/ai', labelKey: 'nav.ai', descKey: 'nav.aiDesc', icon: Bot, badgeKey: 'common.new' },
      { href: '/ai/store', labelKey: 'nav.store', descKey: 'nav.storeDesc', icon: Store, featured: true, badgeKey: 'common.new' },
      { href: '/ai/creative', labelKey: 'nav.creative', descKey: 'nav.creativeDesc', icon: Palette, featured: true, badgeKey: 'common.new' },
      { href: '/tiktok', labelKey: 'nav.tiktok', descKey: 'nav.tiktokDesc', icon: Share2 },
      { href: '/tiktok/integration', labelKey: 'nav.tiktokPixelWizard', descKey: 'nav.tiktokPixelWizardDesc', icon: Target },
      { href: '/tiktok/integration/forms/orders', labelKey: 'nav.tiktokOrders', descKey: 'nav.tiktokOrdersDesc', icon: ClipboardList },
      { href: '/tiktok/ads/create', labelKey: 'nav.tiktokCreateAd', descKey: 'nav.tiktokCreateAdDesc', icon: Megaphone },
      { href: '/success-partner', labelKey: 'nav.successPartner', descKey: 'nav.successPartnerDesc', icon: Handshake },
    ],
  },
  {
    labelKey: 'nav.system',
    items: [
      { href: '/settings/integrations', labelKey: 'nav.integrations', descKey: 'nav.integrationsDesc', icon: Share2 },
      { href: '/plans', labelKey: 'nav.plans', descKey: 'nav.plansDesc', icon: CreditCard },
      { href: '/account', labelKey: 'nav.account', descKey: 'nav.accountDesc', icon: UserRound },
      { href: '/settings', labelKey: 'nav.settings', descKey: 'nav.settingsDesc', icon: Settings },
    ],
  },
];

export const socialConnectItems: NavItem[] = [
  { href: '/whatsapp', labelKey: 'nav.whatsappConnect', descKey: 'nav.whatsappDesc', brand: 'whatsapp' },
  { href: '/messenger', labelKey: 'nav.messengerConnect', descKey: 'nav.messengerDesc', brand: 'messenger' },
  { href: '/instagram', labelKey: 'nav.instagramConnect', descKey: 'nav.instagramDesc', brand: 'instagram' },
  { href: '/telegram', labelKey: 'nav.telegramConnect', descKey: 'nav.telegramDesc', brand: 'telegram' },
];

export const allNavItems = [...navGroups.flatMap((group) => group.items), ...socialConnectItems];

const HIDDEN_NAV_HREFS = new Set([
  '/inbox/whatsapp',
  '/inbox/messenger',
  '/inbox/instagram',
  '/inbox/telegram',
  '/inbox/social',
  '/connect',
  '/bookings',
  '/appointments',
  '/agents',
  '/analytics',
]);

const ADMIN_ONLY_NAV_HREFS = new Set(['/ai', '/ai/store', '/ai/creative']);

export function visibleNavGroups(isPlatformAdmin: boolean) {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (HIDDEN_NAV_HREFS.has(item.href)) return false;
        if (ADMIN_ONLY_NAV_HREFS.has(item.href) && !isPlatformAdmin) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !allNavItems.some(
    (other) =>
      other.href !== href &&
      other.href.startsWith(`${href}/`) &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
}

export function getNavItem(pathname: string): NavItem | undefined {
  return allNavItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
