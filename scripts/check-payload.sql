SELECT m.id, m.text, m.payload::text, m."createdAt"
FROM "ConversationMessage" m
JOIN "Conversation" conv ON conv.id = m."conversationId"
JOIN "ContactIdentity" ci ON ci.id = conv."identityId"
WHERE ci."externalId" = '530864071'
ORDER BY m."createdAt" DESC LIMIT 5;
