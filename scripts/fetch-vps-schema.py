#!/usr/bin/env python3
"""Fetch VPS schema.prisma for local inspection."""
import os
from pathlib import Path
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")
REMOTE = "/root/whatsapp_GitHub/packages/database/prisma/schema.prisma"
LOCAL = Path(__file__).resolve().parents[1] / "tmp" / "vps-schema.prisma"

def main():
    LOCAL.parent.mkdir(parents=True, exist_ok=True)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = c.open_sftp()
    sftp.get(REMOTE, str(LOCAL))
    sftp.close()
    c.close()
    print(f"Saved {LOCAL} ({LOCAL.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
