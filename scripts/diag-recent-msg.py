#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT m.id, m.text, m."createdAt", conv.id conv, ct.phone contact_phone
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id=m."conversationId"
JOIN "Contact" ct ON ct.id=conv."contactId"
WHERE m."createdAt">='2026-07-11 21:18:00'
  AND m.direction='INBOUND'
ORDER BY m."createdAt" DESC;

SELECT i.redirect_slug, i.whatsapp_number, i.user_id, u.email
FROM tiktok_integrations i
JOIN "User" u ON u.id=i.user_id
WHERE i.redirect_slug='0n25mdgb';
"""
with c.open_sftp().file('/tmp/q4.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q4.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
