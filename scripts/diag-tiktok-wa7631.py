#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT m."createdAt", left(m.text,120) AS text, m.type, ws."phoneNumber"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "Channel" c ON c.id = conv."channelId"
LEFT JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
WHERE m.direction = 'INBOUND'
  AND ws."phoneNumber" = '9647829307631'
ORDER BY m."createdAt" DESC
LIMIT 15;
"""
with c.open_sftp().file('/tmp/q3.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q3.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
