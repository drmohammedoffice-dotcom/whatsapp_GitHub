#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmds = [
    "tail -100 /root/.pm2/logs/api-error.log | grep -A5 -i 'auth\\|login\\|Resend\\|ExceptionsHandler\\|emailVerification' | tail -60",
    "grep -E 'RESEND_|JWT_' /root/whatsapp_GitHub/.env | sed 's/=.*/=***/'",
]
for cmd in cmds:
    print("===", cmd[:80], "===")
    _, o, e = c.exec_command(cmd, timeout=60000)
    print(o.read().decode("utf-8", "replace")[-6000:])
c.close()
