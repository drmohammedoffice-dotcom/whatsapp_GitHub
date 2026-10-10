#!/usr/bin/env python3
"""Deploy premium ChatLoora landing page to VPS."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT_DIR = "/root/whatsapp_GitHub"
REPO_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_PATHS = [
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/layout.tsx",
    "apps/web/src/app/globals.css",
    "apps/web/src/app/sitemap.ts",
    "apps/web/src/app/robots.ts",
    "apps/web/src/lib/i18n/landing-copy.ts",
    "apps/web/src/components/shared/language-toggle.tsx",
    "apps/web/src/components/landing/use-landing-copy.ts",
    "apps/web/src/components/landing/landing-ui.tsx",
    "apps/web/src/components/landing/landing-navbar.tsx",
    "apps/web/src/components/landing/landing-hero.tsx",
    "apps/web/src/components/landing/landing-sections.tsx",
    "apps/web/src/components/landing/landing-page.tsx",
]


def main() -> int:
    pairs = []
    for rel in UPLOAD_PATHS:
        src = REPO_ROOT / rel
        if not src.exists():
            raise FileNotFoundError(src)
        pairs.append((src, rel.replace("\\", "/")))

    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for local, arc in pairs:
            tar.add(local, arcname=arc)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    remote_tar = f"{PROJECT_DIR}/deploy-landing.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    os.remove(tar_path)

    _, stdout, stderr = client.exec_command(
        f"""
set -e
cd {PROJECT_DIR}
tar xzf deploy-landing.tar.gz
rm -f deploy-landing.tar.gz
mkdir -p apps/web/src/components/landing
pnpm --filter @watsapp/web build
pm2 restart web --update-env
sleep 3
pm2 describe web | head -20
echo DEPLOY_OK
""",
        timeout=900,
    )
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", errors="replace").decode("ascii")[-8000:])
    if err.strip():
        print(err.encode("ascii", errors="replace").decode("ascii")[-3000:], file=sys.stderr)
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
