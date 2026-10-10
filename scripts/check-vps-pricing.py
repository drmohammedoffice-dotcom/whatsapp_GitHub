#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

cmds = [
    f"cat {PROJECT}/apps/web/src/app/pricing/page.tsx",
    f"cat {PROJECT}/apps/web/src/app/pricing/layout.tsx",
    f"ls -la {PROJECT}/apps/web/src/app/pricing/payment/",
    "grep -i 'TypeError\\|is not a function\\|Cannot read\\|useSubscription must be' /root/.pm2/logs/web-error.log 2>/dev/null | tail -20 || true",
    f"stat -c '%y' {PROJECT}/apps/web/.next/BUILD_ID 2>/dev/null || echo NO_BUILD",
    "pm2 describe web | grep -E 'status|uptime|restarts'",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
for cmd in cmds:
    print("===", cmd[:100], "===")
    _, o, e = c.exec_command(cmd, timeout=60000)
    print(o.read().decode("utf-8", "replace"))
c.close()
