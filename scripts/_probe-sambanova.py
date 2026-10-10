#!/usr/bin/env python3
"""Verify all 10 keys against SambaNova chat completions (no key values printed)."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
echo '===== models list (key 1) ====='
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)
curl -sS -m 20 -H "Authorization: Bearer $KEY" https://api.sambanova.ai/v1/models | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(m['id'] for m in d['data']))"

echo '===== chat test per key ====='
for i in 1 2 3 4 5 6 7 8 9 10; do
  KEY=$(grep "^AI_API_KEY_$i=" .env | cut -d= -f2)
  CODE=$(curl -sS -o /tmp/chat.json -w '%{http_code}' -m 40 \
    -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
    -d '{"model":"Meta-Llama-3.3-70B-Instruct","messages":[{"role":"user","content":"Reply with exactly: OK"}],"max_tokens":10}' \
    https://api.sambanova.ai/v1/chat/completions 2>/dev/null || echo ERR)
  SNIP=$(head -c 120 /tmp/chat.json | tr -d '\n')
  echo "KEY_$i -> $CODE ${SNIP:0:100}"
done
"""
_, o, e = c.exec_command(cmd, timeout=600)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
