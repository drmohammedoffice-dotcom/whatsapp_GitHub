'use strict';

/**
 * Production validation harness. Never prints secret values.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const buf = fs.readFileSync(file);
  const text =
    buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf8').replace(/^\uFEFF/, '');
  for (const raw of text.split(/\r?\n/)) {
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
}

loadEnv(path.resolve(process.cwd(), '.env'));

function openaiKey() {
  const dedicated = (process.env.OPENAI_API_KEY || '').trim();
  if (dedicated) return dedicated;
  const shared = (process.env.AI_API_KEY || '').trim();
  if (!shared || shared === 'not-configured') return '';
  const base = process.env.OPENAI_API_BASE_URL || process.env.AI_API_BASE_URL || '';
  if (base && !base.includes('api.openai.com')) return '';
  return shared;
}

function report(obj) {
  console.log(JSON.stringify(obj));
}

async function main() {
  const key = openaiKey();
  const openrouter = (process.env.OPENROUTER_API_KEY || '').trim();
  report({ step: 'openai_key', status: key ? 'CONFIGURED' : 'NOT_CONFIGURED' });
  report({ step: 'openrouter_key', status: openrouter ? 'CONFIGURED' : 'NOT_CONFIGURED' });
  report({ step: 'database_url', status: (process.env.DATABASE_URL || '').trim() ? 'CONFIGURED' : 'NOT_CONFIGURED' });
  report({ step: 'redis_url', status: (process.env.REDIS_URL || '').trim() ? 'CONFIGURED' : 'NOT_CONFIGURED' });

  if (key) {
    const modelsRes = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    report({ step: 'openai_auth', httpStatus: modelsRes.status, status: modelsRes.ok ? 'CONNECTED' : modelsRes.status === 401 ? 'INVALID' : 'UNAVAILABLE' });
    if (modelsRes.ok) {
      const json = await modelsRes.json();
      const ids = (json.data || []).map((m) => m.id);
      const wanted = [
        process.env.CREATIVE_OPENAI_TEXT_MODEL || 'gpt-4o',
        process.env.CREATIVE_OPENAI_IMAGE_MODEL || 'gpt-image-2',
        process.env.CREATIVE_OPENAI_TTS_MODEL || 'tts-1',
      ];
      for (const id of wanted) {
        report({ step: 'openai_model', model: id, status: ids.includes(id) ? 'CONFIGURED' : 'INVALID_MODEL' });
      }
    }
  } else {
    report({ step: 'openai_auth', status: 'NOT_CONFIGURED' });
  }

  if (openrouter) {
    const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${openrouter}` } });
    report({ step: 'openrouter_auth', httpStatus: r.status, status: r.ok ? 'CONNECTED' : r.status === 401 ? 'INVALID' : 'UNAVAILABLE' });
  } else {
    report({ step: 'openrouter_auth', status: 'NOT_CONFIGURED' });
  }

  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', windowsHide: true });
  report({ step: 'ffmpeg', status: ff.status === 0 ? 'CONFIGURED' : 'NOT_CONFIGURED' });

  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    await redis.connect();
    const pong = await redis.ping();
    report({ step: 'redis', status: pong === 'PONG' ? 'CONFIGURED' : 'UNAVAILABLE', ping: pong });
    await redis.quit();
  } catch (error) {
    report({ step: 'redis', status: 'UNAVAILABLE', errorName: error.name, errorCode: error.code });
  }
}

main().catch((error) => {
  report({ step: 'fatal', status: 'UNAVAILABLE', errorName: error.name });
  process.exitCode = 1;
});
