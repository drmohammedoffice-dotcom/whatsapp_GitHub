#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT c.id, c.status, c.provider, c."teamId", c."externalId", ws."phoneNumber"
FROM "Channel" c
LEFT JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
WHERE c."teamId" IN ('cmrgz9kvc0088kbosy2t8wk1v','cmrgu8j10004mkbj20xbyaq1q','cmrgvwtlj000akbfmbuwxpf4f');

SELECT c.id, c.status, ws."phoneNumber", t.slug
FROM "Channel" c
JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
JOIN "Team" t ON t.id = c."teamId"
WHERE c.status = 'CONNECTED';
"""
sftp=c.open_sftp()
with sftp.file('/tmp/q3.sql','w') as f: f.write(q)
sftp.close()
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q3.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
