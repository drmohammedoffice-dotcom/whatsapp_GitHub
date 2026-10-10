#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
cmd = r"""cd /root/whatsapp_GitHub
pm2 logs api --lines 300 --nostream 2>/dev/null | grep -E '\[AI\]|Gateway|falling back|Response received|Reply sent|outbound|Success' | tail -n 50
"""
_, o, e = c.exec_command(cmd, timeout=120)
print(o.read().decode("utf-8", "replace"))
c.close()
