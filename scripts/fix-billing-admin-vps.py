#!/usr/bin/env python3
"""Fix billing i18n + register Admin/Billing modules on VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

PATCH_APP = """from pathlib import Path
p = Path('apps/api/src/app.module.ts')
s = p.read_text()
changed = False
if 'AdminModule' not in s:
    s = s.replace(
        "import { PlatformModule } from './platform/platform.module';",
        "import { PlatformModule } from './platform/platform.module';\\nimport { AdminModule } from './admin/admin.module';\\nimport { BillingModule } from './billing/billing.module';",
    )
    s = s.replace('PlatformModule,', 'PlatformModule,\\n    AdminModule,\\n    BillingModule,')
    changed = True
if changed:
    p.write_text(s)
    print('Registered AdminModule + BillingModule')
else:
    print('Modules already registered')
"""

SEED_PLANS = """const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const p = new PrismaClient();
const plans = [
  { slug: 'basic', name: 'Basic', description: 'Essential messaging for small teams', priceCents: 2900, sortOrder: 1,
    features: ['1 WhatsApp number', 'Social inbox', 'Basic analytics', 'Email support'] },
  { slug: 'professional', name: 'Professional', description: 'AI automation and multi-channel for growing teams', priceCents: 7900, sortOrder: 2,
    features: ['3 channels', 'AI auto-replies', 'TikTok integration', 'Priority support', 'Team collaboration'] },
  { slug: 'business', name: 'Business', description: 'Full platform for agencies and enterprises', priceCents: 14900, sortOrder: 3,
    features: ['Unlimited channels', 'Advanced AI', 'TikTok Pixel tracking', 'Admin tools', 'Dedicated support'] },
];
(async () => {
  for (const plan of plans) {
    const existing = await p.subscriptionPlan.findUnique({ where: { slug: plan.slug } });
    if (existing) { console.log('exists:', plan.slug); continue; }
    await p.subscriptionPlan.create({
      data: {
        id: randomUUID(),
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: 'USD',
        interval: 'MONTHLY',
        trialDays: 14,
        features: plan.features,
        isActive: true,
        sortOrder: plan.sortOrder,
      },
    });
    console.log('created:', plan.slug);
  }
  const count = await p.subscriptionPlan.count();
  console.log('total plans:', count);
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()

    # Upload patched i18n files from local (after we edit them)
    for rel in [
        "apps/web/src/lib/i18n/en.ts",
        "apps/web/src/lib/i18n/ar.ts",
        "apps/web/src/lib/i18n/types.ts",
    ]:
        local = REPO / rel
        sftp.put(str(local), f"{PROJECT}/{rel.replace(chr(92), '/')}")

    with sftp.file(f"{PROJECT}/patch-app-module.py", "w") as f:
        f.write(PATCH_APP)
    with sftp.file(f"{PROJECT}/seed-plans.js", "w") as f:
        f.write(SEED_PLANS)
    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
python3 patch-app-module.py
node seed-plans.js
cd {PROJECT}
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 8
curl -sS https://almutamayiziq.com/api/v1/billing/plans | head -c 200; echo
curl -sS -o /dev/null -w "admin_post:%{{http_code}}\\n" -X POST https://almutamayiziq.com/api/v1/admin/auth/login -H 'Content-Type: application/json' -d '{{"email":"x@y.com","password":"wrongpass123"}}'
echo FIX_BILLING_ADMIN_DONE
"""
    _, stdout, stderr = c.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-4000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
