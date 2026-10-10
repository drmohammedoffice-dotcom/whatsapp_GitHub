SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ILIKE '%channel%' ORDER BY 1;
SELECT to_regclass('public."ChannelToken"') AS channel_token_table;

SELECT id, provider, status, "externalId",
  (metadata::jsonb ? 'tokenEnc') AS has_token_enc,
  metadata->>'pageId' AS page_id
FROM "Channel"
WHERE "teamId"='cmqwrykfu0009kbi7ccvvax53'
AND provider IN ('META_MESSENGER','META_INSTAGRAM','TELEGRAM','TELEGRAM_USER');

SELECT id, provider, status,
  (metadata::jsonb ? 'tokenEnc') AS has_token_enc,
  metadata->>'pageId' AS page_id
FROM "Channel"
WHERE id IN ('cmr67lwlq0006kbzjnka96q5p','cmr67xudn002gkbvtev4kaaxi');

SELECT ct."channelId", c.provider, c.status, length(ct."encryptedAccessToken") AS enc_len
FROM "ChannelToken" ct
JOIN "Channel" c ON c.id = ct."channelId"
WHERE c."teamId"='cmqwrykfu0009kbi7ccvvax53';

SELECT c.id, c.provider, c.status, c."telegramConnectionId", tc.status AS tg_conn_status
FROM "Channel" c
LEFT JOIN "TelegramConnection" tc ON tc.id = c."telegramConnectionId"
WHERE c.id IN ('cmr67xudn002gkbvtev4kaaxi','cmr5hxksu0031kbai8c6tfzm7','cmr6ewut1002rkb101rb50j7s');
