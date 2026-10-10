#!/usr/bin/env python3
"""Link recent TikTok leads to recent WhatsApp inbound messages for pixel 0n25mdgb."""
import os, paramiko, json
from urllib.request import urlopen

HOST = '161.97.140.171'
PWD = os.environ.get('VPS_PASSWORD', '')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PWD, timeout=60)

# Backfill: link latest unlinked leads to recent inbound conversation on connected channel
q = """
WITH latest_msg AS (
  SELECT conv.id AS conversation_id, ct.id AS contact_id, ct.phone AS customer_phone
  FROM "ConversationMessage" m
  JOIN "Conversation" conv ON conv.id = m."conversationId"
  JOIN "Contact" ct ON ct.id = conv."contactId"
  JOIN "Channel" ch ON ch.id = conv."channelId"
  LEFT JOIN "WhatsAppSession" ws ON ws.id = ch."whatsAppSessionId"
  WHERE m.direction = 'INBOUND'
    AND ch.status = 'CONNECTED'
    AND ws."phoneNumber" LIKE '%7864459684%'
    AND m."createdAt" >= NOW() - interval '6 hours'
  ORDER BY m."createdAt" DESC
  LIMIT 1
),
unlinked AS (
  SELECT l.id
  FROM tiktok_integration_leads l
  JOIN tiktok_integrations i ON i.id = l.integration_id
  WHERE i.redirect_slug = '0n25mdgb'
    AND l.customer_phone IS NULL
    AND l.created_at >= NOW() - interval '6 hours'
  ORDER BY l.created_at DESC
)
UPDATE tiktok_integration_leads l
SET customer_phone = lm.customer_phone,
    contact_id = lm.contact_id,
    conversation_id = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM tiktok_integration_leads x
        WHERE x.conversation_id = lm.conversation_id AND x.id <> l.id
      ) THEN lm.conversation_id
      ELSE l.conversation_id
    END
FROM latest_msg lm, unlinked u
WHERE l.id = u.id;

SELECT count(*) linked_now
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE i.redirect_slug = '0n25mdgb'
  AND l.customer_phone IS NOT NULL
  AND l.created_at >= NOW() - interval '30 days';
"""
with c.open_sftp().file('/tmp/backfill.sql', 'w') as f:
    f.write(q)
_, o, _ = c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/backfill.sql', timeout=60000)
print(o.read().decode('utf-8', 'replace'))

# Check redirect target phone
try:
    data = json.loads(urlopen('https://almutamayiziq.com/api/tiktok-integration/public/track/0n25mdgb', timeout=20).read())
    print('redirectUrl:', data.get('redirectUrl', '')[:120])
except Exception as e:
    print('track error:', e)

c.close()
