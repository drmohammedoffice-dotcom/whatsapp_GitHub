#!/usr/bin/env python3
import os, sys, paramiko, json
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmd = r'''
cd /root/whatsapp_GitHub
API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d= -f2-)
curl -sS -w '\nhttp:%{http_code}\n' https://api.resend.com/emails \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"ChatLoora <chatloora.com@gmail.com>","to":["drmohammedoffice@gmail.com"],"subject":"ChatLoora OTP test","html":"<p>Test OTP: <strong>123456</strong></p>"}'
'''
_, o, e = c.exec_command(cmd, timeout=60000)
print(o.read().decode("utf-8", "replace"))
print(e.read().decode("utf-8", "replace")[-1000:])
c.close()
