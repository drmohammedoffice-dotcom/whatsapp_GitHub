#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT l.id, l.created_at, i.redirect_slug, i.team_id, i.whatsapp_number
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE l.created_at > '2026-07-11 20:50:00'
ORDER BY l.created_at DESC;

SELECT m.id, m.text, m.direction, m."createdAt", c."teamId", conv.id AS conv_id
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "Channel" c ON c.id = conv."channelId"
WHERE m."createdAt" > '2026-07-11 21:00:00'
  AND m.direction = 'INBOUND'
ORDER BY m."createdAt" DESC
LIMIT 15;
"""
sftp=c.open_sftp()
with sftp.file('/tmp/q.sql','w') as f: f.write(q)
sftp.close()
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
