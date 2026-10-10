#!/usr/bin/env python3
"""Diagnose OTP email delivery issues on VPS."""
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)

cmds = [
    "grep -E '^RESEND_|^AUTH_OTP' /root/whatsapp_GitHub/.env",
    "tail -80 /root/.pm2/logs/api-error.log | grep -i -E 'auth|resend|otp|email|verification|drmohammed' | tail -30",
    "tail -40 /root/.pm2/logs/api-out.log | grep -i -E 'auth|resend|otp|email' | tail -20",
    """cd /root/whatsapp_GitHub && API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d= -f2-) && curl -sS https://api.resend.com/emails -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"from":"ChatLoora <noreply@almutamayiziq.com>","to":["drmohammedoffice@gmail.com"],"subject":"ChatLoora OTP Test","html":"<p>Test code: <strong>999888</strong></p>"}'""",
    """PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -c "SELECT id, email, type, used, attempts, expires_at > NOW() as valid, created_at FROM email_verifications ORDER BY created_at DESC LIMIT 5;" """,
]

for cmd in cmds:
    print("\n===", cmd[:90], "===")
    _, o, e = c.exec_command(cmd, timeout=90000)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    if out.strip():
        print(out[-4000:])
    if err.strip():
        print("ERR:", err[-1000:])

c.close()
