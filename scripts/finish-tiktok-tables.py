#!/usr/bin/env python3
import os, sys, paramiko
HOST = "161.97.140.171"
PROJECT = "/root/whatsapp_GitHub"
APPLY_JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();
async function tryRun(label, sql) {
  try { await p.$executeRawUnsafe(sql); console.log('OK', label); }
  catch (e) { console.log(label, ':', (e.message||'').split('\n')[0]); }
}
(async () => {
  await tryRun('idx_adv_unique', `CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_marketing_advertisers_user_id_advertiser_id_key" ON "tiktok_marketing_advertisers"("user_id", "advertiser_id")`);
  await tryRun('idx_adv_user', `CREATE INDEX IF NOT EXISTS "tiktok_marketing_advertisers_user_id_idx" ON "tiktok_marketing_advertisers"("user_id")`);
  await tryRun('fk_adv', `ALTER TABLE "tiktok_marketing_advertisers" ADD CONSTRAINT "tiktok_marketing_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_marketing_connections"("user_id") ON DELETE CASCADE ON UPDATE CASCADE`);
  await tryRun('TikTokTrackingClick', `CREATE TABLE IF NOT EXISTS "TikTokTrackingClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickToken" TEXT NOT NULL,
    "ttclid" TEXT,
    "source" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "conversationId" TEXT,
    "contactId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await tryRun('idx_ttc_token', `CREATE UNIQUE INDEX IF NOT EXISTS "TikTokTrackingClick_clickToken_key" ON "TikTokTrackingClick"("clickToken")`);
  await tryRun('idx_ttc_team', `CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_teamId_createdAt_idx" ON "TikTokTrackingClick"("teamId", "createdAt")`);
  await tryRun('idx_ttc_campaign', `CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_campaignId_idx" ON "TikTokTrackingClick"("campaignId")`);
  await tryRun('fk_ttc_team', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  await tryRun('fk_ttc_campaign', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TikTokCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  await tryRun('fk_ttc_conv', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  await tryRun('fk_ttc_contact', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  const rows = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE tablename IN ('tiktok_marketing_advertisers', 'TikTokTrackingClick')`;
  console.log('FINAL:', rows.map(r=>r.tablename).join(', '));
  await p.$disconnect();
})();
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
sftp = c.open_sftp()
with sftp.file(f'{PROJECT}/finish-tiktok-tables.js', 'w') as f: f.write(APPLY_JS)
sftp.close()
_, o, _ = c.exec_command(f'cd {PROJECT} && node finish-tiktok-tables.js && pm2 restart api --update-env', timeout=120000)
print(o.read().decode())
