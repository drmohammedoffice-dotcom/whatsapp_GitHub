#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT m."createdAt", m.text, m.direction, c."teamId", ws."phoneNumber"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "Channel" c ON c.id = conv."channelId"
LEFT JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
WHERE m."createdAt" > '2026-07-11 20:50:00'
  AND m.direction = 'INBOUND'
ORDER BY m."createdAt" DESC
LIMIT 20;

SELECT m."createdAt", m.text
FROM "ConversationMessage" m
WHERE m.text LIKE '%[ref:%'
ORDER BY m."createdAt" DESC
LIMIT 10;
"""
with c.open_sftp().file('/tmp/q2.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q2.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
