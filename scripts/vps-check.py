#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmds = [
    "pm2 logs api --lines 40 --nostream 2>&1 | tail -45",
    "grep -n 'tiktok_integration' /root/whatsapp_GitHub/packages/database/prisma/schema.prisma | head -5",
    "grep -n 'model tiktok' /root/whatsapp_GitHub/packages/database/prisma/schema.prisma | head -10",
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=60000)
    print('$', cmd)
    print(o.read().decode('utf-8', errors='replace'))
c.close()
