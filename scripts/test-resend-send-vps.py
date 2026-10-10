#!/usr/bin/env python3
"""Test Resend send with configured sender."""
import json
import os
import sys
import urllib.error
import urllib.request

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
_, o, _ = c.exec_command("grep '^RESEND_API_KEY=' /root/whatsapp_GitHub/.env | cut -d= -f2-", timeout=30000)
api_key = o.read().decode().strip()
c.close()

payload = {
    "from": "ChatLoora <chatloora.com@gmail.com>",
    "to": ["drmohammedoffice@gmail.com"],
    "subject": "ChatLoora OTP test",
    "html": "<p>Test OTP: <strong>123456</strong></p>",
}
req = urllib.request.Request(
    "https://api.resend.com/emails",
    data=json.dumps(payload).encode(),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("SUCCESS:", r.status, r.read().decode())
except urllib.error.HTTPError as e:
    print("ERROR:", e.code, e.read().decode())
