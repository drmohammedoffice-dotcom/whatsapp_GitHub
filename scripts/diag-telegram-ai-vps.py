#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HOST = '161.97.140.171'
PROJECT = '/root/whatsapp_GitHub'

sql = open(os.path.join(os.path.dirname(__file__), 'diag-telegram-ai.sql'), encoding='utf-8').read()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

sftp = c.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), 'diag-telegram-ai.sql'), f'{PROJECT}/diag-telegram-ai.sql')
sftp.close()

cmds = [
    f'PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -f {PROJECT}/diag-telegram-ai.sql',
    "pm2 logs api --lines 150 --nostream 2>&1 | grep -E '530864071|cmr67lwlq|AI skipped|Failed to send AI|AI inbound|Telegram|530864' | tail -40",
    "grep -n TELEGRAM_USER /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/outbound-channel.service.js | head -3",
]
for cmd in cmds:
    print('===', cmd[:90], '===')
    _, o, e = c.exec_command(cmd, timeout=45)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    print(out)
    if err.strip() and 'ERROR' in err.upper():
        print('ERR:', err[:1500])
c.close()
