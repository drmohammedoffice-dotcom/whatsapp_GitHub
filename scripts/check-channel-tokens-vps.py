#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

_, stdout, _ = client.exec_command(
    """psql postgresql://postgres:postgres@localhost:5432/watsapp <<'SQL'
SELECT c.provider, c.status, c."externalId", c.name,
  (ct.id IS NOT NULL) AS has_channel_token,
  (c.metadata->>'tokenEnc' IS NOT NULL) AS has_metadata_token,
  c.metadata->>'pageId' AS page_id
FROM "Channel" c
LEFT JOIN "ChannelToken" ct ON ct."channelId" = c.id
WHERE c."teamId" = (SELECT id FROM "Team" WHERE slug = 'ahmed')
  AND c.provider IN ('META_MESSENGER', 'META_INSTAGRAM', 'WHATSAPP_BAILEYS', 'TELEGRAM_USER')
ORDER BY c.provider, c.name
LIMIT 20;

SELECT count(*) AS channels_without_token
FROM "Channel" c
WHERE c."teamId" = (SELECT id FROM "Team" WHERE slug = 'ahmed')
  AND c.provider IN ('META_MESSENGER', 'META_INSTAGRAM')
  AND NOT EXISTS (SELECT 1 FROM "ChannelToken" ct WHERE ct."channelId" = c.id)
  AND (c.metadata->>'tokenEnc' IS NULL);
SQL""",
    timeout=60,
)
print(stdout.read().decode("utf-8", errors="replace"))
client.close()
