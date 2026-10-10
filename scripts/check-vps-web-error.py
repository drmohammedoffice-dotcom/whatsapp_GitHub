#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"

cmds = [
    f"ls -la {PROJECT}/apps/web/src/app/pricing 2>&1 || echo NO_PRICING_DIR",
    "pm2 logs web --lines 50 --nostream 2>&1 | tail -50",
    "curl -sS -o /dev/null -w 'home:%{http_code}\\n' https://almutamayiziq.com/",
    "curl -sS -o /dev/null -w 'pricing:%{http_code}\\n' https://almutamayiziq.com/pricing",
    "curl -sS -o /dev/null -w 'login:%{http_code}\\n' https://almutamayiziq.com/login",
    "grep -r 'Application error' /root/.pm2/logs/web-error.log 2>/dev/null | tail -5 || true",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
for cmd in cmds:
    print("===", cmd, "===")
    _, o, e = c.exec_command(cmd, timeout=60000)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    if out.strip():
        print(out)
    if err.strip():
        print("STDERR:", err)
c.close()
