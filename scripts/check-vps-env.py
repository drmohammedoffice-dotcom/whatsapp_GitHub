#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmds = [
    "grep NEXT_PUBLIC /root/whatsapp_GitHub/apps/web/.env.local 2>/dev/null || grep NEXT_PUBLIC /root/whatsapp_GitHub/apps/web/.env 2>/dev/null || echo NO_ENV",
    "grep NEXT_PUBLIC /root/whatsapp_GitHub/.env 2>/dev/null | head -5",
    "node -e \"const fs=require('fs');const p='/root/whatsapp_GitHub/apps/web/.next/BUILD_ID';console.log('BUILD_ID',fs.readFileSync(p,'utf8').trim())\"",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
for cmd in cmds:
    print("===", cmd, "===")
    _, o, _ = c.exec_command(cmd, timeout=30000)
    sys_out = o.read().decode("utf-8", "replace")
    print(sys_out.encode("ascii", "replace").decode("ascii"))
c.close()
