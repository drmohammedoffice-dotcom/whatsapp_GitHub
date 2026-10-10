#!/usr/bin/env python3
import paramiko

HOST = "161.97.140.171"
PASSWORD = ""

cmds = [
    "pm2 logs api --lines 120 --nostream 2>&1 | grep -iE 'error|exception|gemini|creative|Internal|500' | tail -n 60",
    "pm2 logs worker --lines 100 --nostream 2>&1 | grep -iE 'error|exception|gemini|creative|Failed' | tail -n 50",
    "ls -la /root/whatsapp_GitHub/apps/api/dist/creative-studio/providers/ | head",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=60)
for cmd in cmds:
    print("====", cmd[:70])
    _, stdout, stderr = client.exec_command(cmd, timeout=90)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-1500:])
client.close()
