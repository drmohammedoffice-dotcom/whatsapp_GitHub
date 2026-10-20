
const { PrismaClient } = require("@watsapp/database");
const prisma = new PrismaClient();
(async () => {
  const teamId = "cmqwrykfu0009kbi7ccvvax53";
  const sessions = await prisma.whatsAppSession.findMany({
    where: { teamId },
    select: { id: true, purpose: true, status: true, phoneNumber: true, updatedAt: true },
    orderBy: [{ phoneNumber: "asc" }, { purpose: "asc" }],
  });
  const channels = await prisma.channel.findMany({
    where: { teamId, provider: { in: ["WHATSAPP_BAILEYS","WHATSAPP_CLOUD"] } },
    select: { id: true, purpose: true, status: true, name: true, whatsAppSessionId: true, externalId: true },
  });
  const recentInbox = await prisma.conversationMessage.findMany({
    where: { teamId, conversation: { channel: { purpose: "INBOX" } } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { createdAt: true, direction: true, text: true, conversation: { select: { id: true, channel: { select: { purpose: true, name: true } } } } },
  });
  const recentAny = await prisma.conversationMessage.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { createdAt: true, direction: true, text: true, conversation: { select: { channel: { select: { purpose: true, name: true } } } } },
  });
  const inboxConvs = await prisma.conversation.count({ where: { teamId, channel: { purpose: "INBOX" } } });
  const trackingConvs = await prisma.conversation.count({ where: { teamId, channel: { purpose: "TRACKING" } } });
  console.log(JSON.stringify({ sessions, channels, recentInbox, recentAny, inboxConvs, trackingConvs }, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
