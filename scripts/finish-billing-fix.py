#!/usr/bin/env python3
import os, sys, paramiko
HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

SEED = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
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
      data: { id: randomUUID(), slug: plan.slug, name: plan.name, description: plan.description,
        priceCents: plan.priceCents, currency: 'USD', interval: 'MONTHLY', trialDays: 14,
        features: plan.features, isActive: true, sortOrder: plan.sortOrder },
    });
    console.log('created:', plan.slug);
  }
  console.log('total:', await p.subscriptionPlan.count());
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
"""

def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()
    with sftp.file(f'{PROJECT}/seed-plans.js', 'w') as f:
        f.write(SEED)
    sftp.close()
    cmd = f"""
set -e
cd {PROJECT}
node seed-plans.js
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 10
echo '--- billing plans ---'
curl -sS https://almutamayiziq.com/api/v1/billing/plans | head -c 400; echo
echo '--- admin login ---'
curl -sS -X POST https://almutamayiziq.com/api/v1/admin/auth/login -H 'Content-Type: application/json' -d '{{"email":"x@y.com","password":"wrongpass12345"}}' | head -c 200; echo
"""
    _, o, e = c.exec_command(cmd, timeout=900000)
    print(o.read().decode('utf-8', errors='replace'))
    err = e.read().decode('utf-8', errors='replace')
    if err.strip(): print('STDERR:', err[-3000:])
    c.close()

if __name__ == '__main__':
    main()
