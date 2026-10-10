#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
cmds = [
    "grep -i telegram /root/whatsapp_GitHub/apps/api/src/integrations/integrations.module.ts 2>&1 || echo NO_MODULE",
    "test -d /root/whatsapp_GitHub/apps/api/src/integrations/telegram-user && echo SRC_OK || echo SRC_MISSING",
    "psql postgresql://postgres:postgres@localhost:5432/watsapp -t -c \"SELECT tablename FROM pg_tables WHERE tablename ILIKE '%telegram%' ORDER BY 1\"",
    "curl -sS -o /dev/null -w '%{http_code}' -X POST https://almutamayiziq.com/api/v1/telegram-user/auth/send-code -H 'Content-Type: application/json' -d '{\"phoneNumber\":\"+9647864314333\"}'",
]
for cmd in cmds:
    print(f"\n=== {cmd[:70]}... ===")
    _, o, e = c.exec_command(cmd, timeout=30)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR:", err)
c.close()
