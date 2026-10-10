#!/usr/bin/env python3
import os, paramiko
c=paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171',username='root',password=os.environ.get('VPS_PASSWORD',''),timeout=60)
q = """
SELECT u.email, tm."teamId", t.name
FROM "User" u
JOIN "TeamMember" tm ON tm."userId"=u.id
JOIN "Team" t ON t.id=tm."teamId"
WHERE u.email IN ('drmohammedoffice1@gmail.com','drmohammedoffice@gmail.com');
"""
with c.open_sftp().file('/tmp/q6.sql','w') as f: f.write(q)
_,o,_=c.exec_command('PGPASSWORD=postgres psql -U postgres -h localhost -d watsapp -f /tmp/q6.sql',timeout=30000)
print(o.read().decode('utf-8','replace'))
c.close()
