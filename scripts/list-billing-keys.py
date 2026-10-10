#!/usr/bin/env python3
import os, re, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
_, o, _ = c.exec_command('grep -roh "billing\\.[a-zA-Z]*" /root/whatsapp_GitHub/apps/web/src | sort -u', timeout=60)
print(o.read().decode())
c.close()
