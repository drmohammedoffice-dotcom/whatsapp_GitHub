#!/usr/bin/env python3
"""Verify TikTok Login Kit on production."""
import json
import os
import sys
import urllib.error
import urllib.request

import jwt
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
BASE = "https://almutamayiziq.com"


def safe_print(*parts):
    text = " ".join(str(p) for p in parts)
    print(text.encode("ascii", errors="replace").decode("ascii"))


def http(method: str, url: str, headers: dict | None = None, body: dict | None = None):
    data = None
    hdrs = headers or {}
    if body is not None:
        data = json.dumps(body).encode()
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return e.code, payload


def ssh_fetch_auth_context() -> tuple[str, str, str] | None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    script = """
grep '^JWT_ACCESS_SECRET=' /root/whatsapp_GitHub/.env | cut -d= -f2-
psql postgresql://postgres:postgres@localhost:5432/watsapp -t -A -c 'SELECT u.id || chr(124) || tm."teamId" FROM "User" u JOIN "TeamMember" tm ON tm."userId" = u.id LIMIT 1;'
"""
    _, stdout, stderr = client.exec_command(script, timeout=60)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    client.close()
    if code != 0 or not out:
        safe_print("SSH auth context failed:", err or out)
        return None
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    if len(lines) < 2:
        safe_print("Unexpected SSH output:", lines)
        return None
    secret = lines[0]
    user_id, team_id = lines[1].split("|", 1)
    return secret, user_id, team_id


def main() -> int:
    safe_print("==> Health")
    status, body = http("GET", f"{BASE}/api/v1/health")
    safe_print(status, body)
    if status != 200:
        return 1

    safe_print("\n==> Login Kit route (no auth)")
    status, body = http("GET", f"{BASE}/api/auth/tiktok/login")
    safe_print(status, body)
    if status != 401:
        safe_print("Expected 401 without bearer token")

    safe_print("\n==> Deprecated Business connect")
    ctx = ssh_fetch_auth_context()
    if not ctx:
        return 1
    secret, user_id, team_id = ctx
    token = jwt.encode({"sub": user_id, "teamId": team_id}, secret, algorithm="HS256")

    status, body = http(
        "POST",
        f"{BASE}/api/v1/tiktok/connect",
        headers={"Authorization": f"Bearer {token}"},
        body={},
    )
    safe_print(status, body.get("message", body))
    if status != 400 or "Login Kit" not in str(body.get("message", "")):
        safe_print("Expected 400 with Login Kit message")
        return 1

    safe_print("\n==> Login Kit start (authenticated)")
    status, body = http(
        "POST",
        f"{BASE}/api/auth/tiktok/login",
        headers={"Authorization": f"Bearer {token}"},
        body={},
    )
    safe_print(status, json.dumps(body, indent=2))
    if status not in (200, 201):
        safe_print("Login Kit start failed")
        return 1

    auth_url = body.get("authUrl", "")
    checks = [
        "https://www.tiktok.com/v2/auth/authorize/" in auth_url,
        "client_key=awfi9f7y0akjdxap" in auth_url,
        "scope=user.info.basic" in auth_url,
        "redirect_uri=https%3A%2F%2Falmutamayiziq.com%2Fapi%2Fauth%2Ftiktok%2Fcallback" in auth_url,
        "business-api.tiktok.com" not in auth_url,
        "app_id=" not in auth_url,
    ]
    safe_print("\n==> Auth URL validation:")
    for i, ok in enumerate(checks, 1):
        safe_print(f"  check {i}: {'PASS' if ok else 'FAIL'}")
    safe_print(f"\nauthUrl={auth_url}")

    if not all(checks):
        return 1

    safe_print("\n==> OAuth authorize page reachable")
    req = urllib.request.Request(auth_url, method="GET")
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            safe_print("TikTok authorize HTTP", resp.status, "final URL", resp.geturl())
    except urllib.error.HTTPError as e:
        safe_print("TikTok authorize HTTP", e.code)

    safe_print("\nVERIFY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
