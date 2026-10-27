
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const team = await p.team.findFirst({ where: { slug: 'ahmed' } });
  console.log('team', team?.id);
  const settings = await p.aiSettings.findMany({ where: { teamId: team.id } });
  console.log('aiSettings', JSON.stringify(settings.map(s => ({
    platform: s.platform, enabled: s.enabled, autoReply: s.autoReplyEnabled,
  })), null, 2));
  const channels = await p.channel.findMany({
    where: { teamId: team.id, provider: { in: ['META_MESSENGER','META_INSTAGRAM','TELEGRAM','TELEGRAM_USER'] } },
    include: { channelToken: true },
  });
  for (const ch of channels) {
    const meta = ch.metadata && typeof ch.metadata === 'object' && !Array.isArray(ch.metadata) ? ch.metadata : {};
    console.log('channel', JSON.stringify({
      id: ch.id, provider: ch.provider, status: ch.status, externalId: ch.externalId,
      hasTokenRow: Boolean(ch.channelToken),
      hasTokenEnc: Boolean(meta.tokenEnc),
      pageId: meta.pageId || null,
    }));
  }
  for (const cid of ['cmr67lwlq0006kbzjnka96q5p', 'cmr67xudn002gkbvtev4kaaxi']) {
    const ch = await p.channel.findUnique({ where: { id: cid }, include: { channelToken: true } });
    const meta = ch?.metadata && typeof ch.metadata === 'object' && !Array.isArray(ch.metadata) ? ch.metadata : {};
    console.log('problem', cid, JSON.stringify({
      provider: ch?.provider, status: ch?.status, externalId: ch?.externalId,
      hasTokenRow: Boolean(ch?.channelToken),
      hasTokenEnc: Boolean(meta.tokenEnc),
      pageId: meta.pageId,
    }));
  }
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
