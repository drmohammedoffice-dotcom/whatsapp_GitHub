#!/usr/bin/env python3
"""Deploy OTP spam folder hint to VPS."""
import os, sys, tarfile, tempfile
from pathlib import Path
import paramiko

REPO = Path(__file__).resolve().parents[1]
PROJECT = "/root/whatsapp_GitHub"
FILES = [
    "apps/web/src/components/auth/otp-verification-modal.tsx",
    "apps/web/src/lib/i18n/en.ts",
    "apps/web/src/lib/i18n/ar.ts",
    "apps/web/src/lib/i18n/types.ts",
]

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
    os.close(fd)
    with tarfile.open(tar_path, "w:gz") as tar:
        for rel in FILES:
            tar.add(REPO / rel, arcname=rel.replace("\\", "/"))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
    sftp = c.open_sftp()
    sftp.put(tar_path, f"{PROJECT}/otp-hint.tar.gz")
    sftp.close()
    os.remove(tar_path)
    cmd = f"""
set -e
cd {PROJECT}
tar xzf otp-hint.tar.gz && rm otp-hint.tar.gz
rm -rf apps/web/.next
pnpm --filter @watsapp/web build
pm2 restart web --update-env
echo OTP_HINT_DEPLOY_OK
"""
    _, o, e = c.exec_command(cmd, timeout=900000)
    print(o.read().decode("utf-8", errors="replace"))
    if e.read().decode().strip():
        print("ERR:", e.read()[-2000:], file=sys.stderr)
    code = o.channel.recv_exit_status()
    c.close()
    return code

if __name__ == "__main__":
    raise SystemExit(main())
