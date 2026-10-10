#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

cmd = r"""
echo "=== pm2 ==="
pm2 jlist | python3 -c "import sys,json; data=json.load(sys.stdin); print('\n'.join(f\"{p['name']} status={p['pm2_env']['status']} restarts={p['pm2_env']['restart_time']}\" for p in data))"
echo "=== api AI logs ==="
pm2 logs api --lines 400 --nostream 2>&1 | grep -iE 'ai-inbound|AiOrchestrat|autoReply|AI skip|aiEnabled|training.media|No AI|skip AI|plan' | tail -50
echo "=== worker AI logs ==="
pm2 logs worker --lines 400 --nostream 2>&1 | grep -iE 'ai-inbound|AiOrchestrat|autoReply|skip|error|fail' | tail -50
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=60)
_, stdout, stderr = client.exec_command(cmd, timeout=120)
print(stdout.read().decode("utf-8", "replace"))
err = stderr.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR:", err[-2000:])
client.close()
