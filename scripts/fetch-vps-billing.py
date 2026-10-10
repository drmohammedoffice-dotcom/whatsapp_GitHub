#!/usr/bin/env python3
import os
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
OUT = Path(__file__).resolve().parents[1] / "tmp" / "vps-billing-components"
FILES = [
    "apps/web/src/components/billing/pricing-card.tsx",
    "apps/web/src/components/billing/checkout-modal.tsx",
    "apps/web/src/components/billing/subscription-required.tsx",
    "apps/web/src/app/admin/login/page.tsx",
    "apps/web/src/lib/billing.ts",
]

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()
    for f in FILES:
        local = OUT / Path(f).name
        sftp.get(f"/root/whatsapp_GitHub/{f}", str(local))
        print(f"saved {local.name}")
    sftp.close()
    c.close()

if __name__ == "__main__":
    main()
