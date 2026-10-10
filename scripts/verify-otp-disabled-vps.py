#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
_, o, _ = c.exec_command("grep AUTH_OTP /root/whatsapp_GitHub/.env", timeout=30000)
print(o.read().decode("utf-8", "replace"))
c.close()
