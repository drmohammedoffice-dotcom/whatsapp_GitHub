#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=60)
cmds = [
    "grep -c AdminRole /root/whatsapp_GitHub/packages/database/prisma/schema.prisma",
    "grep -c AdminUser /root/whatsapp_GitHub/packages/database/prisma/schema.prisma",
    "ls -la /root/whatsapp_GitHub/packages/database/prisma/schema.prisma.broken 2>&1",
    "grep AdminRole /root/whatsapp_GitHub/packages/database/prisma/schema.prisma.broken 2>/dev/null | head -3",
]
for cmd in cmds:
    _, o, _ = c.exec_command(cmd)
    print('$', cmd)
    print(o.read().decode())
c.close()
