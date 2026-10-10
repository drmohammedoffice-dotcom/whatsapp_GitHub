'use strict';
const fs = require('fs');
const path = require('path');

const file = path.resolve(process.cwd(), '.env');
const buf = fs.readFileSync(file);
const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf8').replace(/^\uFEFF/, '');
const names = [];
for (const line of text.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 1) continue;
  const key = t.slice(0, eq).trim();
  const value = t.slice(eq + 1).trim();
  if (!value) continue;
  if (/OPENAI|OPENROUTER|AI_API|REDIS|DATABASE|STORAGE|FFMPEG|CREATIVE/i.test(key)) names.push(key);
}
console.log(JSON.stringify({ matchingKeys: names.sort() }));
