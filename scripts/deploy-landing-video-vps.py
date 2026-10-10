import os
import sys
import tarfile
import tempfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "161.97.140.171"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
PROJECT = "/root/whatsapp_GitHub"
ROOT = Path(__file__).resolve().parents[1]
files = [
    "apps/web/src/components/landing/landing-sections.tsx",
    "apps/web/src/components/landing/landing-hero.tsx",
]

fd, tar_path = tempfile.mkstemp(suffix=".tar.gz")
os.close(fd)
with tarfile.open(tar_path, "w:gz") as tar:
    for rel in files:
        tar.add(ROOT / rel, arcname=rel)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=30)
sftp = c.open_sftp()
sftp.put(tar_path, f"{PROJECT}/deploy-landing-video.tar.gz")
sftp.close()
os.remove(tar_path)

_, o, e = c.exec_command(
    f"""
set -e
cd {PROJECT}
tar xzf deploy-landing-video.tar.gz
rm -f deploy-landing-video.tar.gz
pnpm --filter @watsapp/web build
pm2 restart web --update-env
echo DEPLOY_OK
""",
    timeout=600,
)
out = o.read().decode("utf-8", "replace")
err = e.read().decode("utf-8", "replace")
code = o.channel.recv_exit_status()
print(out[-2000:].encode("ascii", "replace").decode("ascii"))
if "DEPLOY_OK" not in out:
    print("ERR", err[-2000:].encode("ascii", "replace").decode("ascii"))
print("exit", code)
c.close()
raise SystemExit(code)
