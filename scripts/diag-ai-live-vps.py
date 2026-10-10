#!/usr/bin/env python3
import os, sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HOST = '161.97.140.171'
PROJECT = '/root/whatsapp_GitHub'

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)

sftp = c.open_sftp()
sftp.put(os.path.join(os.path.dirname(__file__), 'diag-ai-live.sql'), f'{PROJECT}/diag-ai-live.sql')
sftp.close()

cmds = [
    f'PGPASSWORD=postgres psql -h localhost -U postgres -d watsapp -f {PROJECT}/diag-ai-live.sql',
    "pm2 logs api --lines 300 --nostream 2>&1 | grep -E 'AiOrchestrator|Failed to send AI|AI skipped|No AI provider|Telegram peer|Could not resolve|Could not find|sendMessage|AI inbound' | tail -50",
    "pm2 logs api --lines 80 --nostream 2>&1 | tail -40",
]
for cmd in cmds:
    print('===', cmd[:95], '===')
    _, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode('utf-8', 'replace')[:8000])
    err = e.read().decode('utf-8', 'replace')
    if err.strip() and 'ERROR' in err:
        print('ERR:', err[:1000])
c.close()
