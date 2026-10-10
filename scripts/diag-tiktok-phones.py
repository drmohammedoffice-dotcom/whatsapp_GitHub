#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
sql = open(r'c:\xampp\htdocs\watsapp\tmp_tiktok_phones.sql','w',encoding='utf-8')
sql.write("""
SELECT i.redirect_slug, i.whatsapp_number, i.team_id,
       c.id AS channel_id, c."externalId", ws."phoneNumber" AS session_phone
FROM tiktok_integrations i
LEFT JOIN "Channel" c ON c."teamId" = i.team_id AND c.provider = 'WHATSAPP_BAILEYS'
LEFT JOIN "WhatsAppSession" ws ON ws.id = c."whatsAppSessionId"
WHERE i.wizard_completed = true
ORDER BY i.updated_at DESC
LIMIT 10;
""")
sql.close()
sftp=c.open_sftp(); sftp.put(r'c:\xampp\htdocs\watsapp\tmp_tiktok_phones.sql','/tmp/tiktok_phones.sql'); sftp.close()
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/tiktok_phones.sql',timeout=60000)
print(o.read().decode('utf-8','replace'))
c.close()
