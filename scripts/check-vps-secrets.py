#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
cmds = [
    'sed -n "1,80p" /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/channel-secrets.service.js',
    'grep -n TELEGRAM_USER /root/whatsapp_GitHub/apps/api/dist/apps/api/src/ai/ai-orchestrator.service.js | head -5',
    "pm2 logs api --lines 300 --nostream 2>&1 | grep -E 'META_MESSENGER|META_INSTAGRAM|Failed to send AI|AI skipped' | tail -25",
]
for cmd in cmds:
    print('===', cmd[:80])
    _, o, _ = c.exec_command(cmd, timeout=20)
    print(o.read().decode('utf-8', 'replace')[:4000])
c.close()
