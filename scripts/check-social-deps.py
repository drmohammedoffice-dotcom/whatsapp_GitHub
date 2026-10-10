#!/usr/bin/env python3
import os, sys
import paramiko
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('161.97.140.171', username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
P = '/root/whatsapp_GitHub'
cmds = [
    f'grep -c social {P}/apps/api/src/conversations/conversations.service.ts',
    f'grep -n socialInbox {P}/apps/web/src/lib/i18n/en.ts',
    f'grep -n "inbox/social" {P}/apps/web/src/components/layout/nav-config.ts',
    f'grep -n "socialMode" {P}/apps/web/src/components/inbox/inbox-view.tsx',
    f'grep -n "social" {P}/apps/api/src/conversations/dto/conversation.dto.ts',
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd, timeout=15)
    print(f'$ {cmd}')
    print(o.read().decode().rstrip() or '(no match)')
    print('---')
c.close()
