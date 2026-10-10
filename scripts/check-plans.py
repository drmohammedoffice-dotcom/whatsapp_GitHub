#!/usr/bin/env python3
import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD',''), timeout=30)
cmd = """cd /root/whatsapp_GitHub && node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => console.error(e.message))
  .finally(() => p.\\$disconnect());
"
"""
_, o, e = c.exec_command(cmd, timeout=60000)
print(o.read().decode('utf-8', errors='replace'))
print(e.read().decode('utf-8', errors='replace'))
c.close()
