#!/usr/bin/env python3
import os, paramiko
HOST = '161.97.140.171'
PWD = os.environ.get('VPS_PASSWORD', '')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PWD, timeout=60)
q = """
SELECT i.id, i.redirect_slug, i.whatsapp_number, i.team_id, i.wizard_completed, i.billing_suspended,
       u.email,
       (SELECT count(*) FROM tiktok_integration_clicks c WHERE c.integration_id=i.id) clicks,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id=i.id) leads,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id=i.id AND l.customer_phone IS NOT NULL) linked
FROM tiktok_integrations i
JOIN "User" u ON u.id = i.user_id
WHERE i.redirect_slug = '7ijk92em';

SELECT l.id, l.created_at, l.customer_phone, l.conversation_id, left(l.id,12) lid
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE i.redirect_slug = '7ijk92em'
ORDER BY l.created_at DESC LIMIT 8;

SELECT c.id ch_id, c."teamId", c.status, ws."phoneNumber"
FROM "Channel" c
LEFT JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
WHERE c.provider = 'WHATSAPP_BAILEYS'
  AND (ws."phoneNumber" LIKE '%7864314333%' OR ws."phoneNumber" LIKE '%7864459684%' OR ws."phoneNumber" LIKE '%7829307631%')
ORDER BY c.status, ws."phoneNumber";

SELECT m."createdAt", m.type, m.direction, left(m.text,120) text, ws."phoneNumber" biz, conv."teamId"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "Channel" ch ON ch.id = conv."channelId"
LEFT JOIN "WhatsAppSession" ws ON ws.id = ch."whatsAppSessionId"
WHERE m.direction = 'INBOUND'
  AND m."createdAt" > NOW() - interval '3 hours'
ORDER BY m."createdAt" DESC LIMIT 15;
"""
with c.open_sftp().file('/tmp/d7.sql', 'w') as f:
    f.write(q)
_, o, _ = c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/d7.sql', timeout=60000)
print(o.read().decode('utf-8', 'replace'))
_, o2, _ = c.exec_command('pm2 logs api --lines 1500 --nostream 2>&1 | grep TikTokConversion | tail -25', timeout=60000)
print('=== TikTokConversion logs ===')
print(o2.read().decode('utf-8', 'replace'))
c.close()
