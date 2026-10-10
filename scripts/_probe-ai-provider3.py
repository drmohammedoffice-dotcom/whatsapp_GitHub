#!/usr/bin/env python3
"""Last round of provider identification for 32-hex keys (no key values printed)."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)

probe() {
  NAME="$1"; URL="$2"; shift 2
  CODE=$(curl -sS -o /tmp/p.json -w '%{http_code}' -m 15 "$@" "$URL" 2>/dev/null || echo ERR)
  echo "--- $NAME -> $CODE"
  head -c 200 /tmp/p.json; echo
}

probe ai21 https://api.ai21.com/studio/v1/chat/completions -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{"model":"jamba-mini","messages":[{"role":"user","content":"OK"}],"max_tokens":5}'
probe deepinfra https://api.deepinfra.com/v1/openai/models -H "Authorization: Bearer $KEY"
probe kluster https://api.kluster.ai/v1/models -H "Authorization: Bearer $KEY"
probe avian https://api.avian.io/v1/models -H "Authorization: Bearer $KEY"
probe lambda https://api.lambda.ai/v1/models -H "Authorization: Bearer $KEY"
probe chatanywhere https://api.chatanywhere.tech/v1/models -H "Authorization: Bearer $KEY"
probe electronhub https://api.electronhub.ai/v1/models -H "Authorization: Bearer $KEY"
probe navy https://api.navy/v1/models -H "Authorization: Bearer $KEY"
probe helicone-jawn https://api.helicone.ai/v1/models -H "Authorization: Bearer $KEY"
probe siliconflow https://api.siliconflow.com/v1/models -H "Authorization: Bearer $KEY"
probe infermatic https://api.totalgpt.ai/v1/models -H "Authorization: Bearer $KEY"
probe featherless https://api.featherless.ai/v1/models -H "Authorization: Bearer $KEY"
probe targon https://api.targon.com/v1/models -H "Authorization: Bearer $KEY"
probe cloudflare-ai https://api.cloudflare.com/client/v4/accounts/x/ai/v1/models -H "Authorization: Bearer $KEY"
"""
_, o, e = c.exec_command(cmd, timeout=400)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
