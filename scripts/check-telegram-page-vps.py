#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
cmds = [
    "head -8 /root/whatsapp_GitHub/apps/web/src/app/telegram/page.tsx",
    "test -f /root/whatsapp_GitHub/apps/web/src/components/channels/telegram-connect-page.tsx && echo HAS_TG_PAGE || echo MISSING",
    "grep -l TelegramUserConnect /root/whatsapp_GitHub/apps/web/src/components/channels/*.tsx 2>/dev/null || echo NO_USER_CONNECT",
    """psql postgresql://postgres:postgres@localhost:5432/watsapp -c 'SELECT status, "phoneNumber", "firstName", "channelId" FROM "TelegramConnection" ORDER BY "createdAt" DESC LIMIT 5;'""",
]
for cmd in cmds:
    print("\n===", cmd[:70], "===")
    _, o, _ = c.exec_command(cmd, timeout=30)
    print(o.read().decode("utf-8", errors="replace"))
c.close()
