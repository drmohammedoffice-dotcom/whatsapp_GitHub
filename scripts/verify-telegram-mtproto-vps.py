#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
cmds = [
    "grep '^TELEGRAM_API' /root/whatsapp_GitHub/.env | awk -F= '{print $1 \"=\" (length($2)>0?\"OK\":\"EMPTY\")}'",
    "pm2 logs api --lines 120 --nostream 2>&1 | grep -i 'MTProto not configured' | tail -3 || echo NO_MTProto_WARNING",
    "curl -sS http://127.0.0.1:4000/api/v1/telegram-user/auth/send-code -X POST -H 'Content-Type: application/json' -d '{\"phoneNumber\":\"+9647864314333\"}' -w '\\nHTTP:%{http_code}\\n'",
]
for cmd in cmds:
    print("\n===", cmd[:70], "===")
    _, o, _ = c.exec_command(cmd, timeout=30)
    print(o.read().decode("utf-8", errors="replace"))
c.close()
