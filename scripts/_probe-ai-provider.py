#!/usr/bin/env python3
"""Detect which provider accepts the configured AI keys (never prints key values)."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)
for BASE in \
  https://api.aimlapi.com/v1 \
  https://openrouter.ai/api/v1 \
  https://api.groq.com/openai/v1 \
  https://api.deepseek.com/v1 \
  https://api.together.xyz/v1 \
  https://api.mistral.ai/v1 \
  https://api.moonshot.ai/v1 \
  https://api.novita.ai/v3/openai \
  https://integrate.api.nvidia.com/v1 \
; do
  CODE=$(curl -sS -o /tmp/aiprobe.json -w '%{http_code}' -m 20 -H "Authorization: Bearer $KEY" "$BASE/models" 2>/dev/null || echo ERR)
  echo "$BASE -> $CODE"
  if [ "$CODE" = "200" ]; then
    head -c 400 /tmp/aiprobe.json; echo
  fi
done
"""
_, o, e = c.exec_command(cmd, timeout=300)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
