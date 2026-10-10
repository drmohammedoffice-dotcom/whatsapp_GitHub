#!/usr/bin/env python3
import os, sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("161.97.140.171", username="root", password=os.environ.get("VPS_PASSWORD", ""), timeout=60)
script = r"""
cd /root/whatsapp_GitHub/packages/database
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.tikTokIntegration.findMany({select:{pixelName:true,pixelId:true,pixelCode:true,pixelStatus:true,wizardCompleted:true},orderBy:{updatedAt:'desc'},take:5}).then(r=>{console.log(JSON.stringify(r,null,2));return p.$disconnect();});"
"""
_, o, e = c.exec_command(script, timeout=30000)
print(o.read().decode("utf-8", errors="replace"))
if e.read().strip():
    print("ERR:", e.read()[-1500:])
c.close()
