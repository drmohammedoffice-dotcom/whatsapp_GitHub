const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

function loadEnv() {
  const path = '/root/whatsapp_GitHub/.env';
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const META_GRAPH = 'https://graph.facebook.com/v21.0';
const userToken = process.env.META_USER_TOKEN;
if (!userToken) {
  console.error('META_USER_TOKEN missing');
  process.exit(1);
}

function graphGet(pathOrUrl, params = {}) {
  const url = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(`${META_GRAPH}${pathOrUrl}`);
  if (!pathOrUrl.startsWith('http')) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 400 || json.error) reject(json.error || json);
            else resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function graphPost(path, params = {}) {
  const url = new URL(`${META_GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST' }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          if (res.statusCode >= 400 || json.error) reject(json.error || json);
          else resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function encryptJson(value) {
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

function pickPage(pages, targetPageId) {
  if (targetPageId) {
    const hit = pages.find((p) => p.id === targetPageId);
    if (hit?.access_token) return hit;
  }
  return (
    pages.find((p) => /almutamayiz|المتميز/i.test(p.name || '')) ||
    pages.find((p) => p.access_token) ||
    pages[0]
  );
}

async function fetchAllPages(userToken) {
  const pages = [];
  let path = '/me/accounts';
  let params = { fields: 'id,name,access_token', limit: 100, access_token: userToken };
  while (path) {
    const data = await graphGet(path, params);
    pages.push(...(data.data || []));
    const next = data.paging?.next;
    if (!next) break;
    path = next;
    params = {};
  }
  return pages;
}

(async () => {
  const targetPageId = process.env.TARGET_PAGE_ID || '109010225473986';
  let pages = await fetchAllPages(userToken);
  let page = pickPage(pages, targetPageId);

  if (!page?.access_token && targetPageId) {
    const direct = await graphGet(`/${targetPageId}`, {
      fields: 'id,name,access_token',
      access_token: userToken,
    });
    if (direct?.access_token) page = direct;
  }

  if (!pages.length && page) pages = [page];
  if (!pages.length) {
    console.error('NO_PAGES');
    process.exit(1);
  }
  console.log('PAGES', pages.map((p) => `${p.id}:${p.name}`).join(' | '));

  if (!page?.access_token) {
    console.error('NO_PAGE_TOKEN');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const team = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!team) {
    console.error('NO_TEAM');
    process.exit(1);
  }

  const existing = await prisma.channel.findFirst({
    where: {
      provider: 'META_MESSENGER',
      externalId: page.id,
      teamId: team.id,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const channel = existing
    ? await prisma.channel.update({
        where: { id: existing.id },
        data: {
          name: page.name || existing.name,
          status: 'CONNECTED',
          lastSeenAt: new Date(),
          metadata: {
            pageId: page.id,
            connectionSource: 'manual_token_install',
            tokenEnc: encryptJson(page.access_token),
          },
        },
      })
    : await prisma.channel.create({
        data: {
          teamId: team.id,
          provider: 'META_MESSENGER',
          purpose: 'INBOX',
          name: page.name || 'Facebook Page',
          status: 'CONNECTED',
          externalId: page.id,
          lastSeenAt: new Date(),
          metadata: {
            pageId: page.id,
            connectionSource: 'manual_token_install',
            tokenEnc: encryptJson(page.access_token),
          },
        },
      });

  await prisma.channelToken.upsert({
    where: { channelId: channel.id },
    create: {
      channelId: channel.id,
      encryptedAccessToken: encryptJson(page.access_token),
      lastRefreshedAt: new Date(),
    },
    update: {
      encryptedAccessToken: encryptJson(page.access_token),
      lastRefreshedAt: new Date(),
    },
  });

  await graphPost(`/${page.id}/subscribed_apps`, {
    subscribed_fields:
      'messages,messaging_postbacks,message_echoes,message_reads,messaging_handovers,feed',
    access_token: page.access_token,
  }).catch((e) => {
    console.warn('WEBHOOK_SUBSCRIBE_FAILED', JSON.stringify(e));
  });

  console.log('UPDATED', channel.id, page.id, page.name);

  await prisma.channel.updateMany({
    where: {
      provider: 'META_MESSENGER',
      externalId: { not: page.id },
      metadata: { path: ['connectionSource'], equals: 'manual_token_install' },
    },
    data: { status: 'DISCONNECTED' },
  });

  await prisma.$disconnect();
  console.log('DONE');
})().catch((e) => {
  console.error('ERROR', JSON.stringify(e));
  process.exit(1);
});
