#!/usr/bin/env python3
"""Create missing TikTok tables on VPS database."""
from __future__ import annotations

import os
import sys
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

APPLY_JS = r"""
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@6.0.3__typescript@6.0.3/node_modules/@prisma/client');
const p = new PrismaClient();

async function run(label, sql) {
  try {
    await p.$executeRawUnsafe(sql);
    console.log('OK', label);
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('SKIP', label);
    } else {
      console.error('FAIL', label, msg);
      throw e;
    }
  }
}

(async () => {
  await run('tiktok_marketing_advertisers', `CREATE TABLE IF NOT EXISTS "tiktok_marketing_advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tiktok_marketing_advertisers_pkey" PRIMARY KEY ("id")
  )`);

  await run('idx_mkt_adv_unique', `CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_marketing_advertisers_user_id_advertiser_id_key" ON "tiktok_marketing_advertisers"("user_id", "advertiser_id")`);
  await run('idx_mkt_adv_user', `CREATE INDEX IF NOT EXISTS "tiktok_marketing_advertisers_user_id_idx" ON "tiktok_marketing_advertisers"("user_id")`);

  try {
    await p.$executeRawUnsafe(`ALTER TABLE "tiktok_marketing_advertisers" ADD CONSTRAINT "tiktok_marketing_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_marketing_connections"("user_id") ON DELETE CASCADE ON UPDATE CASCADE`);
    console.log('OK fk_mkt_adv');
  } catch (e) {
    if ((e.message || '').includes('already exists')) console.log('SKIP fk_mkt_adv');
    else throw e;
  }

  await run('TikTokTrackingClick', `CREATE TABLE IF NOT EXISTS "TikTokTrackingClick" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TikTokTrackingClick_pkey" PRIMARY KEY ("id")
  )`);

  await run('idx_ttc_token', `CREATE UNIQUE INDEX IF NOT EXISTS "TikTokTrackingClick_clickToken_key" ON "TikTokTrackingClick"("clickToken")`);
  await run('idx_ttc_team', `CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_teamId_createdAt_idx" ON "TikTokTrackingClick"("teamId", "createdAt")`);
  await run('idx_ttc_campaign', `CREATE INDEX IF NOT EXISTS "TikTokTrackingClick_campaignId_idx" ON "TikTokTrackingClick"("campaignId")`);

  for (const [label, sql] of [
    ['fk_ttc_team', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
    ['fk_ttc_campaign', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TikTokCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
    ['fk_ttc_conv', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
    ['fk_ttc_contact', `ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
  ]) {
    try {
      await p.$executeRawUnsafe(sql);
      console.log('OK', label);
    } catch (e) {
      if ((e.message || '').includes('already exists')) console.log('SKIP', label);
      else throw e;
    }
  }

  const rows = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('tiktok_marketing_advertisers', 'TikTokTrackingClick')`;
  console.log('tables:', rows.map(r => r.tablename).join(', '));
  await p.$disconnect();
})().catch(async (e) => { console.error('FATAL', e.message); await p.$disconnect(); process.exit(1); });
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()
    with sftp.file(f"{PROJECT}/apply-tiktok-tables.js", "w") as f:
        f.write(APPLY_JS)
    sftp.close()

    cmd = f"cd {PROJECT} && node apply-tiktok-tables.js && pm2 restart api --update-env && sleep 5 && echo DONE"
    _, stdout, stderr = c.exec_command(cmd, timeout=120000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-3000:], file=sys.stderr)
    return stdout.channel.recv_exit_status()


if __name__ == "__main__":
    raise SystemExit(main())
