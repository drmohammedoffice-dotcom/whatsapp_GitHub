#!/usr/bin/env node
const { Client } = require('ssh2');
const HOST = '161.97.140.171';
const USER = 'root';
const PASSWORD = process.env.VPS_PASSWORD || '';

const inspect = `
cd /root/whatsapp_GitHub
echo ---error-log---
tail -n 50 /root/.pm2/logs/worker-error.log
echo ---ls-worker-dist---
ls apps/worker/dist/apps/worker/src 2>/dev/null | head
echo ---node-start---
cd /root/whatsapp_GitHub/apps/worker && timeout 8 node dist/apps/worker/src/main.js; echo EXIT:$?
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(inspect, (err, stream) => {
      if (err) {
        console.error(err.message);
        process.exit(1);
      }
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', () => conn.end());
    });
  })
  .on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({ host: HOST, username: USER, password: PASSWORD, readyTimeout: 60000 });
