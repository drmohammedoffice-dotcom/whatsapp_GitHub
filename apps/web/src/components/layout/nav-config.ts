import {
  BarChart3,
  Bot,
  ClipboardList,
  Cpu,
  Inbox,
  Settings,
  Share2,
  UserRoundCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { channelDefinitions } from '@/lib/channels';

export type NavItem = {
  href: string;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
  badgeKey?: string | null;
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    labelKey: 'nav.channels',
    items: channelDefinitions.flatMap((channel) => [
      { href: channel.connectHref, labelKey: channel.navConnectKey, descKey: channel.navConnectDescKey, icon: channel.icon },
      { href: channel.inboxHref, labelKey: channel.navInboxKey, descKey: channel.navInboxDescKey, icon: Inbox },
    ]),
  },
  {
    labelKey: 'nav.workspace',
    items: [
      { href: '/bookings', labelKey: 'nav.bookings', descKey: 'nav.bookingsDesc', icon: ClipboardList },
      { href: '/customers', labelKey: 'nav.customers', descKey: 'nav.customersDesc', icon: Users },
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
      { href: '/ai-providers', labelKey: 'nav.aiProviders', descKey: 'nav.aiProvidersDesc', icon: Cpu },
      { href: '/tiktok', labelKey: 'nav.tiktok', descKey: 'nav.tiktokDesc', icon: Share2 },
    ],
  },
  {
    labelKey: 'nav.system',
    items: [
      { href: '/settings', labelKey: 'nav.settings', descKey: 'nav.settingsDesc', icon: Settings },
    ],
  },
];

export const allNavItems = navGroups.flatMap((group) => group.items);

export function getNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
