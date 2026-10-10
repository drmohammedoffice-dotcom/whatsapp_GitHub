#!/usr/bin/env python3
import os
import paramiko

HOST = "161.97.140.171"
USER = "root"
PASSWORD = os.environ.get("VPS_PASSWORD", "")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
sftp = c.open_sftp()
sftp.get("/tmp/api-build.log", r"c:\xampp\htdocs\watsapp\tmp\api-build.log")
sftp.close()
c.close()
print("downloaded")
