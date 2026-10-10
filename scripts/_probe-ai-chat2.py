#!/usr/bin/env python3
"""Chat-completion test on candidate providers + verify auth is actually required."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)

chat() {
  NAME="$1"; URL="$2"; MODEL="$3"; AUTH="$4"
  CODE=$(curl -sS -o /tmp/chat.json -w '%{http_code}' -m 40 \
    -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK\"}],\"max_tokens\":10}" \
    "$URL/chat/completions" 2>/dev/null || echo ERR)
  SNIP=$(head -c 200 /tmp/chat.json | tr -d '\n')
  echo "$NAME [$MODEL] -> $CODE :: ${SNIP}"
}

echo '===== with real key ====='
chat avian https://api.avian.io/v1 "deepseek/deepseek-v4-flash" "$KEY"
chat electronhub https://api.electronhub.ai/v1 "gpt-4o-mini" "$KEY"
chat navy https://api.navy/v1 "gpt-4o-mini" "$KEY"

echo '===== with fake key (auth control) ====='
chat avian-fake https://api.avian.io/v1 "deepseek/deepseek-v4-flash" "00000000000000000000000000000000"
chat electronhub-fake https://api.electronhub.ai/v1 "gpt-4o-mini" "00000000000000000000000000000000"
chat navy-fake https://api.navy/v1 "gpt-4o-mini" "00000000000000000000000000000000"
"""
_, o, e = c.exec_command(cmd, timeout=600)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
