import {
  ClipboardList,
  CreditCard,
  Mail,
  Megaphone,
  Settings,
  Share2,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { BrandKey } from '@/components/channels/channel-brand-icon';
import { MOBILE_APP_HIDDEN_NAV_HREFS } from '@/lib/app-mode';

export type NavItem = {
  href: string;
  labelKey: string;
  descKey: string;
  /** Description used inside the native app (no subscription/billing wording). */
  appDescKey?: string;
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
        labelKey: 'nav.inboxWhatsapp',
        descKey: 'nav.inboxWhatsappDesc',
        brand: 'whatsapp',
        featured: true,
      },
    ],
  },
  {
    labelKey: 'nav.tiktokTracking',
    items: [
      { href: '/tiktok', labelKey: 'nav.tiktok', descKey: 'nav.tiktokDesc', icon: Share2 },
      { href: '/tiktok/integration', labelKey: 'nav.tiktokPixelWizard', descKey: 'nav.tiktokPixelWizardDesc', icon: Target },
      {
        href: '/tiktok/integration/phones',
        labelKey: 'nav.tiktokTrackingPhones',
        descKey: 'nav.tiktokTrackingPhonesDesc',
        brand: 'whatsapp',
      },
      { href: '/tiktok/integration/forms/orders', labelKey: 'nav.tiktokOrders', descKey: 'nav.tiktokOrdersDesc', icon: ClipboardList },
      { href: '/tiktok/ads/create', labelKey: 'nav.tiktokCreateAd', descKey: 'nav.tiktokCreateAdDesc', icon: Megaphone },
      { href: '/tiktok/ads/balance', labelKey: 'nav.tiktokAdsBalance', descKey: 'nav.tiktokAdsBalanceDesc', icon: CreditCard },
    ],
  },
  {
    labelKey: 'nav.mail',
    items: [{ href: '/mail', labelKey: 'nav.webmail', descKey: 'nav.webmailDesc', icon: Mail }],
  },
  {
    labelKey: 'nav.system',
    items: [
      { href: '/plans', labelKey: 'nav.plans', descKey: 'nav.plansDesc', icon: CreditCard },
      { href: '/account', labelKey: 'nav.account', descKey: 'nav.accountDesc', appDescKey: 'nav.accountDescApp', icon: UserRound },
      { href: '/settings', labelKey: 'nav.settings', descKey: 'nav.settingsDesc', icon: Settings },
    ],
  },
];

export const allNavItems = navGroups.flatMap((group) => group.items);

const HIDDEN_NAV_HREFS = new Set(['/settings/integrations']);

/** `mobileApp`: inside the native app, hide plans / pricing / billing / ad-balance top-up entries. */
export function visibleNavGroups(options?: { mobileApp?: boolean }) {
  const mobileApp = options?.mobileApp ?? false;
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !HIDDEN_NAV_HREFS.has(item.href) && !(mobileApp && MOBILE_APP_HIDDEN_NAV_HREFS.has(item.href)),
      ),
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
