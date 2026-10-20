const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const byCode = await p.tikTokIntegration.findMany({
    where: { pixelCode: 'D9ALMSRC77U6HL2U7LGG' },
    select: {
      id: true,
      name: true,
      pixelName: true,
      pixelCode: true,
      pixelId: true,
      whatsappNumber: true,
      wizardCompleted: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      eventsApiStatusMessage: true,
      lastEventName: true,
      lastEventSentAt: true,
      lastApiError: true,
      teamId: true,
      userId: true,
      billingSuspended: true,
      encryptedEventsApiAccessToken: true,
    },
  });

  const hot = await p.tikTokIntegration.findUnique({
    where: { id: 'cmrmpdiwv02uqkb2865oi0y45' },
    select: {
      id: true,
      name: true,
      pixelName: true,
      pixelCode: true,
      pixelId: true,
      whatsappNumber: true,
      wizardCompleted: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      eventsApiStatusMessage: true,
      lastEventName: true,
      lastEventSentAt: true,
      lastApiError: true,
      teamId: true,
      userId: true,
      encryptedEventsApiAccessToken: true,
    },
  });

  async function enrich(i) {
    if (!i) return null;
    const hasToken = Boolean(i.encryptedEventsApiAccessToken);
    delete i.encryptedEventsApiAccessToken;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [clicks, contacts, allConv, clicksAll] = await Promise.all([
      p.tikTokIntegrationClick.count({ where: { integrationId: i.id, createdAt: { gte: since } } }),
      p.tikTokIntegrationConversion.count({
        where: {
          integrationId: i.id,
          eventName: 'Contact',
          contactSent: true,
          sentAt: { gte: since },
        },
      }),
      p.tikTokIntegrationConversion.count({ where: { integrationId: i.id } }),
      p.tikTokIntegrationClick.count({ where: { integrationId: i.id } }),
    ]);
    const channels = await p.channel.findMany({
      where: { teamId: i.teamId, provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] } },
      select: {
        id: true,
        status: true,
        externalId: true,
        metadata: true,
        whatsAppSession: { select: { status: true, phoneNumber: true, jid: true } },
      },
    });
    return {
      ...i,
      hasToken,
      stats30d: { clicks, contacts },
      totals: { clicksAll, allConv },
      channels: channels.map((c) => ({
        id: c.id,
        status: c.status,
        purpose: c.metadata?.purpose ?? null,
        phone: c.whatsAppSession?.phoneNumber || c.metadata?.phoneNumber || c.externalId,
        session: c.whatsAppSession?.status,
      })),
    };
  }

  // Latest integrations (any) with arabic names
  const latest = await p.tikTokIntegration.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 15,
    select: {
      id: true,
      name: true,
      pixelName: true,
      pixelCode: true,
      whatsappNumber: true,
      eventsApiConnected: true,
      eventsApiStatus: true,
      lastEventName: true,
      lastEventSentAt: true,
      teamId: true,
      userId: true,
      wizardCompleted: true,
    },
  });

  // Count contacts by integration last 2 days
  const grouped = await p.tikTokIntegrationConversion.groupBy({
    by: ['integrationId'],
    where: {
      eventName: 'Contact',
      contactSent: true,
      sentAt: { gte: new Date(Date.now() - 2 * 24 * 3600 * 1000) },
    },
    _count: true,
  });

  // Recent skips from logs aren't in DB - check clicks without conversion for pixel33
  const pixel33Clicks = byCode[0]
    ? await p.tikTokIntegrationClick.findMany({
        where: { integrationId: byCode[0].id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          ttclid: true,
          optimizationEventSent: true,
          lead: { select: { id: true, convertedAt: true, customerPhone: true, conversationId: true } },
        },
      })
    : [];

  console.log(
    JSON.stringify(
      {
        byCode: await Promise.all(byCode.map(enrich)),
        hot: await enrich(hot),
        latest,
        grouped,
        pixel33Clicks,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
