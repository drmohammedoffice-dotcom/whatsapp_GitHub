#!/usr/bin/env python3
"""Deploy AI Gateway HA layer + set platform API keys on VPS."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
REPO = Path(__file__).resolve().parents[1]

# Provided by operator — written only to VPS .env, never logged in full.
API_KEYS = {
    "AI_API_KEY_1": "6ca877fde12dd9fd28689e4121c86a42",
    "AI_API_KEY_2": "8233661b25d4a4b99c1878fa9ea8d1a9",
    "AI_API_KEY_3": "b2f112e4aa7bd100e2df628e55f64367",
    "AI_API_KEY_4": "ac06f061fa9792ed9bc32a62fbd6b9cd",
    "AI_API_KEY_5": "5cbdccad1d0d69f56bd4ac8ce564b82a",
    "AI_API_KEY_6": "b185e17abcddf33bd3bc892127d488a4",
    "AI_API_KEY_7": "617e60654098d30811d1c4b91ae6388b",
    "AI_API_KEY_8": "32983ece815a534fd8b996f1657d39af",
    "AI_API_KEY_9": "19c7e50290bd76a69e8323c79a180607",
    "AI_API_KEY_10": "364b6fdeb03663101dbad58a7a3365bd",
}

UPLOAD_PATHS = [
    "apps/api/src/ai/gateway/ai-gateway.types.ts",
    "apps/api/src/ai/gateway/ai-gateway-error.ts",
    "apps/api/src/ai/gateway/ai-gateway-key-pool.service.ts",
    "apps/api/src/ai/gateway/ai-gateway-metrics.service.ts",
    "apps/api/src/ai/gateway/ai-gateway-health.service.ts",
    "apps/api/src/ai/gateway/ai-gateway.service.ts",
    "apps/api/src/ai/gateway/ai-gateway-retry.processor.ts",
    "apps/api/src/ai/gateway/ai-gateway.module.ts",
    "apps/api/src/ai/ai-provider.service.ts",
    "apps/api/src/ai/ai-orchestrator.service.ts",
    "apps/api/src/ai/ai-inbound.processor.ts",
    "apps/api/src/ai/ai.module.ts",
    "apps/api/src/channels/channel-message.service.ts",
    "apps/api/src/queues/queues.constants.ts",
    "apps/api/src/queues/queues.module.ts",
    "apps/api/src/config/env.ts",
    "apps/api/src/app.module.ts",
    "apps/api/src/admin/admin.module.ts",
    "apps/api/src/admin/controllers/admin-platform.controller.ts",
    "apps/api/src/admin/services/admin-ai-gateway.service.ts",
    "apps/web/src/app/admin/ai-gateway/page.tsx",
    "apps/web/src/lib/admin-api.ts",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    ".env.example",
]


def upsert_env(remote_env: str, updates: dict[str, str]) -> str:
    lines = remote_env.splitlines()
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            key = line.split("=", 1)[0].strip()
            if key in updates:
                out.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        out.append(line)
    for key, value in updates.items():
        if key not in seen:
            out.append(f"{key}={value}")
    return "\n".join(out) + "\n"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)
    sftp = client.open_sftp()

    # Ensure gateway directory exists
    try:
        sftp.mkdir(f"{PROJECT}/apps/api/src/ai/gateway")
    except OSError:
        pass
    try:
        sftp.mkdir(f"{PROJECT}/apps/web/src/app/admin/ai-gateway")
    except OSError:
        pass

    for rel in UPLOAD_PATHS:
        local = REPO / rel
        remote = f"{PROJECT}/{rel.replace(chr(92), '/')}"
        print("Upload", rel)
        sftp.put(str(local), remote)

    # Patch .env (do not print secrets)
    env_path = f"{PROJECT}/.env"
    with sftp.open(env_path, "r") as f:
        current = f.read().decode("utf-8", errors="replace")

    updates = {
        **API_KEYS,
        "AI_API_BASE_URL": "https://openrouter.ai/api/v1",
    }
    # Keep existing AI_CHAT_MODEL if set; otherwise a sensible OpenRouter default
    if "AI_CHAT_MODEL=" not in current:
        updates["AI_CHAT_MODEL"] = "openai/gpt-4o-mini"

    patched = upsert_env(current, updates)
    with sftp.open(env_path, "w") as f:
        f.write(patched)
    print("Updated .env with AI_API_KEY_1..10 + OpenRouter base URL (values not printed)")

    sftp.close()

    cmd = f"""
set -e
cd {PROJECT}
echo "===== build api ====="
pnpm --filter @watsapp/api build
echo "===== build web ====="
pnpm --filter @watsapp/web build
echo "===== restart ====="
pm2 restart api worker --update-env || pm2 restart api --update-env
sleep 18
echo "===== pm2 ====="
pm2 list
echo "===== health ====="
curl -sS -w '\\nhttp:%{{http_code}}\\n' https://almutamayiziq.com/api/v1/health || true
echo "===== gateway boot log (no secrets) ====="
pm2 logs api --lines 60 --nostream | grep -E 'AI Gateway|Nest application|ERROR|listening' | tail -n 40 || true
echo AI_GATEWAY_DEPLOY_OK
"""
    _, stdout, stderr = client.exec_command(cmd, timeout=900000)
    print(stdout.read().decode("utf-8", errors="replace"))
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err[-5000:], file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
