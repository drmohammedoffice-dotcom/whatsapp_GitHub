'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envFile = path.resolve(process.cwd(), '.env');
const buf = fs.readFileSync(envFile);
const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf8').replace(/^\uFEFF/, '');
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (process.env[key] === undefined) process.env[key] = value;
}

const status = spawnSync('pnpm', ['--filter', '@watsapp/database', 'exec', 'prisma', 'migrate', 'status'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env,
  shell: true,
});
console.log(status.stdout || '');
console.log(status.stderr || '');
console.log('STATUS_EXIT', status.status);
