-- Telegram user 530864071 diagnostics
SELECT c.id, c.provider, c.status, c."externalId", c."telegramConnectionId",
       tc.status AS tg_status, tc."phoneNumber", tc."failureReason"
FROM "Channel" c
LEFT JOIN "TelegramConnection" tc ON tc.id = c."telegramConnectionId"
WHERE c."externalId" = '530864071' OR c.id = 'cmr67lwlq0006kbzjnka96q5p';

SELECT conv.id, conv."aiMode", conv."lastMessageAt", conv."lastAiReplyAt", conv."greetingSentAt",
       ch.status AS channel_status, ch.provider
FROM "Conversation" conv
JOIN "Channel" ch ON ch.id = conv."channelId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
WHERE ci."externalId" = '530864071'
ORDER BY conv."updatedAt" DESC LIMIT 3;

SELECT m.id, m.direction, m.type, m.text, m.status, m."createdAt"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
WHERE ci."externalId" = '530864071'
ORDER BY m."createdAt" DESC LIMIT 10;

SELECT platform, enabled, "autoReplyEnabled" FROM "AiSettings"
WHERE "teamId" = (SELECT "teamId" FROM "Channel" WHERE "externalId"='530864071' LIMIT 1);

SELECT id, type, metadata::text FROM "ConversationEvent" ce
JOIN "Conversation" conv ON conv.id = ce."conversationId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
WHERE ci."externalId" = '530864071'
ORDER BY ce."createdAt" DESC LIMIT 8;
