# Changelog - tycoon-boost-system

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CT-031

### Added
- `contract/SECURITY_REVIEW_CHECKLIST.md §8` — new "Workspace Hygiene Checks"
  section (SW-CT-031) covering dependency hygiene, code hygiene, documentation
  hygiene, test hygiene, CI hygiene, and security-doc hygiene.
  
### Changed
- `contract/SECURITY_REVIEW_CHECKLIST.md` — issue header updated to reference
  SW-CT-031; per-contract status table updated to reflect all boost-system
  Stellar Wave items (SW-CT-025 through SW-CT-031) applied.

## [Unreleased] - SW-CT-031

### Added
- `contract/SECURITY_REVIEW_CHECKLIST.md §8` — new "Workspace Hygiene Checks" section (SW-CT-031): dependency, code, documentation, test, CI, and security-doc hygiene items.

### Changed
- `contract/SECURITY_REVIEW_CHECKLIST.md` — issue header updated to SW-CT-031; per-contract status table updated to reflect all boost-system SW-CT-025 through SW-CT-031 items.

## [Unreleased] - SW-CT-030

### Added
- `ENTRYPOINTS.md` — authoritative table of admin-only vs public entrypoints,
  authorization matrix, and rollout notes.
- `src/admin_access_control_tests.rs` — 7 new boundary tests (BOUNDARY-01 through
  BOUNDARY-07) covering public read views, admin-only gates, isolation, and
  deprecated function auth requirements.

### Changed
- Inline doc comment on `add_boost` corrected (said "Admin-only" but described
  player self-service; now consistent with ENTRYPOINTS.md).

## [Unreleased] - SW-CT-030

### Added
- `ENTRYPOINTS.md` — authoritative admin-only vs public entrypoint table, auth matrix, and rollout notes.
- `src/admin_access_control_tests.rs` — 7 new boundary tests (BOUNDARY-01 through BOUNDARY-07).

## [Unreleased] - SW-CT-029

### Added
- `src/deprecation_tests.rs` — full test suite (13 tests) for the deprecation path:
  - DEP-01/02: `get_boosts` callable and returns correct data
  - DEP-03: proves `get_boosts` includes expired boosts (the key regression risk)
  - DEP-04: `get_boosts` / `get_active_boosts` agree for non-expired boosts
  - DEP-05/06: `prune_expired_boosts` return value (0 when clean, count when dirty)
  - DEP-07: explicit prune + calculate equals automatic-prune + calculate
  - DEP-08/09: `DeprecatedFunctionCalledEvent` emitted by both deprecated functions
  - DEP-10/11: migration correctness — swapping deprecated → replacement is safe
  - DEP-12: deprecated read does not corrupt mutable state

### Changed
- `DEPRECATION_PLAN.md` — updated status to ✅ test-covered; referenced SW-CT-029.

## [Unreleased] - SW-CT-028

### Added
- `ACCEPTANCE_CRITERIA.md` — complete acceptance-criteria matrix (AC-INIT through AC-CI).
  Every criterion maps to a named test for traceable CI coverage.
- Updated `README.md` to reference `ACCEPTANCE_CRITERIA.md` under a dedicated section.

## [Unreleased] - SW-CT-027

### Added
- `src/simulation_scenarios.rs` — 7 end-to-end game-session simulation tests:
  SIM-01 new player receives admin boost, SIM-02 boost expires mid-session,
  SIM-03 admin revokes mid-session, SIM-04 cap freed by expiry allows new boost,
  SIM-05 multi-player isolation, SIM-06 mixed boost types full round,
  SIM-07 end-of-season clear all players.

## [Unreleased] - SW-CT-025

### Added
- `SECURITY_REVIEW_CHECKLIST.md` — full security review covering authorization,
  input validation, arithmetic safety, expiry logic, event emission, and storage.
  Four findings documented (SEC-01 through SEC-04).
- `src/security_review_tests.rs` — 4 tests targeting the findings:
  - `test_admin_grant_boost_rejects_without_auth` (SEC-01)
  - `test_admin_revoke_boost_rejects_without_auth` (SEC-01)
  - `test_additive_overflow_wraps` (SEC-02 — documents current wrapping behavior)
  - `test_mixed_overflow_truncates` (SEC-03 — documents current truncation behavior)

## [0.2.0] - 2026-04-22

### Deprecated
- **`get_boosts`** - Returns all boosts including expired ones. Use `get_active_boosts` instead.
  - Reason: Wastes gas reading stale data and confuses clients
  - Migration: Replace `get_boosts` with `get_active_boosts`
  - Removal: Planned for v1.0.0 (Q4 2026)
  
- **`prune_expired_boosts`** - Manual pruning is unnecessary. Use automatic pruning instead.
  - Reason: `add_boost` already auto-prunes, and `calculate_total_boost` ignores expired boosts
  - Migration: Simply remove calls to this function
  - Removal: Planned for v1.0.0 (Q4 2026)

### Added
- Deprecation event system (SW-CONTRACT-BOOST-002)
  - `DeprecatedFunctionCalledEvent` emitted when deprecated functions are called
  - Helps track migration progress and identify integrations needing updates
- Comprehensive deprecation tests (30 new tests)
  - Backward compatibility verification
  - Migration path validation
  - Event emission testing
  - Functional equivalence tests
- Documentation:
  - `DEPRECATION_PLAN.md` - Complete deprecation strategy
  - `MIGRATION_GUIDE.md` - Step-by-step migration instructions
  - Updated inline documentation with deprecation notices

### Changed
- Updated `get_boosts` to emit deprecation event
- Updated `prune_expired_boosts` to emit deprecation event
- Added `#[deprecated]` attributes to legacy functions
- Updated README.md with deprecation notices

### Testing
- All 151 tests pass (121 existing + 30 deprecation tests)
- CI green for all checks
- No breaking changes to existing functionality

## [0.1.1] - 2026-04-22

### Added
- Comprehensive test coverage improvements (SW-CONTRACT-BOOST-001)
  - 45 new advanced unit tests covering edge cases, stress scenarios, and multi-player isolation
  - 25 new cross-contract integration tests
  - Total test count increased from 51 to 121 tests (+137% coverage)
- New test modules:
  - `src/advanced_integration_tests.rs` - Advanced unit tests
  - `../integration-tests/src/boost_system_integration.rs` - Integration tests
- Test documentation:
  - `TEST_COVERAGE_IMPROVEMENTS.md` - Comprehensive coverage documentation
  - `PR_DESCRIPTION.md` - Pull request details
- Updated fixture support for boost system in integration tests

### Changed
- Updated README.md with expanded test coverage information
- Enhanced integration test fixture to include boost system deployment

### Testing
- All 121 tests pass
- CI green for all checks
- No breaking changes to contract logic

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
