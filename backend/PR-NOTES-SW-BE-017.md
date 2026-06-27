# PR: SW-BE-017 — Games & Matchmaking: Audit Trail Hooks

**Stellar Wave | Backend**
**Issue:** SW-BE-017
**Branch:** feat/SW-BE-017-games-audit-trail-hooks

---

## Summary

Adds a complete audit trail for every game and matchmaking operation on the NestJS backend. All audit writes are fire-and-forget (`setImmediate`) so they never block response latency.

---

## What Changed

### New files
| File | Purpose |
|------|---------|
| `src/modules/games/audit/games-audit.service.ts` | Central audit service with 9 typed log methods |
| `src/modules/games/audit/games-audit.interceptor.ts` | HTTP-level interceptor capturing IP, user-agent, duration |
| `src/modules/games/audit/games-audit.module.ts` | NestJS module wiring the audit components |
| `src/modules/games/audit/sensitive-data-redactor.service.ts` | Strips wallet addresses, tokens, PII before logging |
| `src/modules/games/audit/MIGRATION_GUIDE.md` | Runbook for enabling/disabling audit features |
| `src/modules/games/dto/roll-dice.dto.ts` | DTO with class-validator annotations for dice rolls |
| `src/modules/games/dto/pay-rent.dto.ts` | DTO for rent payments |
| `src/modules/games/dto/pay-tax.dto.ts` | DTO for tax payments |
| `src/modules/games/dto/buy-property.dto.ts` | DTO for property purchases |

### Modified files
| File | Change |
|------|--------|
| `src/modules/games/games.controller.ts` | Injected `GamesAuditService`; added `setImmediate` audit hooks on all 9 mutating endpoints |
| `src/modules/games/games.module.ts` | Imports `GamesAuditModule` |
| `src/modules/audit-trail/entities/audit-trail.entity.ts` | Added `AuditAction` enum values: `GAME_CREATED`, `GAME_UPDATED`, `GAME_SETTINGS_UPDATED`, `GAME_VIEWED`, `GAME_SEARCHED`, `GAME_JOINED`, `GAME_JOIN_FAILED`, `GAME_LEFT`, `PLAYER_DICE_ROLLED`, `PLAYER_RENT_PAID`, `PLAYER_TAX_PAID`, `PLAYER_PROPERTY_BOUGHT`, `PLAYER_UPDATED` |

### Test file
| File | Coverage |
|------|---------|
| `src/modules/games/games-audit-hooks.spec.ts` | 11 unit tests — all pass ✅ |

---

## Audit Events

| Controller endpoint | Audit method | AuditAction |
|---------------------|-------------|-------------|
| `POST /games` | `logGameCreation` | `GAME_CREATED` |
| `POST /games/:id/join` (success) | `logGameJoin` | `GAME_JOINED` |
| `POST /games/:id/join` (failure) | `logGameJoin` | `GAME_JOIN_FAILED` |
| `PATCH /games/:id` | `logGameUpdate` | `GAME_UPDATED` |
| `PATCH /games/:id/settings` | `logGameSettingsUpdate` | `GAME_SETTINGS_UPDATED` |
| `DELETE /games/:gameId/players/me` | `logGameLeave` | `GAME_LEFT` |
| `POST /games/:gameId/players/:id/roll-dice` | `logDiceRoll` | `PLAYER_DICE_ROLLED` |
| `POST /games/:gameId/players/:id/pay-rent` | `logRentPayment` | `PLAYER_RENT_PAID` |
| `POST /games/:gameId/players/:id/pay-tax` | `logTaxPayment` | `PLAYER_TAX_PAID` |
| `POST /games/:gameId/players/:id/buy-property` | `logPropertyPurchase` | `PLAYER_PROPERTY_BOUGHT` |

---

## No Secrets in Logs

- `SensitiveDataRedactor` strips wallet addresses, private keys, tokens and any field matching `address|secret|token|key|password|credential`.
- IP addresses are captured for audit but only from `X-Forwarded-For` / `remoteAddress` — no PII enrichment.
- Logs contain masked keys, never raw values.

---

## Environment Variables (all optional — backward-compatible)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GAMES_AUDIT_ENABLED` | `true` | Master switch for audit logging |
| `GAMES_AUDIT_ASYNC_TIMEOUT_MS` | `5000` | Timeout for each async audit write |
| `GAMES_AUDIT_LOG_VIEWS` | `false` | Whether to log read-only GET endpoints |

No schema migrations required — audit records are written to the existing `audit_trails` table.

---

## Rollout / Feature Flag

- Audit hooks are **on by default** but can be disabled per-environment with `GAMES_AUDIT_ENABLED=false`.
- View logging (`GET` endpoints) is off by default; enable with `GAMES_AUDIT_LOG_VIEWS=true`.
- Changes are backward-compatible: no existing API contracts changed, no new endpoints added.

---

## Tests

```bash
cd backend
npx jest --testPathPattern="games-audit-hooks" --no-coverage
# → 11 passed, 0 failed
```

---

## Acceptance Criteria

- [x] PR references Stellar Wave issue `SW-BE-017`
- [x] CI green for `backend` package
- [x] Jest specs added (11 tests, all passing)
- [x] No schema migration required (uses existing `audit_trails` table)
- [x] No secrets in logs (`SensitiveDataRedactor` applied)
- [x] Backward-compatible (feature-flagged, no API changes)
