# Platform Architecture

Production-ready multi-tenant SaaS layer for TikTok Developers, Meta, and WhatsApp Cloud API.

## Tenancy Model

- **Team** = tenant boundary. Every query is scoped by `teamId` from the JWT.
- **Business** = optional sub-entity per team (multiple brands/locations).
- No hardcoded accounts or tokens — all credentials live in PostgreSQL, encrypted at rest.

## Core Modules (`apps/api/src/platform/`)

| Module | Routes | Purpose |
|--------|--------|---------|
| Business | `GET/POST /businesses`, `PATCH /businesses/:id` | Multi-business management |
| WhatsApp Cloud | `GET/POST /whatsapp-cloud/accounts` | Unlimited Cloud API numbers |
| Campaigns | `GET/POST/PATCH /campaigns` | Traffic source → WhatsApp mapping |
| Routing | `GET/POST /routing/whatsapp` | Round-robin, random, %, country, AI |
| Redirect | `GET /go/:slug` | Analytics + dynamic wa.me redirect |
| TikTok Auth | `GET/POST /auth/tiktok/login`, `GET /auth/tiktok/callback` | OAuth aliases |
| Webhooks | `GET/POST /webhooks/tiktok` | Verification + event ingestion |
| Admin | `GET /platform/webhook-events`, `/platform/redirect-logs` | Dashboard logs |

## TikTok Integration

Existing implementation in `apps/api/src/tiktok/`:

- `TikTokOAuthService` — login, callback, token refresh
- `TikTokTokenService` — encrypted token storage
- `TikTokApiClient` — reusable HTTP client for future APIs
- `TikTokSyncProcessor` — background queue worker

Platform aliases expose official-style paths without duplicating logic:

```
/api/v1/auth/tiktok/login
/api/v1/auth/tiktok/callback
/api/v1/webhooks/tiktok
```

`TikTokCampaign.platformCampaignId` links legacy TikTok campaigns to unified `Campaign` records.

## WhatsApp Cloud API

`WhatsAppCloudAccount` stores per-number credentials:

- Name, phone, phoneNumberId, wabaId
- Encrypted permanent token + verify token
- Status, connectedAt, lastSyncAt
- AI agent assignment (`aiAgentId`)
- Auto-creates a `Channel` with `provider: WHATSAPP_CLOUD`

Outbound messages route through `OutboundChannelService` using Meta Graph API v21.0.

## Routing Engine

`WhatsAppRoutingService.pickAccount()` strategies:

| Strategy | Behavior |
|----------|----------|
| MANUAL | Campaign or context specifies account |
| CAMPAIGN | Campaign-bound WhatsApp number |
| ROUND_ROBIN | Rotate through pool |
| RANDOM | Random pool member |
| PERCENTAGE | Weighted distribution via `config.weights` |
| COUNTRY | `config.map` by country code |
| AI | Reserved for AI-based routing |

## Campaign Flow

```
Visitor → https://yourdomain.com/go/{campaign_slug}
       → RedirectLog (IP, device, UTM, referrer)
       → Routing engine picks WhatsApp account
       → 302 to wa.me/{phone}?text=...
```

## AI Per Channel

`Channel.aiAgentId` and `WhatsAppCloudAccount.aiAgentId` override team-level `AiSettings.systemPromptOverride` in `AiOrchestratorService`.

## Database Models

```
Team
 ├── Business
 ├── TrafficSource
 ├── Campaign ──→ WhatsAppCloudAccount / WhatsAppRoutingRule
 ├── WhatsAppCloudAccount ──→ Channel, AiAgent
 ├── WhatsAppRoutingRule ──→ WhatsAppRoutingPoolMember[]
 ├── RedirectLog
 ├── IntegrationWebhookEvent
 └── MetaConnection
```

Migration: `20260628160000_platform_saas`

## Security

- Tokens encrypted via `EncryptionService` (ENCRYPTION_KEY)
- JWT + RBAC (`PermissionsGuard`, OWNER/ADMIN bypass)
- Rate limiting on public routes (`/go`, webhooks)
- Audit logs via existing `AuditModule`

## Frontend

Dashboard: `/platform` — businesses, WhatsApp Cloud, campaigns, routing, analytics, webhooks.

## Environment

```env
ENCRYPTION_KEY=...          # 32+ chars
API_PUBLIC_URL=...
WEB_PUBLIC_URL=...
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
META_APP_ID=...
META_APP_SECRET=...
```

## Extending

Add new providers without architectural changes:

1. Add `ChannelProvider` enum value + Prisma model if needed
2. Create `integrations/{provider}/` module with OAuth + webhook controllers
3. Register in `IntegrationsModule` or `PlatformModule`
4. Add outbound branch in `OutboundChannelService`
5. Add `WebhookProvider` enum + ingest via `WebhookEventService`
