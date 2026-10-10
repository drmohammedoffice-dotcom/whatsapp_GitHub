#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT m.id, m."createdAt", m.type, m.direction, m.text,
       conv.id conv, conv."teamId", conv."channelId",
       ct.phone contact_phone, ct."displayName",
       ch.status ch_status, ws."phoneNumber" biz
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id=m."conversationId"
JOIN "Contact" ct ON ct.id=conv."contactId"
JOIN "Channel" ch ON ch.id=conv."channelId"
LEFT JOIN "WhatsAppSession" ws ON ws.id=ch."whatsAppSessionId"
WHERE m."createdAt" >= '2026-07-11 21:50:00'
ORDER BY m."createdAt" DESC;

SELECT count(*) clicks_after_2150 FROM tiktok_integration_clicks WHERE created_at >= '2026-07-11 21:50:00';
SELECT count(*) leads_after_2150 FROM tiktok_integration_leads WHERE created_at >= '2026-07-11 21:50:00';

SELECT id, created_at FROM tiktok_integration_leads ORDER BY created_at DESC LIMIT 3;
"""
with c.open_sftp().file('/tmp/q5.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q5.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
_,o2,_=c.exec_command('grep Optional /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/channel-message.service.js | head -3',timeout=30000)
print('Optional in dist:', o2.read().decode())
c.close()
