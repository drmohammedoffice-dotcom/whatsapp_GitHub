#!/usr/bin/env node
/** Run a remote command on the VPS via ssh2 (same credentials as deploy). */
const { Client } = require('ssh2');

const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';
const command = process.argv.slice(2).join(' ');
if (!command) {
  console.error('Usage: node remote-exec-vps.js <command>');
  process.exit(1);
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
  await new Promise((resolve, reject) => {
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let code = 0;
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (c) => {
        code = c ?? 0;
        resolve(code);
      });
    });
  }).then((code) => {
    conn.end();
    process.exit(code);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
