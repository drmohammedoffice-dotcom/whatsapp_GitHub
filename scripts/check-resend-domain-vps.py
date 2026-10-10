#!/usr/bin/env python3
"""Check Resend config on VPS and list verified domains via Resend API."""
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
_, o, _ = c.exec_command(
    "grep -E '^RESEND_|^AUTH_OTP' /root/whatsapp_GitHub/.env", timeout=30000
)
env_lines = o.read().decode("utf-8", "replace").strip().splitlines()
c.close()

api_key = None
for line in env_lines:
    print(line if not line.startswith("RESEND_API_KEY") else "RESEND_API_KEY=***")
    if line.startswith("RESEND_API_KEY="):
        api_key = line.split("=", 1)[1].strip()

if api_key:
    req = urllib.request.Request(
        "https://api.resend.com/domains",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
            print("\n=== Resend domains ===")
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print("\nResend API error:", e.code, e.read().decode()[:500])
