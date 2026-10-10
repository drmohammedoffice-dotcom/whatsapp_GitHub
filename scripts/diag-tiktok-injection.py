#!/usr/bin/env python3
import os, paramiko
HOST = '161.97.140.171'
PWD = os.environ.get('VPS_PASSWORD', '')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PWD, timeout=60)

cmds = [
    "grep -c findRecentClickLead /root/whatsapp_GitHub/apps/api/src/tiktok-integration/tiktok-integration-tracking.service.ts",
    "grep tiktokIntegrationTracking /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/channel-message.service.js | head -5",
    "pm2 logs api --lines 800 --nostream 2>&1 | rg TikTokConversion | tail -20",
    """PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -c "
SELECT m.\\"createdAt\\", left(m.text,80) text, l.id lead_id, l.customer_phone
FROM \\"ConversationMessage\\" m
JOIN \\"Conversation\\" conv ON conv.id=m.\\"conversationId\\"
JOIN \\"Channel\\" ch ON ch.id=conv.\\"channelId\\"
LEFT JOIN \\"WhatsAppSession\\" ws ON ws.id=ch.\\"whatsAppSessionId\\"
LEFT JOIN tiktok_integration_leads l ON l.created_at > NOW() - interval '2 hours'
WHERE m.direction='INBOUND' AND ws.\\"phoneNumber\\" LIKE '%7864459684%'
ORDER BY m.\\"createdAt\\" DESC LIMIT 5;
SELECT id, created_at, customer_phone FROM tiktok_integration_leads WHERE created_at > NOW() - interval '2 hours' ORDER BY created_at DESC LIMIT 5;
" """,
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=60000)
    print('>>>', cmd[:80])
    print(o.read().decode('utf-8', 'replace'))
    err = e.read().decode('utf-8', 'replace')
    if err.strip():
        print('ERR:', err[:500])
c.close()
