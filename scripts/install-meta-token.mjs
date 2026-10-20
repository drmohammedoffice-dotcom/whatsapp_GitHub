const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config({ path: '/root/whatsapp_GitHub/.env' });

const META_GRAPH = 'https://graph.facebook.com/v21.0';
const userToken = process.env.META_USER_TOKEN;
if (!userToken) {
  console.error('META_USER_TOKEN missing');
  process.exit(1);
}

function encryptJson(value) {
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

(async () => {
  const { data } = await axios.get(`${META_GRAPH}/me/accounts`, {
    params: { fields: 'id,name,access_token', access_token: userToken },
  });
  const pages = data.data || [];
  if (!pages.length) {
    console.error('NO_PAGES');
    process.exit(1);
  }
  console.log('PAGES', pages.map((p) => `${p.id}:${p.name}`).join(' | '));

  const prisma = new PrismaClient();
  let channels = await prisma.channel.findMany({
    where: { provider: 'META_MESSENGER' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!channels.length) {
    const team = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!team) {
      console.error('NO_TEAM');
      process.exit(1);
    }
    const page = pages[0];
    const created = await prisma.channel.create({
      data: {
        teamId: team.id,
        provider: 'META_MESSENGER',
        purpose: 'INBOX',
        name: page.name || 'Facebook Page',
        status: 'CONNECTED',
        externalId: page.id,
        lastSeenAt: new Date(),
        metadata: { pageId: page.id, connectionSource: 'manual_token_install' },
      },
    });
    channels = [created];
    console.log('CREATED_CHANNEL', created.id);
  }

  for (const ch of channels) {
    const page = pages.find((p) => p.id === ch.externalId) || pages[0];
    const pageToken = page.access_token;
    if (!pageToken) continue;

    const meta =
      ch.metadata && typeof ch.metadata === 'object' && !Array.isArray(ch.metadata)
        ? { ...(ch.metadata) }
        : {};
    meta.pageId = page.id;
    meta.tokenEnc = encryptJson(pageToken);
    meta.connectionSource = 'manual_token_install';

    await prisma.channel.update({
      where: { id: ch.id },
      data: {
        metadata: meta,
        externalId: page.id,
        name: page.name || ch.name,
        status: 'CONNECTED',
        lastSeenAt: new Date(),
      },
    });

    await prisma.channelToken.upsert({
      where: { channelId: ch.id },
      create: {
        channelId: ch.id,
        encryptedAccessToken: encryptJson(pageToken),
        lastRefreshedAt: new Date(),
      },
      update: {
        encryptedAccessToken: encryptJson(pageToken),
        lastRefreshedAt: new Date(),
      },
    });

    await axios.post(`${META_GRAPH}/${page.id}/subscribed_apps`, null, {
      params: {
        subscribed_fields:
          'messages,messaging_postbacks,message_echoes,message_reads,messaging_handovers,feed',
        access_token: pageToken,
      },
    });

    console.log('UPDATED', ch.id, page.id, page.name);
  }

  await prisma.$disconnect();
  console.log('DONE');
})().catch((e) => {
  console.error('ERROR', JSON.stringify(e.response?.data || e.message));
  process.exit(1);
});
