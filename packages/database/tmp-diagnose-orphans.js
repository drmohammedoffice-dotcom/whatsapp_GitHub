const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Integrations with Events API connected but 0 contacts in last 7 days, and recent clicks
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const integrations = await p.tikTokIntegration.findMany({
    where: { wizardCompleted: true, updatedAt: { gte: since } },
    select: {
      id: true,
      name: true,
      pixelCode: true,
      whatsappNumber: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      lastEventName: true,
      lastEventSentAt: true,
      teamId: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });

  const rows = [];
  for (const i of integrations) {
    const [clicks7, contacts7, clicks1, contacts1] = await Promise.all([
      p.tikTokIntegrationClick.count({ where: { integrationId: i.id, createdAt: { gte: since } } }),
      p.tikTokIntegrationConversion.count({
        where: {
          integrationId: i.id,
          eventName: 'Contact',
          contactSent: true,
          sentAt: { gte: since },
        },
      }),
      p.tikTokIntegrationClick.count({
        where: { integrationId: i.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      p.tikTokIntegrationConversion.count({
        where: {
          integrationId: i.id,
          eventName: 'Contact',
          contactSent: true,
          sentAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
    ]);
    if (clicks1 > 0 || contacts1 > 0 || (clicks7 > 0 && contacts7 === 0)) {
      const channels = await p.channel.findMany({
        where: { teamId: i.teamId, provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] } },
        select: {
          status: true,
          metadata: true,
          whatsAppSession: { select: { status: true, phoneNumber: true } },
        },
      });
      rows.push({
        id: i.id,
        name: i.name,
        pixelCode: i.pixelCode,
        whatsappNumber: i.whatsappNumber,
        eventsApiConnected: i.eventsApiConnected,
        eventsApiStatus: i.eventsApiStatus,
        lastEventName: i.lastEventName,
        lastEventSentAt: i.lastEventSentAt,
        clicks7,
        contacts7,
        clicks1,
        contacts1,
        orphanClicks: clicks7 > 0 && contacts7 === 0,
        channels: channels.map((c) => ({
          purpose: c.metadata?.purpose ?? null,
          status: c.status,
          session: c.whatsAppSession?.status,
          phone: c.whatsAppSession?.phoneNumber || c.metadata?.phoneNumber || null,
        })),
      });
    }
  }

  // Sample recent message texts for tracked conversations (last 20 inbound with possible refs)
  const msgs = await p.message.findMany({
    where: {
      direction: 'INBOUND',
      createdAt: { gte: new Date(Date.now() - 6 * 3600 * 1000) },
      text: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      text: true,
      conversationId: true,
      createdAt: true,
      type: true,
    },
  });

  const analyzed = msgs.map((m) => {
    const text = m.text || '';
    const hasWordJoiner = text.includes('\u2060');
    const hasZwsp = text.includes('\u200B') || text.includes('\u200C');
    return {
      conversationId: m.conversationId,
      createdAt: m.createdAt,
      type: m.type,
      len: text.length,
      hasWordJoiner,
      hasZwsp,
      preview: text.slice(0, 80),
    };
  });

  console.log(JSON.stringify({ problemPixels: rows, recentInboundTexts: analyzed }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
