#!/usr/bin/env python3
"""Verify subscription grace columns and TikTok wizard API after migration."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

import jwt
import paramiko

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
BASE = "https://almutamayiziq.com"


def run(client: paramiko.SSHClient, cmd: str) -> str:
    print(f"\n=== {cmd[:100]} ===")
    _, stdout, stderr = client.exec_command(cmd, timeout=120000)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out[-8000:])
    if err.strip():
        print("ERR:", err[-2000:])
    return out


def http(path: str, token: str) -> tuple[int, str]:
    req = urllib.request.Request(
        BASE + path,
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)

    run(
        client,
        "PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -c "
        "\"SELECT column_name FROM information_schema.columns "
        "WHERE table_name='subscriptions' AND column_name IN ('expired_at','grace_purged_at');\"",
    )
    run(client, "tail -15 /root/.pm2/logs/api-error.log")

    script = (
        "grep '^JWT_ACCESS_SECRET=' /root/whatsapp_GitHub/.env | cut -d= -f2-; "
        "psql postgresql://postgres:postgres@localhost:5432/watsapp -t -A -c "
        "'SELECT u.id || chr(124) || tm.\"teamId\" FROM \"User\" u "
        "JOIN \"TeamMember\" tm ON tm.\"userId\" = u.id LIMIT 1;'"
    )
    _, stdout, _ = client.exec_command(script, timeout=60000)
    lines = [line.strip() for line in stdout.read().decode().strip().splitlines() if line.strip()]
    client.close()

    if len(lines) < 2:
        print("Failed to fetch auth context:", lines)
        return 1

    secret, user_id, team_id = lines[0], lines[1].split("|", 1)[0], lines[1].split("|", 1)[1]
    token = jwt.encode({"sub": user_id, "teamId": team_id}, secret, algorithm="HS256")

    for path in ("/api/v1/billing/status", "/api/tiktok-integration/wizard"):
        status, body = http(path, token)
        print(f"\n=== {path} => {status} ===")
        try:
            print(json.dumps(json.loads(body), indent=2)[:1200])
        except json.JSONDecodeError:
            print(body[:1200])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
