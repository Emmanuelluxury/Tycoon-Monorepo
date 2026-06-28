# SW-BE-034 — Webhooks & Signatures: Idempotency and Replay Tests

Part of the **Stellar Wave** engineering batch.

## Summary

Adds dedicated Jest test coverage for the webhook signature verification and Redis-backed idempotency path in `backend/`.  
No production code was changed. The existing `WebhooksService` and `IdempotencyInterceptor` were already implemented; this PR formalises test coverage at both the unit and HTTP levels.

## New files

| File | Type | Scenarios |
|---|---|---|
| `src/modules/webhooks/webhooks-idempotency-replay.spec.ts` | Unit | 26 — verifySignature (7 cases), processWebhook idempotency (5 cases), replay interactions (3 cases), audit hooks lifecycle (6 cases), secret isolation (2 cases), no-secret-in-logs (1 case) |
| `test/webhooks-signature-replay.e2e-spec.ts` | E2E | 11 — HTTP-level: valid request, invalid signature, missing header, stale timestamp, duplicate (idempotent), missing ID, infra failure, HMAC reconstruction, extra body fields, paginated list, audit log endpoint |

## Design notes

- All tests use Jest mocks — no live Redis, no PostgreSQL, no prom-client.  
- The unit spec instantiates `WebhooksService` directly with constructor injection; no `Test.createTestingModule` overhead needed.  
- The e2e spec builds a minimal NestJS HTTP app using `Test.createTestingModule` + `supertest`, keeping the test surface small and fast.  
- `jest.config.ts` (`rootDir = src/`) picks up the unit spec automatically.  
- `test/jest-e2e.json` (matches `*.e2e-spec.ts`) picks up the e2e spec.

## No schema changes

No database migrations. No new environment variables. No new npm dependencies.

## Feature flag / rollout

No feature flag is needed. The webhook endpoint and its idempotency behaviour are already deployed.

### If adding idempotency to a new endpoint in future

1. Import and register `IdempotencyInterceptor` in the target module.  
2. Apply `@UseInterceptors(IdempotencyInterceptor)` on the controller class or individual action.  
3. Clients send `Idempotency-Key: <uuid>` (or `X-Idempotency-Key: <uuid>`) on POST/PUT/PATCH/DELETE.  
4. Completed responses are cached in Redis for 24 h. In-flight duplicates return `409 Conflict`. Replayed responses include `X-Idempotency-Replayed: true`.  
5. To remove: delete the decorator. Redis keys expire naturally after their TTL — no migration needed.

### Webhook-specific idempotency

`WebhooksService.processWebhook` uses a separate, longer-lived idempotency key (`webhook:<id>`, TTL 7 days) stored directly via `RedisService`. This is independent of the generic `IdempotencyInterceptor` and is used to de-duplicate inbound Stripe events.

## Verification

```bash
cd backend

# Unit specs (rootDir = src)
npm run test -- --testPathPattern="webhooks-idempotency-replay"

# E2e spec
npx jest --config test/jest-e2e.json --testPathPattern="webhooks-signature-replay"

# Full backend unit suite must stay green
npm run test

# Full backend e2e suite
npx jest --config test/jest-e2e.json
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-BE-034  
- [x] CI must be green for `backend/`  
- [x] No secrets in logs — HMAC secret is never passed to observability or audit calls  
- [x] Backward-compatible — existing production behaviour is unchanged  
- [x] No schema changes, no new npm dependencies  
- [x] 37 new Jest cases across 2 spec files  
- [x] Tests run without a live Redis or PostgreSQL instance
