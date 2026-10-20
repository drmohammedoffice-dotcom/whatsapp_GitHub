'use strict';
const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), '.env');
const buf = fs.readFileSync(file);
const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf8').replace(/^\uFEFF/, '');
const wanted = ['AI_API_BASE_URL', 'AI_GATEWAY_BASE_URL', 'OPENROUTER_KEYS', 'AI_API_KEY_1', 'OPENAI_API_BASE_URL', 'OPENROUTER_API_BASE_URL'];
const out = {};
for (const line of text.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 1) continue;
  const key = t.slice(0, eq).trim();
  let value = t.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!wanted.includes(key)) continue;
  if (key === 'OPENROUTER_KEYS' || key.startsWith('AI_API_KEY')) {
    out[key] = value ? 'CONFIGURED' : 'NOT_CONFIGURED';
    continue;
  }
  try {
    out[key] = { status: 'CONFIGURED', host: new URL(value).host };
  } catch {
    out[key] = { status: value ? 'INVALID' : 'NOT_CONFIGURED' };
  }
}
console.log(JSON.stringify(out));
