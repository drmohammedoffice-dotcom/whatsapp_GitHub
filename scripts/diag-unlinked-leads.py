#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=60)
q = """
SELECT l.id, l.created_at, i.redirect_slug, l.customer_phone, l.conversation_id
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE l.customer_phone IS NULL AND l.created_at > NOW() - interval '2 hours'
ORDER BY l.created_at DESC LIMIT 10;

SELECT l.id, l.customer_phone, i.redirect_slug FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id WHERE l.id = 'cmrgvdw3h000zkb0psik6gtxz';
"""
with c.open_sftp().file('/tmp/q8.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q8.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
_,o2,_=c.exec_command('pm2 logs api --lines 50 --nostream 2>&1 | grep TikTokConversion | tail -10',timeout=60000)
print('recent logs:', o2.read().decode())
c.close()
