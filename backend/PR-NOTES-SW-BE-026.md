# PR: SW-BE-026 — Metrics & health: pagination and stable sorting

**Stellar Wave | Backend**  
**Issue:** SW-BE-026  
**Scope:** `backend/src/modules/metrics/`

---

## Summary

Adds a paginated, stably-sorted HTTP metrics summary endpoint (`GET /metrics/requests`) to the NestJS API.  
The existing raw Prometheus scrape endpoint (`GET /metrics`) is **unchanged**.

---

## What Changed

### New files
| File | Purpose |
|---|---|
| `src/modules/metrics/dto/metrics-query.dto.ts` | `MetricsQueryDto` — page, limit, sortBy (enum), sortOrder (enum) with class-validator decorators |
| `src/modules/metrics/dto/metrics-summary.dto.ts` | `MetricsSummaryItemDto` + `PaginatedMetricsResponseDto` response shapes |
| `src/modules/metrics/http-metrics-summary.spec.ts` | Unit specs for `HttpMetricsService.getRequestSummary()` (9 tests) |
| `src/modules/metrics/metrics-requests.controller.spec.ts` | Unit specs for `MetricsController.getRequestSummary()` (4 tests) |

### Modified files
| File | Change |
|---|---|
| `src/modules/metrics/http-metrics.service.ts` | Added in-memory `requestCounts` mirror map; updated `recordRequest()` to maintain it; added `getRequestSummary(query)` with stable sort |
| `src/modules/metrics/metrics.controller.ts` | Added `GET /metrics/requests` action with `@UsePipes(ValidationPipe)` |

---

## API Contract

### `GET /metrics/requests`

Returns paginated HTTP request counts grouped by `method × routeGroup × statusClass`, accumulated since process start.

**Query params** (all optional):

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `20` | 1–100 |
| `sortBy` | `method\|routeGroup\|statusClass\|count` | `count` | enum |
| `sortOrder` | `ASC\|DESC` | `DESC` | enum |

**Example request:**
```
GET /metrics/requests?page=1&limit=5&sortBy=count&sortOrder=DESC
```

**Example response:**
```json
{
  "data": [
    { "method": "GET", "routeGroup": "public", "statusClass": "2xx", "count": 142 },
    { "method": "POST", "routeGroup": "public", "statusClass": "2xx", "count": 37 },
    { "method": "GET", "routeGroup": "admin", "statusClass": "2xx", "count": 12 }
  ],
  "meta": {
    "page": 1,
    "limit": 5,
    "total": 3,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

## Design Decisions

**In-memory mirror map** — rather than parsing the Prometheus text format at query time, `HttpMetricsService` maintains a parallel `Map<string, MetricsSummaryItemDto>` keyed on `method::routeGroup::statusClass`. This adds O(1) cost per request and zero overhead at query time for typical cardinality (< 50 label sets).

**Stable sort** — when two rows have equal sort-key values, ties are broken by the composite key string (`GET::public::2xx`), ensuring identical ordering across repeated calls.

**Backward compatibility** — `GET /metrics` (Prometheus text format) is untouched. No schema changes, no migrations.

**No auth required** — consistent with the existing `/metrics` scrape endpoint (classified as `internal` in `classifyHttpRouteGroup` so it is excluded from histogram labels).

---

## Test Coverage

All 4 affected suites pass (19 tests total):

```
PASS src/modules/metrics/metrics.controller.spec.ts
PASS src/modules/metrics/metrics-requests.controller.spec.ts
PASS src/modules/metrics/http-metrics.service.spec.ts
PASS src/modules/metrics/http-metrics-summary.spec.ts
```

New specs cover: empty state, count accumulation, descending/ascending sort, alphabetical sort by method, pagination page 1/2, meta fields (`hasNextPage`, `hasPreviousPage`), stable ordering on equal values, and backward compat of the existing `scrape()` action.

---

## Rollout / Migration Notes

- **No migrations** — purely in-memory, no DB schema changes.
- **No feature flag** — the endpoint is additive; existing callers are unaffected.
- **No secrets exposed** — route groups are low-cardinality labels (admin/public/internal); no user IDs or raw paths appear in responses.
- **Zero-downtime deploy** — stateless; counters reset on restart (same behaviour as Prometheus counters).

---

## Acceptance Criteria

- [x] PR references Stellar Wave and issue id (SW-BE-026)
- [x] CI green for `backend` package
- [x] Jest specs added (9 service + 4 controller tests)
- [x] No schema changes / no migrations needed
- [x] No secrets in logs or responses
- [x] Backward-compatible — existing `GET /metrics` unchanged
