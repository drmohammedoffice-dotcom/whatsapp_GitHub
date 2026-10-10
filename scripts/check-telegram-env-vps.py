#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=30)
_, o, _ = c.exec_command(
    "grep TELEGRAM_API /root/whatsapp_GitHub/.env | awk -F= '{print $1 \"=\" (length($2)>0 ? \"SET(\" length($2) \" chars)\" : \"EMPTY\")}'",
    timeout=20,
)
print(o.read().decode("utf-8", errors="replace"))
c.close()
