#!/usr/bin/env python3
import os, paramiko
HOST='161.97.140.171'
PWD=os.environ.get('VPS_PASSWORD','')
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy()); c.connect(HOST,username='root',password=PWD,timeout=60)
cmds=[
"pm2 logs api --lines 500 --nostream 2>&1 | grep TikTokConversion | tail -40",
"""PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -t -c \"SELECT c.id, c.\\\"teamId\\\", c.provider, c.\\\"externalId\\\", ws.\\\"phoneNumber\\\" FROM \\\"Channel\\\" c LEFT JOIN \\\"WhatsAppSession\\\" ws ON ws.\\\"channelId\\\" = c.id WHERE c.provider='WHATSAPP_BAILEYS' ORDER BY c.\\\"updatedAt\\\" DESC LIMIT 8;\"""",
"""PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -t -c \"SELECT i.redirect_slug, i.whatsapp_number, ws.\\\"phoneNumber\\\", c.\\\"externalId\\\" FROM tiktok_integrations i JOIN \\\"Channel\\\" c ON c.\\\"teamId\\\" = i.team_id AND c.provider='WHATSAPP_BAILEYS' LEFT JOIN \\\"WhatsAppSession\\\" ws ON ws.\\\"channelId\\\" = c.id WHERE i.redirect_slug IN ('0n25mdgb','1x23ijyn','pc9i7hve') ORDER BY i.redirect_slug;\"""",
]
for cmd in cmds:
    print('===', cmd[:80], '===')
    _,o,_=c.exec_command(cmd,timeout=60000)
    print(o.read().decode('utf-8','replace').encode('ascii','replace').decode('ascii'))
c.close()
