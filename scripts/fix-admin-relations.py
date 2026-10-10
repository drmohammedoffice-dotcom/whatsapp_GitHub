#!/usr/bin/env python3
from pathlib import Path
import re

MAP_USER_FN = """
function mapAdminUser(user: any) {
  return {
    ...user,
    subscriptionsOwned: user.ownedSubscriptions,
    teamMembers: (user.teamMembers ?? []).map((m: any) => ({
      ...m,
      team: {
        ...m.team,
        subscription: m.team?.subscriptions?.[0] ?? m.team?.subscription ?? null,
      },
    })),
  };
}
"""

MAP_WS_FN = """
function mapWorkspace(workspace: any) {
  return {
    ...workspace,
    subscription: workspace?.subscriptions?.[0] ?? workspace?.subscription ?? null,
  };
}
"""

# --- admin-users ---
p = Path('apps/api/src/admin/services/admin-users.service.ts')
s = p.read_text()
s = re.sub(r'@Injectable\(\)\s*\n\s*function mapAdminUser[\s\S]*?\n\}\n\n', '', s)
if 'function mapAdminUser' not in s:
    s = s.replace(
        "import { AdminAuditService } from './admin-audit.service';\n",
        f"import {{ AdminAuditService }} from './admin-audit.service';\n{MAP_USER_FN}\n",
    )
s = s.replace('subscription: { include: { plan: true } },', 'subscriptions: { include: { plan: true }, take: 1 },')
s = s.replace('subscriptionsOwned:', 'ownedSubscriptions:')
if 'users.map(mapAdminUser)' not in s:
    s = s.replace('return { users, total };', 'return { users: users.map(mapAdminUser), total };')
if 'user: mapAdminUser(user)' not in s:
    s = s.replace('return {\n      user,', 'return {\n      user: mapAdminUser(user),')
s = re.sub(r'data: \{ suspendedAt: new Date\(\), suspendedReason:[^}]+\}', 'data: { suspendedAt: new Date() }', s)
s = re.sub(r'data: \{ suspendedAt: null, suspendedReason: null \}', 'data: { suspendedAt: null }', s)
if '@Injectable()\nexport class AdminUsersService' not in s:
    s = s.replace('export class AdminUsersService', '@Injectable()\nexport class AdminUsersService', 1)
p.write_text(s)
print('fixed admin-users')

# --- admin-workspaces ---
p = Path('apps/api/src/admin/services/admin-workspaces.service.ts')
s = p.read_text()
s = re.sub(r'@Injectable\(\)\s*\n\s*function mapWorkspace[\s\S]*?\n\}\n\n', '', s)
if 'function mapWorkspace' not in s:
    s = s.replace(
        "import { AdminAuditService } from './admin-audit.service';\n",
        f"import {{ AdminAuditService }} from './admin-audit.service';\n{MAP_WS_FN}\n",
    )
s = s.replace('subscription: { include: { plan: true } },', 'subscriptions: { include: { plan: true }, take: 1 },')
s = s.replace(
    "subscription: { include: { plan: true, payments: { take: 10, orderBy: { createdAt: 'desc' } } } },",
    "subscriptions: { include: { plan: true, payments: { take: 10, orderBy: { createdAt: 'desc' } } }, take: 1 },",
)
if 'workspaces.map(mapWorkspace)' not in s:
    s = s.replace('return { workspaces, total };', 'return { workspaces: workspaces.map(mapWorkspace), total };')
    s = s.replace(
        'return { workspace, stats: { conversationCount, messageCount } };',
        'return { workspace: mapWorkspace(workspace), stats: { conversationCount, messageCount } };',
    )
if '@Injectable()\nexport class AdminWorkspacesService' not in s:
    s = s.replace('export class AdminWorkspacesService', '@Injectable()\nexport class AdminWorkspacesService', 1)
p.write_text(s)
print('fixed admin-workspaces')

# --- admin-analytics ---
p = Path('apps/api/src/admin/services/admin-analytics.service.ts')
s = p.read_text()
s = s.replace('subscription: true,', 'subscriptions: { take: 1 },')
if 'subscriptions?.[0]' not in s:
    s = s.replace(
        'topCustomers: topTeams,',
        'topCustomers: topTeams.map((t) => ({ ...t, subscription: t.subscriptions?.[0] ?? null })),',
    )
p.write_text(s)
print('fixed admin-analytics')
