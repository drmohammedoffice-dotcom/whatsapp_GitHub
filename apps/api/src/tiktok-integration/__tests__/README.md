# TikTok Real WhatsApp Conversion Tracking — Test Suite

## Run

```bash
cd apps/api
pnpm test:tiktok-conversion
```

## Coverage

```bash
pnpm test:coverage
# HTML/LCOV: apps/api/coverage/tiktok-conversion-tracking/
```

## Suites

| File | Covers |
|------|--------|
| `tiktok-conversion-tracking.spec.ts` | Contact-on-every-inbound, click≠Contact, per-message idempotency, retry, ttclid, workspace isolation, concurrency (100×) |
| `tiktok-conversion-security-lifecycle.spec.ts` | Token encryption, no frontend leak, validation, Lead/Purchase/Registration |
| `tiktok-constants.spec.ts` | Backoff, sanitizeTtclid, tracking URLs |
| `tiktok-frontend-parity.spec.ts` | Browser pixel whitelist (no Contact in activate page) |
| `tiktok-processor-helpers.spec.ts` | Queue processor routing + optimization helpers |

## Notes

- TikTok Events API is mocked; no live HTTP calls.
- Baileys is stubbed via Jest `moduleNameMapper`.
- Full Nest e2e / real Postgres races are out of scope for this unit suite.
- Core conversion modules ≈70% line coverage; controllers/wizard/phones are excluded from the coverage gate.
