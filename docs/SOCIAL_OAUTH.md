# Social Media OAuth Integration

Production OAuth-based integration for Facebook Messenger, Instagram Direct, and Telegram.

## Overview

| Platform | Auth method | User experience |
|----------|-------------|-----------------|
| Facebook Messenger | Meta OAuth 2.0 | **Connect Facebook** → select Pages |
| Instagram Direct | Meta OAuth (via linked Pages) | Auto-detected after Facebook login |
| Telegram | Guided wizard + BotFather token | **Connect Telegram** → validate → auto webhook |

Manual Page ID / Access Token / Bot Token forms are **deprecated**. Use `/integrations` or per-channel connect pages.

## Environment variables

Add to root `.env`:

```env
# Meta (Facebook + Instagram)
META_APP_ID=your_facebook_app_id
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=random_verify_string_for_webhooks
META_OAUTH_REDIRECT_URI=https://your-api.com/api/v1/meta/oauth/callback

# Required for webhooks & Telegram
API_PUBLIC_URL=https://your-api.com
WEB_PUBLIC_URL=https://your-app.com
ENCRYPTION_KEY=32+_char_secret_for_token_encryption
```

### Meta Developer Console setup

1. Create a **Business** app at [developers.facebook.com](https://developers.facebook.com)
2. Add products: **Facebook Login**, **Messenger**, **Instagram**
3. Valid OAuth redirect URI: `{API_PUBLIC_URL}/api/v1/meta/oauth/callback`
4. Webhook callback URL: `{API_PUBLIC_URL}/api/v1/meta/webhook`
5. Verify token: same as `META_VERIFY_TOKEN`
6. Subscribe to: `messages`, `messaging_postbacks`, `message_reads`

## API routes

### Meta OAuth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/meta/oauth/start` | JWT | Returns `{ authUrl }` |
| GET | `/api/v1/meta/oauth/callback` | Public | OAuth redirect handler |
| GET | `/api/v1/meta/oauth/pages?session=` | JWT | List Pages after OAuth |
| POST | `/api/v1/meta/oauth/complete` | JWT | Connect selected Pages/IG |
| POST | `/api/v1/meta/oauth/reconnect` | JWT | Re-run OAuth |
| POST | `/api/v1/meta/disconnect` | JWT | Disconnect channel |

### Telegram

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/telegram/validate` | Validate bot token |
| POST | `/api/v1/telegram/connect` | Connect + set webhook |
| GET | `/api/v1/telegram/:channelId/webhook-status` | Verify webhook |
| POST | `/api/v1/telegram/disconnect` | Disconnect |

### Connections

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/integrations/connections` | All connections + health |

## Database models

- **ChannelToken** — encrypted access/refresh tokens per channel
- **SocialOAuthSession** — temporary OAuth session for Page selection (encrypted payload, 30 min TTL)

## Security

- OAuth `state` is a JWT signed with `JWT_ACCESS_SECRET` (CSRF protection)
- All tokens encrypted with AES-256-GCM via `EncryptionService`
- Tokens never returned to the client
- Webhook signature validation (Meta HMAC-SHA256)
- Rate limiting on OAuth callback (`@Throttle`)

## Frontend pages

- `/integrations` — integration hub
- `/integrations/meta/select?session=` — Page/Instagram selection
- `/inbox/social` — unified Messenger + Instagram + Telegram inbox
- `/messenger`, `/instagram`, `/telegram` — per-channel connect (OAuth/wizard)

## AI auto-reply

No changes required. Inbound messages flow through `ChannelMessageService.ingest()` → AI queue → `OutboundChannelService`. Works for all connected channels when `aiMode` is `AI_ACTIVE`.

## Token refresh

Facebook **Page access tokens** obtained via long-lived user token do not expire under normal conditions. User tokens are stored only in the temporary OAuth session and discarded after Page selection.

`ChannelTokenService` marks channels `EXPIRED` when `accessTokenExpiresAt` is passed (for future OAuth providers).

## Telegram Personal Account (MTProto / GramJS)

Telegram **personal accounts** use MTProto (not Bot API). Users log in with phone + verification code, like Telegram Desktop.

### Environment

```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_from_my.telegram.org
```

Get credentials at [my.telegram.org](https://my.telegram.org) → API development tools.

### API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/telegram-user/auth/send-code` | Send verification code |
| POST | `/api/v1/telegram-user/auth/verify-code` | Verify SMS/Telegram code |
| POST | `/api/v1/telegram-user/auth/verify-password` | 2FA password if enabled |
| GET | `/api/v1/telegram-user/status` | Connection status |
| POST | `/api/v1/telegram-user/sync` | Sync chat history |
| POST | `/api/v1/telegram-user/disconnect` | Disconnect account |
| POST | `/api/v1/telegram-user/reconnect` | Restore live session |

### Database

- **TelegramConnection** — encrypted GramJS `StringSession`, profile, status
- **TelegramAuthPending** — temporary multi-step login state (10 min TTL)
- **Channel** with `provider=TELEGRAM_USER` and `telegramConnectionId`

Sessions are encrypted with AES-256-GCM. On server restart, `TelegramUserService.onModuleInit` restores all `CONNECTED` sessions automatically.

### Features

- Private chats, groups, channels
- Real-time `NewMessage` events → unified inbox + AI auto-reply
- Outbound text/media via user's personal account
- Mark as read on inbound messages
- Media download to local storage

### Frontend

- `/telegram` — Connect Telegram (phone login flow)
- `/inbox/telegram` or `/inbox/social` — conversations

