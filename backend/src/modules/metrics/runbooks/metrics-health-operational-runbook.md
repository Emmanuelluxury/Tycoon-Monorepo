# Metrics & Health — Operational Runbook

> **Scope:** `GET /health/*` and `GET /metrics` endpoints on the Tycoon NestJS API.
> **Last updated:** 2026-06-26 | **Next review:** 2026-09-26

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Endpoint Reference](#2-endpoint-reference)
3. [SLO Targets](#3-slo-targets)
4. [Prometheus Alert Rules](#4-prometheus-alert-rules)
5. [Runbooks by Symptom](#5-runbooks-by-symptom)
   - [5.1 Readiness probe returning 503](#51-readiness-probe-returning-503)
   - [5.2 Redis disconnected](#52-redis-disconnected)
   - [5.3 Database disconnected](#53-database-disconnected)
   - [5.4 Metrics scrape failing or timing out](#54-metrics-scrape-failing-or-timing-out)
   - [5.5 Degraded aggregate health (partial failure)](#55-degraded-aggregate-health-partial-failure)
   - [5.6 Audit trail not recording health/metrics access](#56-audit-trail-not-recording-healthmetrics-access)
6. [Emergency Procedures](#6-emergency-procedures)
7. [Deployment & Rollout Notes](#7-deployment--rollout-notes)
8. [Audit Logging Reference](#8-audit-logging-reference)

---

## 1. System Overview

### Components

| Component | File | Responsibility |
|---|---|---|
| `HealthController` | `src/health/health.controller.ts` | Liveness, readiness, and aggregate health checks |
| `MetricsController` | `src/modules/metrics/metrics.controller.ts` | Prometheus-compatible `/metrics` scrape endpoint |
| `HttpMetricsService` | `src/modules/metrics/http-metrics.service.ts` | Collects HTTP counters, histograms, DB pool gauges, process metrics |
| `HttpMetricsMiddleware` | `src/modules/metrics/http-metrics.middleware.ts` | Intercepts every request to record method/path/status/duration |
| `AuditTrailInterceptor` | `src/modules/audit-trail/audit-trail.interceptor.ts` | Logs `HEALTH_CHECK_ACCESSED` and `METRICS_SCRAPED` events with duration and result summary |
| `AllExceptionsFilter` | `src/common/filters/all-exceptions.filter.ts` | Maps PostgreSQL error codes and unhandled exceptions to HTTP status codes |

### Request Flow

```
Kubernetes probe / Prometheus
  └─> GET /health/ready            ─> HealthController.readiness()
        ├─ Redis PING round-trip
        ├─ PostgreSQL SELECT 1
        └─> 200 OK { status: "healthy" }   or   503 { status: "unhealthy" }

Prometheus scraper
  └─> GET /metrics                 ─> MetricsController.scrape()
        └─> HttpMetricsService.getMetricsText()
              ├─ collectPoolMetrics()   (pg pool gauges)
              ├─ collectProcessMetrics() (heap, rss, uptime, event-loop lag)
              └─> registry.metrics()   → Prometheus text format
```

---

## 2. Endpoint Reference

### `GET /health/live`

| Field | Value |
|---|---|
| Purpose | Kubernetes **liveness** probe |
| Auth required | No |
| Rate-limited | No (`@SkipThrottle`) |
| Success HTTP status | `200 OK` |
| Failure HTTP status | Never fails (if process is dead, probe times out) |
| Audit logged | No |

**Success body:**
```json
{ "status": "healthy", "timestamp": "2026-06-26T10:00:00.000Z", "uptime": 3600 }
```

---

### `GET /health/ready`

| Field | Value |
|---|---|
| Purpose | Kubernetes **readiness** probe |
| Auth required | No |
| Rate-limited | No |
| Success HTTP status | `200 OK` |
| Failure HTTP status | `503 Service Unavailable` |
| Audit logged | No |

**Success body:**
```json
{ "status": "healthy", "timestamp": "...", "redis": "connected", "database": "connected" }
```

**Failure body (503):**
```json
{ "status": "unhealthy", "timestamp": "...", "redis": "disconnected", "database": "connected" }
```

Kubernetes stops routing traffic to the pod when this returns 503.

---

### `GET /health`

| Field | Value |
|---|---|
| Purpose | Full **aggregate** health check (all deps + process metrics) |
| Auth required | No |
| Rate-limited | No |
| Success HTTP status | `200 OK` (healthy or degraded) |
| Failure HTTP status | `503 Service Unavailable` (all deps down) |
| Audit logged | Yes — `HEALTH_CHECK_ACCESSED` |

**Status semantics:**

| `status` | HTTP | Meaning |
|---|---|---|
| `healthy` | 200 | All dependencies reachable |
| `degraded` | 200 | At least one dependency reachable; partial service |
| `unhealthy` | 503 | All dependencies unreachable |

**Success body:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-26T10:00:00.000Z",
  "uptime": 3600,
  "redis": "connected",
  "database": "connected",
  "memory": { "heapUsedMb": 64, "rssMb": 128 }
}
```

---

### `GET /health/redis`

| Field | Value |
|---|---|
| Purpose | Redis-only check (backward-compatible) |
| Auth required | No |
| Rate-limited | No |
| Success HTTP status | `200 OK` |
| Failure HTTP status | `503 Service Unavailable` |
| Audit logged | Yes — `HEALTH_CHECK_ACCESSED` |

---

### `GET /metrics`

| Field | Value |
|---|---|
| Purpose | Prometheus scrape endpoint |
| Content-Type | `text/plain; version=0.0.4; charset=utf-8` |
| Auth required | No (network-policy restricted in production) |
| Rate-limited | No |
| Audit logged | Yes — `METRICS_SCRAPED` |

**Metrics exported:**

| Metric | Type | Description |
|---|---|---|
| `tycoon_http_requests_total` | Counter | Total requests by method, route_group, status_class |
| `tycoon_http_request_duration_seconds` | Histogram | Request latency by method, route_group |
| `tycoon_db_pool_total` | Gauge | Total TypeORM pool connections |
| `tycoon_db_pool_idle` | Gauge | Idle pool connections |
| `tycoon_db_pool_waiting` | Gauge | Requests waiting for a free connection |
| `tycoon_db_pool_exhaustion_total` | Counter | Times waiting > 80 % of pool size |
| `tycoon_process_heap_used_bytes` | Gauge | V8 heap used |
| `tycoon_process_heap_total_bytes` | Gauge | V8 heap allocated |
| `tycoon_process_rss_bytes` | Gauge | Resident set size |
| `tycoon_process_external_memory_bytes` | Gauge | External (C++) memory |
| `tycoon_process_uptime_seconds` | Gauge | Process uptime |
| `tycoon_event_loop_lag_seconds` | Gauge | Approximate event-loop lag |

---

## 3. SLO Targets

| Endpoint | Availability SLO | Latency SLO (p99) |
|---|---|---|
| `/health/live` | 99.9 % | < 50 ms |
| `/health/ready` | 99.5 % | < 200 ms |
| `/health` | 99.0 % | < 500 ms |
| `/metrics` | 99.5 % | < 2 s |

---

## 4. Prometheus Alert Rules

Add these rules to your Prometheus `alerts.yml`:

```yaml
groups:
  - name: tycoon_health_metrics
    rules:

      # Readiness probe failure — pod should be taken out of rotation
      - alert: TycoonReadinessProbeFailing
        expr: probe_success{job="tycoon-api", target=~".*/health/ready"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Tycoon API readiness probe failing"
          description: "{{ $labels.instance }} readiness probe has been unhealthy for > 1 minute."

      # Scrape endpoint unavailable
      - alert: TycoonMetricsScrapeFailing
        expr: up{job="tycoon-api"} == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Tycoon API /metrics endpoint unreachable"
          description: "Prometheus cannot scrape {{ $labels.instance }} for > 2 minutes."

      # High error rate (5xx)
      - alert: TycoonHighErrorRate
        expr: |
          rate(tycoon_http_requests_total{status_class="5xx"}[5m])
          / rate(tycoon_http_requests_total[5m]) > 0.05
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "Tycoon API error rate > 5 %"
          description: "5xx rate is {{ $value | humanizePercentage }} over the last 5 minutes."

      # High API latency
      - alert: TycoonHighLatency
        expr: |
          histogram_quantile(0.99,
            rate(tycoon_http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tycoon API p99 latency > 2 s"
          description: "p99 latency is {{ $value | humanizeDuration }}."

      # DB pool exhaustion
      - alert: TycoonDBPoolExhaustion
        expr: rate(tycoon_db_pool_exhaustion_total[5m]) > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Tycoon DB connection pool nearing exhaustion"
          description: "Pool waiting queue exceeded 80 % threshold."

      # High heap usage
      - alert: TycoonHighHeapUsage
        expr: tycoon_process_heap_used_bytes / tycoon_process_heap_total_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tycoon API heap usage > 90 %"
          description: "Heap used is {{ $value | humanizePercentage }} of total."

      # Event-loop lag
      - alert: TycoonEventLoopLag
        expr: tycoon_event_loop_lag_seconds > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Tycoon API event-loop lag > 100 ms"
          description: "Event-loop lag is {{ $value | humanizeDuration }}."
```

---

## 5. Runbooks by Symptom

### 5.1 Readiness probe returning 503

**Symptoms:** `GET /health/ready` returns HTTP 503. Kubernetes marks the pod `NotReady` and stops routing traffic.

**Triage steps:**

1. Check the response body for which dependency failed:
   ```bash
   curl -s https://api.example.com/health/ready | jq .
   ```
2. If `redis: "disconnected"` → follow [5.2 Redis disconnected](#52-redis-disconnected).
3. If `database: "disconnected"` → follow [5.3 Database disconnected](#53-database-disconnected).
4. If both are disconnected → the API pod may have lost network access; check pod network policy.
5. Check pod logs for error messages:
   ```bash
   kubectl logs -l app=tycoon-api --tail=100 | grep -E "ERROR|health"
   ```

---

### 5.2 Redis disconnected

**Symptoms:** `redis: "disconnected"` in health response; `HEALTH_CHECK_ACCESSED` audit records show `result.redis = "disconnected"`.

**Resolution:**

1. Verify Redis service is running:
   ```bash
   kubectl get pods -l app=redis
   # or for a managed service:
   redis-cli -h $REDIS_HOST ping
   ```
2. Check `REDIS_URL` / `REDIS_HOST` env vars in the API deployment:
   ```bash
   kubectl exec deploy/tycoon-api -- env | grep REDIS
   ```
3. Test connectivity from the API pod:
   ```bash
   kubectl exec deploy/tycoon-api -- redis-cli -h $REDIS_HOST ping
   ```
4. If Redis is down, restart or failover per your Redis runbook.
5. Once Redis is restored, the readiness probe recovers automatically within one probe interval.

---

### 5.3 Database disconnected

**Symptoms:** `database: "disconnected"` in health response; AllExceptionsFilter returns `503` with `"Database temporarily unavailable"` (PG error codes `08006`, `08001`, `08004`).

**Resolution:**

1. Check PostgreSQL pod/service:
   ```bash
   kubectl get pods -l app=postgres
   psql $DATABASE_URL -c "SELECT 1;"
   ```
2. Verify `DATABASE_URL` / `DB_HOST` in the API deployment.
3. Check TypeORM connection pool status via `/metrics`:
   ```bash
   curl -s https://api.example.com/metrics | grep tycoon_db_pool
   ```
4. If `tycoon_db_pool_waiting` is high with `tycoon_db_pool_total` at max, the pool is exhausted — consider increasing `DB_POOL_SIZE` or reducing slow queries.
5. If the database is unreachable due to a failover, wait for replica promotion and confirm recovery.

---

### 5.4 Metrics scrape failing or timing out

**Symptoms:** Prometheus shows `up{job="tycoon-api"} == 0`; scrape duration exceeds the configured timeout.

**Resolution:**

1. Verify the `/metrics` endpoint responds:
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{time_total}s" https://api.example.com/metrics
   ```
2. Check API pod CPU and memory — high heap or event-loop lag (`tycoon_event_loop_lag_seconds`) blocks the response.
3. If the pod is OOM-killed, increase memory limits or investigate a memory leak.
4. If `collectPoolMetrics()` hangs, the underlying `pg` pool may be deadlocked — restart the pod as a short-term fix and open a ticket to investigate the slow query.
5. Confirm Prometheus is allowed through any network policies on port 3000 (or the configured API port).

---

### 5.5 Degraded aggregate health (partial failure)

**Symptoms:** `GET /health` returns `{ "status": "degraded" }` with HTTP 200. One dependency is up, the other is not.

**Behaviour:** Degraded returns HTTP 200 deliberately — the API is still serving requests via the healthy dependency. Kubernetes does **not** remove the pod from rotation.

**Action:**
1. Identify the failing dependency from the response body.
2. Follow the relevant runbook (5.2 or 5.3).
3. Monitor audit trail for `HEALTH_CHECK_ACCESSED` events with `result.status = "degraded"` to understand duration of the partial outage.

---

### 5.6 Audit trail not recording health/metrics access

**Symptoms:** No `HEALTH_CHECK_ACCESSED` or `METRICS_SCRAPED` rows in `audit_trails` after confirmed endpoint access.

**Triage:**

1. Confirm `AuditTrailInterceptor` is applied to the relevant route (`@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog(...)` on the handler).
2. Check for database write errors in pod logs:
   ```bash
   kubectl logs deploy/tycoon-api | grep "Failed to log audit trail"
   ```
3. Verify the `audit_trails` table exists and the API user has INSERT permission:
   ```sql
   SELECT COUNT(*) FROM audit_trails WHERE action IN ('HEALTH_CHECK_ACCESSED', 'METRICS_SCRAPED');
   ```
4. Note: `GET /health/live` and `GET /health/ready` are intentionally **not** audit-logged to avoid write pressure on every Kubernetes probe interval (every 10–30 s).

---

## 6. Emergency Procedures

### Complete API unavailability

1. Confirm the scope — is it one pod, all pods, or the load balancer?
2. Check recent deployments:
   ```bash
   kubectl rollout history deployment/tycoon-api
   ```
3. If a deployment caused the outage, roll back:
   ```bash
   kubectl rollout undo deployment/tycoon-api
   ```
4. Escalate to the infrastructure team if rollback does not resolve it.

### Memory leak / OOM pod restarts

1. Export current heap metrics:
   ```
   tycoon_process_heap_used_bytes / tycoon_process_heap_total_bytes
   ```
2. Identify the top memory consumers by checking recent code changes that add in-memory caching or large aggregations.
3. Temporarily increase `resources.limits.memory` in the deployment to keep the service alive while investigating.
4. Add a Node.js heap snapshot route (debug-only, behind auth) if a persistent investigation is needed.

---

## 7. Deployment & Rollout Notes

- **Backward compatibility:** All changes to `/health/*` and `/metrics` in SW-BE-028/029/030 are backward-compatible.
  - The `503` response on `/health/ready` was previously `200 { status: "unhealthy" }`. Kubernetes probes rely on HTTP status codes, so this is a correctness fix, not a breaking change for API consumers.
  - The `GET /health/redis` 503 behaviour is similarly a correctness fix.
  - `GET /health` (aggregate) still returns 200 for `degraded`, preserving monitoring dashboard compatibility.

- **Feature flags:** No feature flags are required. All changes take effect on pod restart.

- **Migration steps:** None. No schema changes, no new environment variables.

- **Smoke test after deploy:**
  ```bash
  curl -f https://api.example.com/health/live
  curl -f https://api.example.com/health/ready
  curl -s https://api.example.com/health | jq .status
  curl -s https://api.example.com/metrics | head -5
  ```

---

## 8. Audit Logging Reference

Access to the sensitive health aggregate and metrics endpoints is logged to the `audit_trails` table.

| `action` | Endpoint | `changes` fields |
|---|---|---|
| `HEALTH_CHECK_ACCESSED` | `GET /health`, `GET /health/redis` | `durationMs`, `result.status`, `result.redis`, `result.database` |
| `METRICS_SCRAPED` | `GET /metrics` | `durationMs` |

**Query to review recent health check access:**
```sql
SELECT
  created_at,
  ip_address,
  user_agent,
  changes->>'durationMs'      AS duration_ms,
  changes->'result'->>'status' AS health_status
FROM audit_trails
WHERE action = 'HEALTH_CHECK_ACCESSED'
ORDER BY created_at DESC
LIMIT 50;
```

**Query to detect suspicious metrics scraping patterns:**
```sql
SELECT
  ip_address,
  COUNT(*)           AS scrape_count,
  MIN(created_at)    AS first_seen,
  MAX(created_at)    AS last_seen
FROM audit_trails
WHERE action = 'METRICS_SCRAPED'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY scrape_count DESC;
```
