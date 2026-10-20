'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readText(file) {
  if (!fs.existsSync(file)) return { exists: false, text: '', encoding: 'missing' };
  const buf = fs.readFileSync(file);
  let encoding = 'utf8';
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = 'utf16le';
    text = buf.slice(2).toString('utf16le');
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = 'utf16be';
    text = Buffer.from(buf.slice(2)).swap16().toString('utf16le');
  } else {
    text = buf.toString('utf8').replace(/^\uFEFF/, '');
  }
  return { exists: true, text, encoding };
}

function loadEnv(file) {
  const loaded = readText(file);
  if (!loaded.exists) return loaded;
  for (const raw of loaded.text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return loaded;
}

function status(name, value, kind) {
  const v = (value || '').trim();
  if (!v) return { name, status: 'NOT_CONFIGURED' };
  if (kind === 'openai' && !/^sk-/.test(v)) return { name, status: 'INVALID' };
  if (kind === 'openrouter' && !(v.startsWith('sk-or-') || v.startsWith('sk-'))) return { name, status: 'INVALID' };
  if (kind === 'db' && !/^postgres(ql)?:\/\//i.test(v)) return { name, status: 'INVALID' };
  if (kind === 'redis' && !/^(redis|rediss):\/\//i.test(v)) return { name, status: 'INVALID' };
  return { name, status: 'CONFIGURED', length: v.length };
}

const root = path.resolve(__dirname, '../../../');
const envFiles = [
  path.join(root, '.env'),
  path.join(process.cwd(), '.env'),
  path.join(root, 'apps/web/.env.local'),
];

const loadedFiles = envFiles.map((file) => {
  const info = loadEnv(file);
  return { file: path.relative(root, file), exists: info.exists, encoding: info.encoding || 'missing' };
});

async function pingHttp(name, url, key) {
  if (!key) return { name, status: 'NOT_CONFIGURED' };
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 401 || res.status === 403) return { name, status: 'INVALID', httpStatus: res.status };
    if (!res.ok) return { name, status: 'UNAVAILABLE', httpStatus: res.status };
    return { name, status: 'CONFIGURED', httpStatus: res.status };
  } catch {
    return { name, status: 'UNAVAILABLE' };
  }
}

async function main() {
  console.log(JSON.stringify({ envFiles: loadedFiles }));
  console.log(JSON.stringify(status('OPENAI_API_KEY', process.env.OPENAI_API_KEY, 'openai')));
  console.log(JSON.stringify(status('OPENROUTER_API_KEY', process.env.OPENROUTER_API_KEY, 'openrouter')));
  console.log(JSON.stringify(status('DATABASE_URL', process.env.DATABASE_URL, 'db')));
  console.log(JSON.stringify(status('REDIS_URL', process.env.REDIS_URL, 'redis')));
  console.log(JSON.stringify(status('LOCAL_STORAGE_ROOT', process.env.LOCAL_STORAGE_ROOT || './storage')));
  console.log(
    JSON.stringify({
      name: 'CREATIVE_OPENAI_TEXT_MODEL',
      status: (process.env.CREATIVE_OPENAI_TEXT_MODEL || 'gpt-4o') ? 'CONFIGURED' : 'NOT_CONFIGURED',
      value: process.env.CREATIVE_OPENAI_TEXT_MODEL || 'gpt-4o (default)',
    }),
  );
  console.log(
    JSON.stringify({
      name: 'CREATIVE_OPENAI_IMAGE_MODEL',
      status: 'CONFIGURED',
      value: process.env.CREATIVE_OPENAI_IMAGE_MODEL || 'gpt-image-2 (default)',
    }),
  );
  console.log(
    JSON.stringify({
      name: 'CREATIVE_OPENAI_TTS_MODEL',
      status: 'CONFIGURED',
      value: process.env.CREATIVE_OPENAI_TTS_MODEL || 'tts-1 (default)',
    }),
  );

  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  console.log(
    JSON.stringify({
      name: 'FFMPEG',
      status: ff.status === 0 ? 'CONFIGURED' : 'NOT_CONFIGURED',
      error: ff.error ? ff.error.code : undefined,
    }),
  );

  const openai = (process.env.OPENAI_API_KEY || '').trim();
  const openrouter = (process.env.OPENROUTER_API_KEY || '').trim();
  const openaiAuth = await pingHttp('OPENAI_AUTH', 'https://api.openai.com/v1/models', openai);
  console.log(JSON.stringify(openaiAuth));
  const orAuth = await pingHttp('OPENROUTER_AUTH', 'https://openrouter.ai/api/v1/models', openrouter);
  console.log(JSON.stringify(orAuth));
  await pingHttp('OPENROUTER_IMAGES', 'https://openrouter.ai/api/v1/images/models', openrouter).then((r) =>
    console.log(JSON.stringify(r)),
  );
  await pingHttp('OPENROUTER_VIDEOS', 'https://openrouter.ai/api/v1/videos/models', openrouter).then((r) =>
    console.log(JSON.stringify(r)),
  );
}

main().catch((error) => {
  console.log(JSON.stringify({ name: 'probe', status: 'UNAVAILABLE', errorName: error.name }));
  process.exitCode = 1;
});
