#!/usr/bin/env python3
import os
import sys
import json
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

PAYLOAD = {
    "teamId": "cmqwrykfu0009kbi7ccvvax53",
    "conversationId": "cmr5j4ha20007kb8giqvy929t",
    "messageId": "cmr5jhmb80003kbt90tx1fcff",
    "messageText": "السلام عليكم — اختبار الرد التلقائي",
    "isNewConversation": False,
}

node_script = f"""
const {{ Queue }} = require('bullmq');
const payload = {json.dumps(PAYLOAD, ensure_ascii=False)};
(async () => {{
  const q = new Queue('ai-inbound', {{ connection: {{ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' }} }});
  const job = await q.add('process', payload);
  console.log('JOB', job.id);
  await q.close();
}})().catch((e) => {{ console.error(e); process.exit(1); }});
"""

remote_script = f"""#!/bin/bash
set -e
cd /root/whatsapp_GitHub
set -a
source .env
set +a
cat > /tmp/enqueue-ai-test.js << 'ENDJS'
{node_script}
ENDJS
NODE_PATH=$(find /root/whatsapp_GitHub/node_modules/.pnpm -path '*/bullmq@*/node_modules' -print -quit)
export NODE_PATH
node /tmp/enqueue-ai-test.js
sleep 18
pm2 logs api --lines 80 --nostream 2>&1 | grep -iE 'AiInbound|AI skipped|Failed to send|AI provider|OpenRouter|reply' | tail -25
psql postgresql://postgres:postgres@localhost:5432/watsapp -c "SELECT direction, LEFT(COALESCE(text,''),100) AS text, \\"createdAt\\" FROM \\"ConversationMessage\\" WHERE \\"conversationId\\" = '{PAYLOAD['conversationId']}' ORDER BY \\"createdAt\\" DESC LIMIT 8;"
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
_, stdout, stderr = client.exec_command(f"bash -s <<'REMOTE'\n{remote_script}\nREMOTE", timeout=120)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err)
client.close()
