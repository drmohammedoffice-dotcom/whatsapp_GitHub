#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmds = [
    "curl -s -o /dev/null -w 'redirect: %{http_code}\\n' 'https://almutamayiziq.com/r/5tx7lb9w'",
    "curl -s 'http://127.0.0.1:4000/api/tiktok-integration/public/track/5tx7lb9w' | head -c 300",
    "curl -s -o /dev/null -w 'activate: %{http_code}\\n' 'https://almutamayiziq.com/tiktok/activate/7660887432673378311'",
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=30000)
    print('$', cmd[:70])
    print(o.read().decode())
c.close()
