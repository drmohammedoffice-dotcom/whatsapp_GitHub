#!/usr/bin/env python3
import os, paramiko
HOST='161.97.140.171'
PWD=os.environ.get('VPS_PASSWORD','')
q = """
SELECT i.id, i.redirect_slug, i.whatsapp_number, i.team_id, i.wizard_completed,
       (SELECT count(*) FROM tiktok_integration_clicks c WHERE c.integration_id=i.id) clicks,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id=i.id) lead_rows,
       (SELECT count(*) FROM tiktok_integration_leads l WHERE l.integration_id=i.id AND l.customer_phone IS NOT NULL) linked,
       (SELECT count(*) FROM tiktok_integration_conversions cv WHERE cv.integration_id=i.id) conversions
FROM tiktok_integrations i WHERE i.redirect_slug='0n25mdgb';

SELECT l.id, l.created_at, l.customer_phone, l.conversation_id, left(c.ip_address,20) ip
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id=l.integration_id
LEFT JOIN tiktok_integration_clicks c ON c.id=l.click_id
WHERE i.redirect_slug='0n25mdgb'
ORDER BY l.created_at DESC LIMIT 10;

SELECT m."createdAt", m.type, m.direction, left(m.text,100) text, ws."phoneNumber" biz
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id=m."conversationId"
JOIN "Channel" ch ON ch.id=conv."channelId"
LEFT JOIN "WhatsAppSession" ws ON ws.id=ch."whatsAppSessionId"
WHERE m.direction='INBOUND' AND m."createdAt"> NOW() - interval '3 hours'
ORDER BY m."createdAt" DESC LIMIT 20;

SELECT c.id ch_id, c."teamId", ws."phoneNumber", c.status
FROM "Channel" c
LEFT JOIN "WhatsAppSession" ws ON ws.id=c."whatsAppSessionId"
WHERE c.provider='WHATSAPP_BAILEYS' AND (ws."phoneNumber" LIKE '%7829307631%' OR ws."phoneNumber" LIKE '%7864459684%');
"""
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST,username='root',password=PWD,timeout=60)
with c.open_sftp().file('/tmp/pixel.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/pixel.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
_,o2,_=c.exec_command("pm2 logs api --lines 200 --nostream 2>&1 | grep TikTokConversion | tail -25",timeout=60000)
print('=== logs ===')
print(o2.read().decode('utf-8','replace'))
c.close()
