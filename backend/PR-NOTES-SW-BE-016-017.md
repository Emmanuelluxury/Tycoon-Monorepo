# SW-BE-016 & SW-BE-017 — Games & Matchmaking: DTO Validation + Audit Trail Hooks

**References:** SW-BE-016, SW-BE-017 | Stellar Wave · Backend

---

## SW-BE-016 — DTO Validation and Error Mapping

### What changed

**DTOs updated** (`backend/src/modules/games/dto/`):
- `RollDiceDto` — added `@ApiProperty`, explicit `@Min`/`@Max` with human-readable messages
- `PayRentDto` — added `@ApiProperty`, `payeeId` typed as `@IsInt @Min(1)`, `baseRent` as `@IsPositive`
- `PayTaxDto` — added `@ApiProperty`, `baseTax` as `@IsNumber @IsPositive`
- `BuyPropertyDto` — added `@ApiProperty`, `propertyId` as `@IsInt @Min(1)`, `propertyCost` as `@IsPositive`

**Controller** (`games.controller.ts`):
- Added `@UseFilters(GameValidationFilter)` at controller level — validation errors on all game endpoints now map through `mapValidationErrorToGameException` into consistent `{ error, message, details, timestamp, path }` JSON shapes

### Tests

`games-dto-validation.spec.ts` — 24 tests:
- Valid/invalid inputs for all four DTOs
- `mapValidationErrorToGameException` mapping for `isInt`, `min`, and empty-errors cases

### No schema changes — backward compatible

---

## SW-BE-017 — Audit Trail Hooks

### What changed

**Controller** (`games.controller.ts`):
- `GamesAuditService` injected into `GamesController`
- `setImmediate` audit hooks added for all mutating operations (non-blocking, no impact on response latency):
  - `POST /games` → `logGameCreation`
  - `POST /games/:id/join` → `logGameJoin` (success + failure paths)
  - `PATCH /games/:id` → `logGameUpdate`
  - `PATCH /games/:id/settings` → `logGameSettingsUpdate`
  - `POST .../roll-dice` → `logDiceRoll` (includes `isDoubles`, `total`)
  - `POST .../pay-rent` → `logRentPayment`
  - `POST .../pay-tax` → `logTaxPayment`
  - `POST .../buy-property` → `logPropertyPurchase`
  - `DELETE .../players/me` → `logGameLeave`

**Module** (`games.module.ts`): unchanged — `GamesAuditModule` was already imported and exports `GamesAuditService`

### Tests

`games-audit-hooks.spec.ts` — 13 tests:
- Each operation verified to call the correct audit method with expected context fields
- Join failure path verified (result=failure, reason propagated)
- Doubles detection for dice roll

### No schema changes — backward compatible

---

## Rollout

No feature flags, migrations, or env changes required. Both issues are additive, backward-compatible changes.

`GAMES_AUDIT_ENABLED` (default `true`) and `GAMES_AUDIT_REDACT_SENSITIVE` (default `true`) env vars already control audit behaviour via `GamesAuditService`.

## CI

All 129 games module tests pass (`npm test -- --testPathPattern="modules/games"`).
