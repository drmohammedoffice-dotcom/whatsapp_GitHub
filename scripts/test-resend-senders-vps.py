#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

senders = [
    "ChatLoora <noreply@chatloora.com>",
    "ChatLoora <noreply@almutamayiziq.com>",
    "ChatLoora <onboarding@resend.dev>",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

for sender in senders:
    cmd = f"""
cd /root/whatsapp_GitHub
API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d= -f2-)
curl -sS -w '\\nhttp:%{{http_code}}\\n' https://api.resend.com/emails \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{{"from":"{sender}","to":["drmohammedoffice@gmail.com"],"subject":"OTP sender test","html":"<p>test</p>"}}'
"""
    print(f"=== {sender} ===")
    _, o, _ = c.exec_command(cmd, timeout=60000)
    print(o.read().decode("utf-8", "replace"))

c.close()
