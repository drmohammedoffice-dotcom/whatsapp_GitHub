#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
cmds = [
    'grep -n TELEGRAM_USER /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/outbound-channel.service.js | head -8',
    'grep -n "Channel credentials" /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/outbound-channel.service.js',
    'sed -n "30,90p" /root/whatsapp_GitHub/apps/api/dist/apps/api/src/channels/outbound-channel.service.js',
    'sed -n "430,480p" /root/whatsapp_GitHub/apps/api/dist/apps/api/src/ai/ai-orchestrator.service.js',
]
for cmd in cmds:
    print('===', cmd)
    _, o, _ = c.exec_command(cmd, timeout=15)
    print(o.read().decode('utf-8', 'replace'))
c.close()
