#!/usr/bin/env python3
import json, os, sys, urllib.error, urllib.request
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = "https://almutamayiziq.com"

def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}

status, body = post("/api/v1/auth/register", {
    "email": "otp-test@example.com",
    "name": "OTP Test",
    "password": "TestPassword123!",
    "teamName": "OTP Test Team",
})
print("register", status, body)
