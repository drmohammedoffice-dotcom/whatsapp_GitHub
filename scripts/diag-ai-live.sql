-- Live AI diagnostics
SELECT conv.id AS conv_id, conv."aiMode", conv."lastMessageAt", conv."lastAiReplyAt",
       ch.id AS channel_id, ch.provider, ch.status AS ch_status, ch."telegramConnectionId",
       ci."externalId" AS contact_ext, ci."displayName",
       tc.status AS tg_conn, tc."phoneNumber"
FROM "Conversation" conv
JOIN "Channel" ch ON ch.id = conv."channelId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
LEFT JOIN "TelegramConnection" tc ON tc.id = ch."telegramConnectionId"
WHERE conv.status = 'OPEN'
ORDER BY conv."lastMessageAt" DESC NULLS LAST
LIMIT 12;

SELECT m.direction, m.text, m.status, m.payload::text, m."createdAt", ci."externalId"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
WHERE conv."lastMessageAt" > NOW() - INTERVAL '2 hours'
ORDER BY m."createdAt" DESC
LIMIT 20;

SELECT platform, enabled, "autoReplyEnabled" FROM "AiSettings"
WHERE "teamId" = (SELECT id FROM "Team" WHERE slug='ahmed' LIMIT 1);

SELECT COUNT(*) AS outbound_last_2h FROM "ConversationMessage"
WHERE direction = 'OUTBOUND' AND "createdAt" > NOW() - INTERVAL '2 hours';

SELECT ce.type, ce."createdAt", ce.metadata::text
FROM "ConversationEvent" ce
JOIN "Conversation" conv ON conv.id = ce."conversationId"
WHERE ce."createdAt" > NOW() - INTERVAL '2 hours'
  AND ce.type IN ('AI_REPLY_SENT', 'MESSAGE_CREATED')
ORDER BY ce."createdAt" DESC
LIMIT 15;
