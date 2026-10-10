#!/usr/bin/env python3
"""Revert cross-tenant TikTok lead backfill for pixel 0n25mdgb."""
import os, paramiko
HOST = '161.97.140.171'
PWD = os.environ.get('VPS_PASSWORD', '')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PWD, timeout=60)
q = """
UPDATE tiktok_integration_leads l
SET customer_phone = NULL,
    contact_id = NULL,
    conversation_id = NULL
FROM tiktok_integrations i
WHERE l.integration_id = i.id
  AND i.redirect_slug = '0n25mdgb';

SELECT count(*) linked_after
FROM tiktok_integration_leads l
JOIN tiktok_integrations i ON i.id = l.integration_id
WHERE i.redirect_slug = '0n25mdgb'
  AND l.customer_phone IS NOT NULL;
"""
with c.open_sftp().file('/tmp/unlink.sql', 'w') as f:
    f.write(q)
_, o, _ = c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/unlink.sql', timeout=60000)
print(o.read().decode('utf-8', 'replace'))
c.close()
