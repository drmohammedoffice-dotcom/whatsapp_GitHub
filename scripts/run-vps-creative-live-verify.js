#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const PROJECT = '/root/whatsapp_GitHub';
const LOCAL = path.resolve(__dirname, 'vps-creative-live-verify.cjs');
const REMOTE = '/tmp/vps-creative-live-verify.cjs';

function exec(conn, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error('timeout'));
      }, timeoutMs);
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, out, errOut });
      });
      stream.on('data', (d) => {
        const s = d.toString();
        out += s;
        process.stdout.write(s);
      });
      stream.stderr.on('data', (d) => {
        const s = d.toString();
        errOut += s;
        process.stderr.write(s);
      });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: USER,
      password: PASSWORD,
      readyTimeout: 60000,
    });
  });
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  await new Promise((resolve, reject) => {
    sftp.fastPut(LOCAL, REMOTE, (err) => (err ? reject(err) : resolve()));
  });
  const { code } = await exec(conn, `cd ${PROJECT} && node ${REMOTE}`, 900000);
  await exec(conn, `rm -f ${REMOTE}`, 15000).catch(() => undefined);
  conn.end();
  process.exit(code || 0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
