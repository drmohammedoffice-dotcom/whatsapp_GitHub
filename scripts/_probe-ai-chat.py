#!/usr/bin/env python3
"""Test a real chat completion against candidate providers (no key values printed)."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)

echo '===== aimlapi chat (gpt-4o-mini) ====='
curl -sS -m 40 -o /tmp/chat1.json -w 'code:%{http_code}\n' \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say OK"}],"max_tokens":10}' \
  https://api.aimlapi.com/v1/chat/completions
head -c 600 /tmp/chat1.json; echo

echo '===== novita chat ====='
curl -sS -m 40 -o /tmp/chat2.json -w 'code:%{http_code}\n' \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"meta-llama/llama-3.1-8b-instruct","messages":[{"role":"user","content":"Say OK"}],"max_tokens":10}' \
  https://api.novita.ai/v3/openai/chat/completions
head -c 600 /tmp/chat2.json; echo
"""
_, o, e = c.exec_command(cmd, timeout=300)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
