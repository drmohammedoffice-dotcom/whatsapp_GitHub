const https = require('https');
const { URL } = require('url');
const { PrismaClient } = require('@watsapp/database');
const crypto = require('crypto');
require('dotenv').config({ path: '/root/whatsapp_GitHub/.env' });

const META_GRAPH = 'https://graph.facebook.com/v21.0';
const userToken = process.env.META_USER_TOKEN;
if (!userToken) {
  console.error('META_USER_TOKEN missing');
  process.exit(1);
}

function graphGet(path, params = {}) {
  const url = new URL(`${META_GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
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

function pickPage(pages) {
  return (
    pages.find((p) => /almutamayiz|المتميز/i.test(p.name || '')) ||
    pages.find((p) => p.access_token) ||
    pages[0]
  );
}

(async () => {
  const data = await graphGet('/me/accounts', {
    fields: 'id,name,access_token',
    access_token: userToken,
  });
  const pages = data.data || [];
  if (!pages.length) {
    console.error('NO_PAGES');
    process.exit(1);
  }
  console.log('PAGES', pages.map((p) => `${p.id}:${p.name}`).join(' | '));

  const page = pickPage(pages);
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

  const channel = await prisma.channel.upsert({
    where: {
      teamId_provider_externalId: {
        teamId: team.id,
        provider: 'META_MESSENGER',
        externalId: page.id,
      },
    },
    update: {
      name: page.name || 'Facebook Page',
      status: 'CONNECTED',
      lastSeenAt: new Date(),
      metadata: {
        pageId: page.id,
        connectionSource: 'manual_token_install',
        tokenEnc: encryptJson(page.access_token),
      },
    },
    create: {
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
  });

  console.log('UPDATED', channel.id, page.id, page.name);
  await prisma.$disconnect();
  console.log('DONE');
})().catch((e) => {
  console.error('ERROR', JSON.stringify(e));
  process.exit(1);
});
