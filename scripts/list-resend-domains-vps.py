#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmd = """
cd /root/whatsapp_GitHub
API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d= -f2-)
curl -sS https://api.resend.com/domains -H "Authorization: Bearer $API_KEY"
"""
_, o, _ = c.exec_command(cmd, timeout=60000)
print(o.read().decode("utf-8", "replace"))
c.close()
