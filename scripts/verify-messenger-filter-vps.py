#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
_, o, _ = c.exec_command("grep -n \"health === 'connected'\" /root/whatsapp_GitHub/apps/api/src/integrations/connections.service.ts", timeout=20)
print("SRC:", o.read().decode("utf-8", errors="replace"))
_, o2, _ = c.exec_command("grep \"health === 'connected'\" /root/whatsapp_GitHub/apps/api/dist/apps/api/src/integrations/connections.service.js", timeout=20)
print("DIST:", o2.read().decode("utf-8", errors="replace"))
c.close()
