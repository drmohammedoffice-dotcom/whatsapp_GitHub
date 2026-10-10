#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q=r"""
SELECT i.redirect_slug, i.whatsapp_number, i.team_id, i.default_optimization_event,
       (SELECT count(*) FROM tiktok_integration_clicks ck WHERE ck.integration_id=i.id) clicks
FROM tiktok_integrations i WHERE i.redirect_slug IN ('0lt2ynvw','0n25mdgb','3y3vu0mi');

SELECT c.id, c.status, c."teamId", c."externalId", c.metadata,
       ws."phoneNumber" AS baileys_phone
FROM "Channel" c
LEFT JOIN whats_app_sessions ws ON ws.channel_id = c.id
WHERE c.provider IN ('WHATSAPP_BAILEYS','WHATSAPP_CLOUD')
ORDER BY c."updatedAt" DESC;

SELECT t.id, t.slug FROM teams t
JOIN tiktok_integrations i ON i.team_id = t.id
WHERE i.redirect_slug = '0lt2ynvw';
"""
sftp=c.open_sftp()
with sftp.file('/tmp/q2.sql','w') as f: f.write(q)
sftp.close()
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q2.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
