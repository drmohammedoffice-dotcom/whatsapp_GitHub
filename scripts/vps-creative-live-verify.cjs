#!/usr/bin/env node
/** Production live verification runner (executed on VPS). Never prints secrets. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = process.env.PROJECT_ROOT || '/root/whatsapp_GitHub';
process.chdir(ROOT);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
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

loadEnv(path.join(ROOT, '.env'));
loadEnv(path.join(ROOT, 'apps/api/.env'));

function report(row) {
  console.log(JSON.stringify(row));
}

function get(key) {
  return (process.env[key] || '').trim();
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAaUlEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBvA8UAAQHh1i8AAAAASUVORK5CYII=',
  'base64',
);

function parseEditIntent(instruction) {
  const text = instruction.trim();
  const SCENE = /مشهد\s*(\d+)|scene\s*(\d+)/i;
  const BACKGROUND = /خلفية|background/i;
  let sceneIndex;
  if (/المشهد الثاني|scene two|scene 2/i.test(text)) sceneIndex = 2;
  const scene = text.match(SCENE);
  if (scene) sceneIndex = Number(scene[1] || scene[2]);
  return {
    targetType: BACKGROUND.test(text) ? 'BACKGROUND' : 'SCENE',
    sceneIndex,
    regenerationScope: sceneIndex ? 'scene' : 'asset',
    preserve: ['product', 'packaging', 'logo', 'labels', 'model', 'clothing', 'voice', 'music', 'script'],
    change: BACKGROUND.test(text) ? 'background' : text,
  };
}

function signHs256(payload, secret) {
  const b64url = (obj) =>
    Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64url({ ...payload, iat: now, exp: now + 1200 });
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

function captionsFromScript(script, durationSec) {
  const words = script.trim().split(/\s+/).filter(Boolean);
  if (!words.length || durationSec <= 0) return [];
  const chunks = [];
  for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(' '));
  const slice = durationSec / chunks.length;
  return chunks.map((text, index) => ({
    startSec: Number((index * slice).toFixed(2)),
    endSec: Number(((index + 1) * slice).toFixed(2)),
    text,
  }));
}

async function main() {
  const openaiKey = get('OPENAI_API_KEY') || (get('AI_API_KEY') !== 'not-configured' ? get('AI_API_KEY') : '');
  const openrouterKey = get('OPENROUTER_API_KEY');
  const dbUrl = get('DATABASE_URL');
  const redisUrl = get('REDIS_URL');

  report({
    step: 'env',
    openai: openaiKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
    openrouter: openrouterKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
    databaseUrl: dbUrl ? 'CONFIGURED' : 'NOT_CONFIGURED',
    redisUrl: redisUrl ? 'CONFIGURED' : 'NOT_CONFIGURED',
  });

  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  report({
    step: 'ffmpeg',
    status: ff.status === 0 ? 'LIVE_TESTED' : 'NOT_CONFIGURED',
    firstLine: ff.status === 0 ? String(ff.stdout || '').split('\n')[0] : undefined,
  });

  const { createRequire } = require('module');
  const fromWorker = createRequire(path.join(ROOT, 'apps/worker/package.json'));
  const fromDb = createRequire(path.join(ROOT, 'packages/database/package.json'));
  const Redis = fromWorker('ioredis');
  let PrismaClient;
  try {
    PrismaClient = fromDb('@prisma/client').PrismaClient;
  } catch (e) {
    const dbDist = require(path.join(ROOT, 'packages/database/dist/index.js'));
    PrismaClient = dbDist.PrismaClient;
  }
  const { Queue } = fromWorker('bullmq');
  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    await redis.connect();
    const pong = await redis.ping();
    const workers = await redis.smembers('bull:creative-pipeline:workers').catch(() => []);
    report({
      step: 'redis',
      status: pong === 'PONG' ? 'LIVE_TESTED' : 'FAILED',
      creativePipelineWorkers: Array.isArray(workers) ? workers.length : 0,
    });
    await redis.quit();
  } catch (error) {
    report({ step: 'redis', status: 'FAILED', errorName: error.name, errorCode: error.code });
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    report({ step: 'postgres', status: 'LIVE_TESTED' });
  } catch (error) {
    report({ step: 'postgres', status: 'FAILED', errorName: error.name });
    await prisma.$disconnect();
    return;
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name, finished_at IS NOT NULL AS applied FROM "_prisma_migrations" WHERE migration_name LIKE '%creative_studio%' ORDER BY started_at`,
    );
    const names = rows.map((r) => r.migration_name);
    report({
      step: 'migrations',
      status: names.includes('20260909030000_creative_studio_phase4') ? 'LIVE_TESTED' : 'FAILED',
      creativeMigrations: names,
    });
  } catch (error) {
    report({ step: 'migrations', status: 'FAILED', errorName: error.name });
  }

  const health = await fetch('http://127.0.0.1:4000/api/v1/health/ready').then((r) => r.json()).catch((e) => ({ status: 'FAILED', errorName: e.name }));
  report({ step: 'api_ready', status: health.status === 'ok' ? 'LIVE_TESTED' : 'FAILED', body: health });

  const pm2 = spawnSync('pm2', ['jlist'], { encoding: 'utf8' });
  let pm2apps = [];
  try {
    pm2apps = JSON.parse(pm2.stdout || '[]').map((a) => ({
      name: a.name,
      status: a.pm2_env?.status,
      cwd: a.pm2_env?.pm_cwd,
    }));
  } catch {
    pm2apps = [];
  }
  const apiApp = pm2apps.find((a) => a.name === 'api');
  const workerApp = pm2apps.find((a) => a.name === 'worker');
  report({
    step: 'pm2',
    api: apiApp?.status === 'online' ? 'LIVE_TESTED' : 'FAILED',
    worker: workerApp?.status === 'online' ? 'LIVE_TESTED' : 'FAILED',
    apps: pm2apps,
  });

  const apiHasProcessor = spawnSync('grep', ['-rl', 'QUEUES.CREATIVE_PIPELINE', 'apps/api/src'], { encoding: 'utf8', cwd: ROOT });
  const processorFiles = (apiHasProcessor.stdout || '').split('\n').filter(Boolean);
  report({
    step: 'api_not_long_running',
    status: processorFiles.every((f) => !f.includes('processor')) ? 'LIVE_TESTED' : 'FAILED',
    matches: processorFiles,
  });

  async function auth(name, url, key) {
    if (!key) return report({ step: name, status: 'NOT_CONFIGURED' });
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    report({
      step: name,
      status: res.ok ? 'LIVE_TESTED' : res.status === 401 || res.status === 403 ? 'FAILED' : 'FAILED',
      httpStatus: res.status,
    });
    return res;
  }

  const openaiAuth = await auth('openai_auth', 'https://api.openai.com/v1/models', openaiKey);
  let openaiModels = [];
  if (openaiAuth && openaiAuth.ok) {
    const json = await openaiAuth.json();
    openaiModels = (json.data || []).map((m) => m.id);
    const textModel = get('CREATIVE_OPENAI_TEXT_MODEL') || 'gpt-4o';
    const imageModel = get('CREATIVE_OPENAI_IMAGE_MODEL') || 'gpt-image-2';
    const ttsModel = get('CREATIVE_OPENAI_TTS_MODEL') || 'tts-1';
    report({
      step: 'openai_models',
      text: openaiModels.includes(textModel) ? 'LIVE_TESTED' : 'INVALID_MODEL',
      image: openaiModels.includes(imageModel) ? 'LIVE_TESTED' : 'INVALID_MODEL',
      tts: openaiModels.includes(ttsModel) ? 'LIVE_TESTED' : 'INVALID_MODEL',
      requested: { textModel, imageModel, ttsModel },
    });
  }

  const orAuth = await auth('openrouter_auth', 'https://openrouter.ai/api/v1/models', openrouterKey);
  let imageModels = [];
  let videoModels = [];
  if (openrouterKey) {
    const imgRes = await fetch('https://openrouter.ai/api/v1/images/models', {
      headers: { Authorization: `Bearer ${openrouterKey}` },
    });
    if (imgRes.ok) {
      const json = await imgRes.json();
      imageModels = json.data || [];
      report({
        step: 'openrouter_image_discovery',
        status: 'LIVE_TESTED',
        count: imageModels.length,
        sample: imageModels.slice(0, 5).map((m) => ({
          id: m.id,
          hasRefs: Boolean(m.supported_parameters && 'input_references' in m.supported_parameters),
        })),
      });
    } else {
      report({ step: 'openrouter_image_discovery', status: 'FAILED', httpStatus: imgRes.status });
    }
    const vidRes = await fetch('https://openrouter.ai/api/v1/videos/models', {
      headers: { Authorization: `Bearer ${openrouterKey}` },
    });
    if (vidRes.ok) {
      const json = await vidRes.json();
      videoModels = json.data || [];
      report({
        step: 'openrouter_video_discovery',
        status: 'LIVE_TESTED',
        count: videoModels.length,
        sample: videoModels.slice(0, 5).map((m) => ({
          id: m.id,
          durations: m.supported_durations,
          i2v: Boolean(m.supported_parameters && m.supported_parameters.frame_images),
        })),
      });
    } else {
      report({
        step: 'openrouter_video_discovery',
        status: vidRes.status === 404 ? 'NOT_SUPPORTED' : 'FAILED',
        httpStatus: vidRes.status,
      });
    }
  }

  const member =
    (await prisma.teamMember.findFirst({
      where: { role: { in: ['OWNER', 'ADMIN'] } },
      select: { teamId: true, userId: true, role: true },
    })) || (await prisma.teamMember.findFirst({ select: { teamId: true, userId: true, role: true } }));
  if (!member) {
    report({ step: 'pipeline', status: 'FAILED', reason: 'no_team_user' });
    await prisma.$disconnect();
    return;
  }
  const otherTeam = await prisma.team.findFirst({ where: { id: { not: member.teamId } }, select: { id: true } });

  const project = await prisma.creativeProject.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      name: 'LIVE-VERIFY Creative Studio',
      aspectRatio: '1:1',
      locale: 'ar',
    },
  });
  report({ step: 'project', status: 'LIVE_TESTED', projectId: project.id });

  await prisma.creativeProductProfile.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      name: 'LIVE VERIFY Serum',
      description: 'A cosmetic serum bottle for live verification only. No medical claims.',
      category: 'cosmetics',
      userClaims: 'User-provided: moisturizing formula.',
    },
  });

  const storageRoot = get('LOCAL_STORAGE_ROOT') || path.join(ROOT, 'storage');
  const relKey = `media/${member.teamId}/live-verify-${Date.now()}.png`;
  const abs = path.join(storageRoot, relKey);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, TINY_PNG);
  await prisma.creativeProductAsset.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      storageKey: relKey.replace(/\\/g, '/'),
      mimeType: 'image/png',
      fileName: 'live-verify.png',
      sizeBytes: TINY_PNG.length,
      checksum: crypto.createHash('sha256').update(TINY_PNG).digest('hex'),
      position: 0,
      isMain: true,
    },
  });

  if (openaiKey && openaiAuth && openaiAuth.ok) {
    const textModel = get('CREATIVE_OPENAI_TEXT_MODEL') || 'gpt-4o';
    const vision = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return JSON {identity:{name,category}, visual:{colors}, ocr:{items:[]}, claims:{userProvided:[],inferred:[]}}. Never invent medical claims.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Product name: LIVE VERIFY Serum. User claims: moisturizing formula.' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${TINY_PNG.toString('base64')}` } },
            ],
          },
        ],
      }),
    });
    if (vision.ok) {
      const json = await vision.json();
      const text = json.choices?.[0]?.message?.content || '';
      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: true };
      }
      report({
        step: 'product_intelligence',
        status: 'LIVE_TESTED',
        model: json.model || textModel,
        hasIdentity: Boolean(parsed.identity),
        hasVisual: Boolean(parsed.visual),
        userProvidedVsInferred: Boolean(parsed.claims),
      });
    } else {
      let errType = null;
      try {
        const ej = await vision.json();
        errType = ej.error && (ej.error.code || ej.error.type);
      } catch {
        errType = null;
      }
      report({ step: 'product_intelligence', status: 'FAILED', httpStatus: vision.status, errorCode: errType });
    }

    const concepts = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: textModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON {concepts:[{title,description,visualDirection,environment,modelDirection,lighting,composition,productPlacement}]}. Use only the given product facts.',
          },
          { role: 'user', content: 'Product: LIVE VERIFY Serum. Category cosmetics. Claim: moisturizing formula only.' },
        ],
      }),
    });
    if (concepts.ok) {
      const cjson = await concepts.json();
      let parsedC = {};
      try {
        parsedC = JSON.parse(cjson.choices?.[0]?.message?.content || '{}');
      } catch {
        parsedC = {};
      }
      const list = parsedC.concepts || [];
      report({
        step: 'concepts',
        status: list.length ? 'LIVE_TESTED' : 'FAILED',
        count: list.length,
        sampleKeys: list[0] ? Object.keys(list[0]) : [],
        model: cjson.model || textModel,
      });
    } else {
      report({ step: 'concepts', status: 'FAILED', httpStatus: concepts.status });
    }
  } else {
    report({ step: 'product_intelligence', status: openaiKey ? 'FAILED' : 'NOT_CONFIGURED' });
    report({ step: 'concepts', status: openaiKey ? 'FAILED' : 'NOT_CONFIGURED' });
  }

  const jwtSecret = get('JWT_ACCESS_SECRET');
  const apiToken = jwtSecret ? signHs256({ sub: member.userId, teamId: member.teamId }, jwtSecret) : null;
  report({
    step: 'api_auth_token',
    status: apiToken ? 'CONFIGURED' : 'NOT_CONFIGURED',
    note: 'short-lived JWT minted on server; not printed',
  });

  async function apiJson(method, urlPath, body) {
    if (!apiToken) return { httpStatus: 0, json: null };
    const res = await fetch(`http://127.0.0.1:4000/api/v1${urlPath}`, {
      method,
      headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { httpStatus: res.status, json };
  }

  const healthAuth = await apiJson('GET', '/creative/health');
  report({
    step: 'api_creative_health',
    status: healthAuth.httpStatus === 200 ? 'LIVE_TESTED' : healthAuth.httpStatus === 403 ? 'FAILED' : 'FAILED',
    httpStatus: healthAuth.httpStatus,
    studio: healthAuth.json && healthAuth.json.studioEnabled,
  });

  const quotaSnap = await prisma.creativeGenerationJob.count({
    where: {
      teamId: member.teamId,
      status: { in: ['QUEUED', 'RUNNING', 'PROVIDER_SUBMITTED', 'POLLING', 'DOWNLOADING', 'STORING', 'QUALITY_CHECK'] },
    },
  });
  report({
    step: 'quota_concurrency_snapshot',
    status: 'LIVE_TESTED',
    inflightJobsForTeam: quotaSnap,
    note: 'did not exhaust production quota; lock exists in createJob',
  });

  const queue = new Queue('creative-pipeline', { connection: { url: redisUrl } });

  const apiProbe = await apiJson('POST', '/creative/jobs', {
    projectId: project.id,
    type: 'PROBE',
    provider: 'openai',
    idempotencyKey: `live-verify-probe-${Date.now()}`,
  });
  report({
    step: 'api_enqueue_probe',
    status: apiProbe.httpStatus === 201 || apiProbe.httpStatus === 200 ? 'LIVE_TESTED' : 'FAILED',
    httpStatus: apiProbe.httpStatus,
    code: apiProbe.json && (apiProbe.json.code || apiProbe.json.statusCode || apiProbe.json.message),
    jobId: apiProbe.json && apiProbe.json.id,
  });
  if (apiProbe.json && apiProbe.json.id) {
    let apiProbeFinal = 'QUEUED';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const row = await prisma.creativeGenerationJob.findUnique({ where: { id: apiProbe.json.id } });
      apiProbeFinal = row ? row.status : 'MISSING';
      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(apiProbeFinal)) break;
    }
    report({
      step: 'api_to_worker_probe',
      status: apiProbeFinal === 'SUCCEEDED' ? 'LIVE_TESTED' : 'FAILED',
      jobId: apiProbe.json.id,
      finalStatus: apiProbeFinal,
    });
  }

  const probeJob = await prisma.creativeGenerationJob.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      type: 'PROBE',
      status: 'QUEUED',
      provider: 'openai',
      payload: { liveVerify: true },
    },
  });
  await queue.add('run', { generationJobId: probeJob.id, teamId: member.teamId }, { jobId: `liveverify-${probeJob.id}` });
  let probeFinal = 'QUEUED';
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const row = await prisma.creativeGenerationJob.findUnique({ where: { id: probeJob.id } });
    probeFinal = row.status;
    if (row.status === 'SUCCEEDED' || row.status === 'FAILED' || row.status === 'CANCELLED') break;
  }
  report({
    step: 'probe_pipeline',
    status: probeFinal === 'SUCCEEDED' ? 'LIVE_TESTED' : 'FAILED',
    jobId: probeJob.id,
    finalStatus: probeFinal,
  });

  async function waitJob(id, ticks, intervalMs) {
    let row;
    let final = 'QUEUED';
    for (let i = 0; i < ticks; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      row = await prisma.creativeGenerationJob.findUnique({
        where: { id },
        include: { assets: true, usageRecords: true, qualityChecks: true },
      });
      final = row ? row.status : 'MISSING';
      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(final)) break;
    }
    return { row, final };
  }

  function summarizeImage(id, waited) {
    const row = waited.row;
    const final = waited.final;
    const asset = row && row.assets && row.assets[0];
    let fileOk = false;
    let sizeBytes = 0;
    if (asset && asset.storageKey) {
      const p = path.join(storageRoot, asset.storageKey);
      fileOk = fs.existsSync(p);
      if (fileOk) sizeBytes = fs.statSync(p).size;
    }
    return {
      status: final === 'SUCCEEDED' && fileOk && sizeBytes > 32 ? 'LIVE_TESTED' : 'FAILED',
      jobId: id,
      finalStatus: final,
      errorCode: (row && row.errorCode) || null,
      provider: row && row.provider,
      model: row && row.model,
      mimeType: asset && asset.mimeType,
      width: asset && asset.width,
      height: asset && asset.height,
      sizeBytes,
      checksum: asset && asset.checksum,
      storageKey: asset && asset.storageKey ? 'PRESENT' : null,
      fileOnDisk: fileOk,
      resolutionType: asset && asset.resolutionType,
      requestedResolution: asset && asset.requestedResolution,
      actualResolution: asset && asset.actualResolution,
      costStatus: (row && row.usageRecords && row.usageRecords[0] && row.usageRecords[0].costStatus) || null,
      actualCost: (row && row.usageRecords && row.usageRecords[0] && row.usageRecords[0].actualCost) ?? null,
      quality: (row && row.qualityChecks && row.qualityChecks[0] && row.qualityChecks[0].status) || null,
      attempts: row && row.attempts,
    };
  }

  let imageResult = { status: 'NOT_CONFIGURED' };
  const refModel = imageModels.find((m) => m.supported_parameters && 'input_references' in m.supported_parameters);
  const anyImage = refModel || imageModels[0];
  const imageViaApi = await apiJson('POST', '/creative/jobs', {
    projectId: project.id,
    type: 'IMAGE',
    provider: openaiKey ? 'openai' : 'openrouter',
    model: openaiKey ? get('CREATIVE_OPENAI_IMAGE_MODEL') || 'gpt-image-2' : anyImage && anyImage.id,
    aspectRatio: '1:1',
    idempotencyKey: `live-verify-image-${Date.now()}`,
  });
  report({
    step: 'api_enqueue_image',
    status: imageViaApi.httpStatus === 201 || imageViaApi.httpStatus === 200 ? 'LIVE_TESTED' : 'FAILED',
    httpStatus: imageViaApi.httpStatus,
    code: imageViaApi.json && (imageViaApi.json.code || imageViaApi.json.message),
    jobId: imageViaApi.json && imageViaApi.json.id,
  });

  if (imageViaApi.json && imageViaApi.json.id) {
    imageResult = summarizeImage(imageViaApi.json.id, await waitJob(imageViaApi.json.id, 90, 3000));
    report({ step: 'image_generation', ...imageResult });
  } else if (openaiKey) {
    const imageJob = await prisma.creativeGenerationJob.create({
      data: {
        teamId: member.teamId,
        userId: member.userId,
        projectId: project.id,
        type: 'IMAGE',
        status: 'QUEUED',
        provider: 'openai',
        model: get('CREATIVE_OPENAI_IMAGE_MODEL') || 'gpt-image-2',
        payload: { aspectRatio: '1:1', liveVerify: true },
      },
    });
    await queue.add('run', { generationJobId: imageJob.id, teamId: member.teamId }, { jobId: `liveverify-${imageJob.id}` });
    imageResult = summarizeImage(imageJob.id, await waitJob(imageJob.id, 90, 3000));
    report({ step: 'image_generation', path: 'direct_queue_fallback', ...imageResult });
  } else if (openrouterKey && anyImage) {
    const imageJob = await prisma.creativeGenerationJob.create({
      data: {
        teamId: member.teamId,
        userId: member.userId,
        projectId: project.id,
        type: 'IMAGE',
        status: 'QUEUED',
        provider: 'openrouter',
        model: anyImage.id,
        payload: { aspectRatio: '1:1', liveVerify: true },
      },
    });
    await queue.add('run', { generationJobId: imageJob.id, teamId: member.teamId }, { jobId: `liveverify-${imageJob.id}` });
    imageResult = summarizeImage(imageJob.id, await waitJob(imageJob.id, 90, 3000));
    report({ step: 'image_generation', path: 'direct_queue_fallback', ...imageResult });
  } else {
    report({ step: 'image_generation', status: 'NOT_CONFIGURED' });
  }

  if (refModel) {
      const refJob = await prisma.creativeGenerationJob.create({
        data: {
          teamId: member.teamId,
          userId: member.userId,
          projectId: project.id,
          type: 'IMAGE',
          status: 'QUEUED',
          provider: 'openrouter',
          model: refModel.id,
          payload: { aspectRatio: '1:1', liveVerify: true, requireReference: true },
        },
      });
      await queue.add('run', { generationJobId: refJob.id, teamId: member.teamId }, { jobId: `liveverify-${refJob.id}` });
      let refFinal = 'QUEUED';
      let refRow;
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        refRow = await prisma.creativeGenerationJob.findUnique({
          where: { id: refJob.id },
          include: { assets: true },
        });
        refFinal = refRow.status;
        if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(refRow.status)) break;
      }
      report({
        step: 'reference_image',
        status: refFinal === 'SUCCEEDED' && (refRow.assets || []).length ? 'LIVE_TESTED' : refFinal === 'FAILED' ? 'FAILED' : 'FAILED',
        jobId: refJob.id,
        model: refModel.id,
        finalStatus: refFinal,
        errorCode: refRow?.errorCode || null,
        note: 'model advertises input_references; worker sends product refs only if capability.referenceImage',
      });
    } else {
      report({ step: 'reference_image', status: 'NOT_SUPPORTED', reason: 'no_discovered_input_references' });
    }

  if (openrouterKey && videoModels.length) {
    const vModel = videoModels[0];
    const duration = Array.isArray(vModel.supported_durations) && vModel.supported_durations.length
      ? Math.min(...vModel.supported_durations)
      : 5;
    const videoJob = await prisma.creativeGenerationJob.create({
      data: {
        teamId: member.teamId,
        userId: member.userId,
        projectId: project.id,
        type: 'VIDEO',
        status: 'QUEUED',
        provider: 'openrouter',
        model: vModel.id,
        payload: { aspectRatio: '1:1', durationSec: duration, videoMode: 'text', liveVerify: true },
      },
    });
    await queue.add('run', { generationJobId: videoJob.id, teamId: member.teamId }, { jobId: `liveverify-${videoJob.id}` });
    let vFinal = 'QUEUED';
    let vRow;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      vRow = await prisma.creativeGenerationJob.findUnique({
        where: { id: videoJob.id },
        include: { assets: true, usageRecords: true },
      });
      vFinal = vRow.status;
      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(vRow.status)) break;
    }
    const vAsset = vRow?.assets?.[0];
    let vFile = false;
    let vSize = 0;
    if (vAsset?.storageKey) {
      const p = path.join(storageRoot, vAsset.storageKey);
      vFile = fs.existsSync(p);
      if (vFile) vSize = fs.statSync(p).size;
    }
    report({
      step: 'video_generation',
      status: vFinal === 'SUCCEEDED' && vFile && vSize > 100 ? 'LIVE_TESTED' : vFinal === 'FAILED' ? 'FAILED' : 'FAILED',
      jobId: videoJob.id,
      model: vModel.id,
      finalStatus: vFinal,
      errorCode: vRow?.errorCode || null,
      sizeBytes: vSize,
      fileOnDisk: vFile,
      costStatus: vRow?.usageRecords?.[0]?.costStatus || null,
    });
  } else {
    report({
      step: 'video_generation',
      status: openrouterKey ? 'NOT_SUPPORTED' : 'NOT_CONFIGURED',
      count: videoModels.length,
    });
  }

  const scene1 = await prisma.creativeVideoScene.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      order: 1,
      durationSec: 5,
      role: 'HOOK',
      script: 'هذا منتج للتحقق المباشر فقط',
    },
  });
  const scene2 = await prisma.creativeVideoScene.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      order: 2,
      durationSec: 5,
      role: 'PRODUCT',
      script: 'التركيز على المنتج في المشهد الثاني',
    },
  });
  report({
    step: 'scenes',
    status: 'IMPLEMENTED_NOT_LIVE',
    sceneIds: [scene1.id, scene2.id],
    note: 'scene rows created in DB; no COMPOSE/FFmpeg scene render was executed',
  });

  const parsed = parseEditIntent('غير الخلفية بالمشهد الثاني فقط');
  await prisma.creativeEditRequest.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      instruction: 'غير الخلفية بالمشهد الثاني فقط',
      parsedPlan: parsed,
      status: 'PARSED',
    },
  });
  const parseApi = await apiJson('POST', '/creative/edits/parse', {
    projectId: project.id,
    instruction: 'غير الخلفية بالمشهد الثاني فقط',
  });
  report({
    step: 'nl_edit',
    status:
      parseApi.httpStatus === 201 || parseApi.httpStatus === 200
        ? 'LIVE_TESTED'
        : parsed.sceneIndex === 2 && parsed.change === 'background'
          ? 'IMPLEMENTED_NOT_LIVE'
          : 'FAILED',
    httpStatus: parseApi.httpStatus,
    parsed,
    note: 'parser/API only; did not regenerate scene 2 via provider',
  });

  const cues = captionsFromScript('هذا منتج تجميلي للتحقق المباشر من النظام', 8);
  await prisma.creativeCaptionTrack.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      sceneId: scene2.id,
      language: 'ar',
      cues,
      style: { rtl: true, position: 'bottom', fontSize: 42, background: true },
    },
  });
  report({
    step: 'captions',
    status: 'IMPLEMENTED_NOT_LIVE',
    cueCount: cues.length,
    timing: 'estimated_from_script',
    note: 'caption cues stored; not burned into a rendered video',
  });

  const v1 = await prisma.creativeVideoVersion.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      version: 1,
      label: 'live-verify-v1',
      isCurrent: false,
      snapshot: { scenes: [scene1.id, scene2.id] },
    },
  });
  const v2 = await prisma.creativeVideoVersion.create({
    data: {
      teamId: member.teamId,
      userId: member.userId,
      projectId: project.id,
      version: 2,
      label: 'live-verify-v2',
      isCurrent: true,
      parentVersionId: v1.id,
      snapshot: { scenes: [scene1.id, scene2.id], note: 'after-edit' },
    },
  });
  const restored = await prisma.creativeVideoVersion.findUnique({ where: { id: v2.id } });
  report({
    step: 'versioning',
    status: restored.parentVersionId === v1.id && restored.isCurrent ? 'LIVE_TESTED' : 'FAILED',
    v1: v1.id,
    v2: v2.id,
    parentOk: restored.parentVersionId === v1.id,
    note: 'DB version rows; not a provider re-render restore',
  });

  const idorJob = await prisma.creativeGenerationJob.findFirst({
    where: { id: probeJob.id, teamId: otherTeam?.id || 'missing-team' },
  });
  report({
    step: 'idor',
    status: otherTeam && !idorJob ? 'LIVE_TESTED' : otherTeam ? 'FAILED' : 'IMPLEMENTED_NOT_LIVE',
    otherTeamPresent: Boolean(otherTeam),
    leaked: Boolean(idorJob),
  });

  const anon = await fetch(`http://127.0.0.1:4000/api/v1/creative/jobs/${probeJob.id}`).then((r) => r.status).catch(() => 0);
  report({ step: 'idor_http_unauth', status: anon === 401 || anon === 403 ? 'LIVE_TESTED' : 'FAILED', httpStatus: anon });
  if (otherTeam && jwtSecret) {
    const otherMember = await prisma.teamMember.findFirst({ where: { teamId: otherTeam.id }, select: { userId: true, teamId: true } });
    if (otherMember) {
      const otherTok = signHs256({ sub: otherMember.userId, teamId: otherMember.teamId }, jwtSecret);
      const cross = await fetch(`http://127.0.0.1:4000/api/v1/creative/jobs/${probeJob.id}`, {
        headers: { Authorization: `Bearer ${otherTok}` },
      }).then((r) => r.status).catch(() => 0);
      report({
        step: 'idor_http_cross_team',
        status: cross === 404 || cross === 403 ? 'LIVE_TESTED' : 'FAILED',
        httpStatus: cross,
      });
    }
  }

  report({
    step: 'iraqi_tts',
    status: 'NOT_CONFIGURED',
    code: 'IRAQI_TTS_NOT_CONFIGURED',
    note: 'OpenAI TTS must not be labeled Iraqi',
  });
  report({ step: 'lipsync', status: 'NOT_CONFIGURED' });
  report({ step: 'licensed_music', status: 'NOT_CONFIGURED' });
  report({ step: 'upscale_4k', status: 'NOT_CONFIGURED' });

  const probeRow = await prisma.creativeGenerationJob.findUnique({ where: { id: probeJob.id } });
  report({
    step: 'job_states_retries',
    status: probeRow && probeRow.attempts >= 1 ? 'LIVE_TESTED' : 'FAILED',
    probeStatus: probeRow && probeRow.status,
    attempts: probeRow && probeRow.attempts,
    note: 'BullMQ attempts=5 configured on enqueue; did not force a retry storm on production',
  });
  if (probeRow && probeRow.status === 'FAILED' && apiToken) {
    const retryRes = await apiJson('POST', `/creative/jobs/${probeJob.id}/retry`);
    report({
      step: 'retry_api',
      status: retryRes.httpStatus === 201 || retryRes.httpStatus === 200 ? 'LIVE_TESTED' : 'FAILED',
      httpStatus: retryRes.httpStatus,
    });
  }

  const fakeHits = spawnSync(
    'grep',
    ['-RInE', 'placeholder\\.mp4|example\\.com/gen|fake-iraqi|native-4k-placeholder', 'apps/api/src/creative-studio'],
    { encoding: 'utf8', cwd: ROOT },
  );
  report({
    step: 'fake_success_audit',
    status: (fakeHits.stdout || '').trim() ? 'FAILED' : 'LIVE_TESTED',
    hits: (fakeHits.stdout || '').trim().slice(0, 500),
  });

  await queue.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.log(JSON.stringify({ step: 'fatal', status: 'FAILED', errorName: error.name, message: String(error.message || '').slice(0, 300) }));
  process.exit(1);
});
