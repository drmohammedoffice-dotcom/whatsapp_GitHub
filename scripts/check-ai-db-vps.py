#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

sql = r"""
SELECT t.slug, t.id as team_id FROM "Team" t WHERE t.slug = 'ahmed' LIMIT 1;
SELECT platform, enabled, "autoReplyEnabled", "greetingMessage", "outOfOfficeMessage", "businessHours"
FROM "AiSettings" WHERE "teamId" = (SELECT id FROM "Team" WHERE slug='ahmed' LIMIT 1);
SELECT c.id, c.type, c.status, c."externalId", c.metadata::text,
  (SELECT COUNT(*) FROM "ChannelToken" ct WHERE ct."channelId"=c.id) as has_token_row
FROM "Channel" c
WHERE c."teamId" = (SELECT id FROM "Team" WHERE slug='ahmed' LIMIT 1)
  AND c.type IN ('META_MESSENGER','META_INSTAGRAM','TELEGRAM','TELEGRAM_USER');
SELECT conv.id, conv."aiMode", conv."greetingSentAt", ch.type as channel_type, ch.status as channel_status
FROM "Conversation" conv
JOIN "Channel" ch ON ch.id = conv."channelId"
WHERE conv."teamId" = (SELECT id FROM "Team" WHERE slug='ahmed' LIMIT 1)
  AND ch.type IN ('META_MESSENGER','META_INSTAGRAM','TELEGRAM')
ORDER BY conv."updatedAt" DESC LIMIT 8;
SELECT id, type, status FROM "Channel" WHERE id = 'cmr67xudn002gkbvtev4kaaxi';
"""

cmd = f"""cd /root/whatsapp_GitHub && source .env 2>/dev/null; psql "$DATABASE_URL" -c "{sql.replace(chr(10), ' ')}" 2>&1"""
_, o, e = c.exec_command(cmd, timeout=60)
print(o.read().decode('utf-8', 'replace'))
err = e.read().decode('utf-8', 'replace')
if err.strip():
    print('STDERR:', err)

# recent AI logs
for cmd2 in [
    "pm2 logs api --lines 200 --nostream 2>&1 | grep -E 'AI skipped|Failed to send AI|No AI provider|empty message' | tail -30",
    "grep -r 'canSendOutbound\\|getAccessToken' /root/whatsapp_GitHub/apps/api/dist/apps/api/src/ai/ai-orchestrator.service.js | head -5",
]:
    print('===', cmd2[:70], '===')
    _, o, _ = c.exec_command(cmd2, timeout=30)
    print(o.read().decode('utf-8', 'replace')[:3000])

c.close()
