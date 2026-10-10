#!/usr/bin/env node
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const localFile = path.resolve(process.argv[2] || '');
const remoteFile = process.argv[3] || `/tmp/${path.basename(localFile)}`;
const remoteCmd = process.argv[4] || `node ${remoteFile}`;

if (!localFile || !fs.existsSync(localFile)) {
  console.error('Usage: node upload-and-run-vps.js <localFile> [remotePath] [remoteCommand]');
  process.exit(1);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000,
    });
  });
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  await new Promise((resolve, reject) => {
    sftp.fastPut(localFile, remoteFile, (err) => (err ? reject(err) : resolve()));
  });
  console.log('Uploaded', localFile, '->', remoteFile);
  const code = await new Promise((resolve, reject) => {
    conn.exec(remoteCmd, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (c) => resolve(c ?? 0));
    });
  });
  conn.end();
  process.exit(code);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
