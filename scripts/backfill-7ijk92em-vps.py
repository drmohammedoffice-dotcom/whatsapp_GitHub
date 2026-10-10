#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=60)
q = """
UPDATE tiktok_integration_leads
SET customer_phone = '9647742271255'
WHERE id = 'cmrgxrwlq002kkbr8yaqrtpga';

SELECT l.customer_phone, i.redirect_slug
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE i.redirect_slug = '7ijk92em' AND l.customer_phone IS NOT NULL;
"""
with c.open_sftp().file('/tmp/link7b.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/link7b.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
