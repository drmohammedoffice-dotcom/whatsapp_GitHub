#!/usr/bin/env python3
"""Test Telegram send on VPS via node script."""
import os, sys, tarfile, tempfile, paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HOST = '161.97.140.171'
PROJECT = '/root/whatsapp_GitHub'

script = r'''
const { PrismaClient } = require('@prisma/client');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

function decrypt(payload) {
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
  const raw = Buffer.from(payload, 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

(async () => {
  const p = new PrismaClient();
  const conn = await p.telegramConnection.findFirst({
    where: { status: 'CONNECTED', encryptedSession: { not: null } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conn) { console.log('no connection'); return; }
  const session = decrypt(conn.encryptedSession);
  const client = new TelegramClient(new StringSession(session), Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH, { connectionRetries: 3 });
  await client.connect();
  const peerId = '530864071';
  const dialogs = await client.getDialogs({ limit: 50 });
  console.log('dialogs', dialogs.map(d => ({ id: d.entity?.id?.toString?.(), name: d.name, username: d.entity?.username })));
  let target = null;
  for (const d of dialogs) {
    if (String(d.entity?.id) === peerId) target = d.entity;
  }
  if (!target) {
    console.log('peer not in dialogs, trying InputPeerUser from users.GetUsers');
    try {
      const users = await client.invoke(new Api.users.GetUsers({ id: [new Api.InputUser({ userId: BigInt(peerId), accessHash: BigInt(0) })] }));
      console.log('GetUsers', users);
      if (users[0]) target = users[0];
    } catch (e) { console.log('GetUsers failed', e.message); }
  }
  if (!target) { console.log('NO TARGET'); await client.disconnect(); return; }
  const msg = await client.sendMessage(target, { message: 'اختبار رد الذكاء الاصطناعي - test AI reply' });
  console.log('SENT OK', msg.id);
  await client.disconnect();
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
'''

fd, tar = tempfile.mkstemp(suffix='.js')
os.close(fd)
with open(tar, 'w', encoding='utf-8') as f:
    f.write(script)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=os.environ.get('VPS_PASSWORD', ''), timeout=30)
sftp = c.open_sftp()
sftp.put(tar, f'{PROJECT}/test-tg-send.js')
sftp.close()
os.remove(tar)

_, o, e = c.exec_command(
    f'export $(grep -v "^#" {PROJECT}/.env | xargs) && cd {PROJECT}/packages/database && NODE_PATH={PROJECT}/packages/database/node_modules:{PROJECT}/node_modules node {PROJECT}/test-tg-send.js',
    timeout=120,
)
print(o.read().decode('utf-8', 'replace'))
print(e.read().decode('utf-8', 'replace')[:2000])
c.close()
