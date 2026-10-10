#!/usr/bin/env python3
import os, sys
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
OUT = r"c:\xampp\htdocs\watsapp\tmp_vps_payment_page.tsx"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=60)
_, o, _ = c.exec_command(f"cat {PROJECT}/apps/web/src/app/pricing/payment/page.tsx", timeout=30000)
content = o.read().decode("utf-8", "replace")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(content)
print("written", OUT, "bytes", len(content))
c.close()
