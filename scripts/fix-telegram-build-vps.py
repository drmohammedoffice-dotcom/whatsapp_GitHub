#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
script = r"""
set -e
cd /root/whatsapp_GitHub
git checkout -- apps/api/src/channels/outbound-channel.service.ts 2>/dev/null || true
pnpm --filter @watsapp/api build
pnpm --filter @watsapp/web build
pm2 restart api web --update-env
sleep 5
curl -sS -o /dev/null -w 'send-code:%{http_code}\n' -X POST http://127.0.0.1:4000/api/v1/telegram-user/auth/send-code -H 'Content-Type: application/json' -d '{"phoneNumber":"+9647864314333"}'
test -f apps/api/dist/apps/api/src/integrations/telegram-user/telegram-user.controller.js && echo TG_USER_OK || echo TG_USER_MISSING
grep TELEGRAM_API /root/whatsapp_GitHub/.env | sed 's/=.*/=***/'
"""
_, o, e = c.exec_command(script, timeout=600)
print(o.read().decode("utf-8", errors="replace"))
if e.read().decode("utf-8", errors="replace").strip():
    print("ERR:", e.read())
c.close()
