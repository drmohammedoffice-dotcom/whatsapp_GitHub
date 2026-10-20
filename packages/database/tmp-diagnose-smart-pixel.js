const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const pixels = await p.tikTokIntegration.findMany({
    where: {
      OR: [
        { name: { contains: 'ذكي' } },
        { pixelName: { contains: 'ذكي' } },
        { id: 'cmrmoprit002vkb28x7n7aqi0' },
      ],
    },
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
      redirectSlug: true,
      encryptedEventsApiAccessToken: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const out = [];
  for (const i of pixels) {
    const hasToken = Boolean(i.encryptedEventsApiAccessToken);
    delete i.encryptedEventsApiAccessToken;

    const [clicks, contacts, allConv, recentClicks, recentConv] = await Promise.all([
      p.tikTokIntegrationClick.count({ where: { integrationId: i.id } }),
      p.tikTokIntegrationConversion.count({
        where: { integrationId: i.id, eventName: 'Contact', contactSent: true },
      }),
      p.tikTokIntegrationConversion.count({ where: { integrationId: i.id } }),
      p.tikTokIntegrationClick.findMany({
        where: { integrationId: i.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          ttclid: true,
          createdAt: true,
          optimizationEventSent: true,
          lead: {
            select: {
              id: true,
              convertedAt: true,
              customerPhone: true,
              conversationId: true,
            },
          },
        },
      }),
      p.tikTokIntegrationConversion.findMany({
        where: { integrationId: i.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          eventName: true,
          contactSent: true,
          tiktokStatus: true,
          tiktokError: true,
          whatsappPhone: true,
          conversationId: true,
          createdAt: true,
          sentAt: true,
          retryCount: true,
        },
      }),
    ]);

    const channels = await p.channel.findMany({
      where: {
        teamId: i.teamId,
        provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] },
      },
      select: {
        id: true,
        status: true,
        externalId: true,
        metadata: true,
        updatedAt: true,
        whatsAppSession: {
          select: { status: true, phoneNumber: true, jid: true, connectedAt: true },
        },
      },
    });

    // Recent inbound messages on this team (last 24h) via conversations
    const conversations = await p.conversation.findMany({
      where: {
        teamId: i.teamId,
        updatedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: {
        id: true,
        channelId: true,
        updatedAt: true,
        subject: true,
        contact: { select: { phone: true, displayName: true } },
        channel: {
          select: {
            id: true,
            metadata: true,
            externalId: true,
            whatsAppSession: { select: { phoneNumber: true, status: true } },
          },
        },
      },
    });

    out.push({
      ...i,
      hasToken,
      clicks,
      contacts,
      allConv,
      recentClicks,
      recentConv,
      channels: channels.map((c) => ({
        id: c.id,
        status: c.status,
        purpose: c.metadata?.purpose ?? null,
        integrationId: c.metadata?.integrationId ?? null,
        phone:
          c.whatsAppSession?.phoneNumber ||
          c.metadata?.phoneNumber ||
          c.externalId,
        session: c.whatsAppSession?.status,
        connectedAt: c.whatsAppSession?.connectedAt,
        updatedAt: c.updatedAt,
      })),
      recentConversations: conversations.map((c) => ({
        id: c.id,
        updatedAt: c.updatedAt,
        customerPhone: c.contact?.phone,
        customerName: c.contact?.displayName,
        channelId: c.channelId,
        bizPhone:
          c.channel?.whatsAppSession?.phoneNumber ||
          c.channel?.metadata?.phoneNumber ||
          c.channel?.externalId,
        purpose: c.channel?.metadata?.purpose ?? null,
        session: c.channel?.whatsAppSession?.status,
      })),
    });
  }

  console.log(JSON.stringify({ pixels: out }, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
