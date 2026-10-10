#!/usr/bin/env python3
"""Identify which provider the 32-hex keys belong to (no key values printed)."""
import os, sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmd = r"""cd /root/whatsapp_GitHub
KEY=$(grep '^AI_API_KEY_1=' .env | cut -d= -f2)
echo "key length: ${#KEY}"

probe() {
  NAME="$1"; URL="$2"; shift 2
  CODE=$(curl -sS -o /tmp/p.json -w '%{http_code}' -m 20 "$@" "$URL" 2>/dev/null || echo ERR)
  echo "--- $NAME -> $CODE"
  head -c 300 /tmp/p.json; echo
}

# ElevenLabs (xi-api-key, 32-hex keys)
probe elevenlabs https://api.elevenlabs.io/v1/user -H "xi-api-key: $KEY"

# Anthropic (x-api-key)
probe anthropic https://api.anthropic.com/v1/models -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01"

# Cohere
probe cohere https://api.cohere.ai/v1/models -H "Authorization: Bearer $KEY"

# Fireworks
probe fireworks https://api.fireworks.ai/inference/v1/models -H "Authorization: Bearer $KEY"

# Hyperbolic
probe hyperbolic https://api.hyperbolic.xyz/v1/models -H "Authorization: Bearer $KEY"

# SambaNova
probe sambanova https://api.sambanova.ai/v1/models -H "Authorization: Bearer $KEY"

# Cerebras
probe cerebras https://api.cerebras.ai/v1/models -H "Authorization: Bearer $KEY"

# GLM / Zhipu open bigmodel
probe zhipu https://open.bigmodel.cn/api/paas/v4/models -H "Authorization: Bearer $KEY"

# xAI
probe xai https://api.x.ai/v1/models -H "Authorization: Bearer $KEY"

# AvalAI
probe avalai https://api.avalai.ir/v1/models -H "Authorization: Bearer $KEY"

# GapGPT (iranian openai proxy)
probe gapgpt https://api.gapgpt.app/v1/models -H "Authorization: Bearer $KEY"

# TalkBot / one-api style
probe metisai https://api.metisai.ir/openai/v1/models -H "Authorization: Bearer $KEY"

# OpenAI direct
probe openai https://api.openai.com/v1/models -H "Authorization: Bearer $KEY"

# Gemini with key param
probe gemini "https://generativelanguage.googleapis.com/v1beta/models?key=$KEY"
"""
_, o, e = c.exec_command(cmd, timeout=400)
print(o.read().decode("utf-8", "replace"))
err = e.read().decode("utf-8", "replace")
if err.strip():
    print("STDERR", err[-1500:])
c.close()
