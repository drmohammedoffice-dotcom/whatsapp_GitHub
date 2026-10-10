#!/usr/bin/env python3
import os, re
from pathlib import Path
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
_, o, _ = c.exec_command('grep -roh "tiktokBusiness\\.[a-zA-Z0-9_.]*" /root/whatsapp_GitHub/apps/web/src 2>/dev/null | sort -u', timeout=120000)
print(o.read().decode('utf-8', errors='replace'))
