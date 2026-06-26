# Operational Runbook: Games & Matchmaking

**Stellar Wave** · SW-BE-018

## Overview
This runbook covers game lifecycle management, matchmaking operations, incident response,
and day-to-day maintenance for the Tycoon Games & Matchmaking system.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Key Metrics & Dashboards](#key-metrics--dashboards)
3. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
4. [Operational Procedures](#operational-procedures)
5. [Incident Response](#incident-response)
6. [Runbook Automation](#runbook-automation)
7. [Support Contacts](#support-contacts)

---

## Architecture Overview

```
Client
  │
  ▼
GamesController  ──► GamesService  ──► GamePlayersService
                          │
                          ├──► GamesObservabilityService  ──► Prometheus / Grafana
                          ├──► GamesAuditService          ──► audit_trails table
                          ├──► IdempotencyInterceptor     ──► Redis (idempotency:*)
                          └──► GameValidators             ──► GameExceptions
```

### State machine
```
PENDING ──► RUNNING ──► FINISHED
   │                        │
   └──► CANCELLED ◄──────────┘
```

---

## Key Metrics & Dashboards

| Metric | Type | Threshold / Alert |
|--------|------|-------------------|
| `tycoon_games_active_total` | Gauge | Alert if > 500 for > 5 min |
| `tycoon_matchmaking_duration_seconds` | Histogram | p95 > 10 s → page on-call |
| `tycoon_idempotency_hits_total` | Counter | Spike > 5× baseline → investigate client |
| `tycoon_game_errors_total{type="GameNotFoundException"}` | Counter | > 10/min → alert |
| `tycoon_game_errors_total{type="GameFullException"}` | Counter | > 50/min → scale |

Grafana dashboard: **Tycoon / Games & Matchmaking** (search in Grafana → `games`).

---

## Common Issues & Troubleshooting

### 1. Matchmaking Timeouts — users stuck in PENDING

**Symptoms:** Players report "Waiting for opponent…" forever; `tycoon_matchmaking_duration_seconds` p95 spikes.

**Diagnosis:**
```sql
-- Count stuck pending games
SELECT count(*), created_at::date
FROM games
WHERE status = 'PENDING'
GROUP BY 2
ORDER BY 2 DESC;
```

```bash
# Check matchmaking queue depth in Redis
redis-cli KEYS "matchmaking:*" | wc -l
redis-cli LLEN matchmaking:queue
```

**Resolution:**
1. If queue is empty but PENDING count is high → the AI job worker may be down. Check:
   ```bash
   kubectl get pods -l app=tycoon-jobs
   kubectl logs -l app=tycoon-jobs --tail=50
   ```
2. If queue is growing → backend may be overloaded. Scale the deployment:
   ```bash
   kubectl scale deployment tycoon-backend --replicas=4
   ```
3. If neither → cancel stale PENDING games older than 30 minutes:
   ```sql
   UPDATE games
   SET status = 'CANCELLED'
   WHERE status = 'PENDING'
     AND created_at < NOW() - INTERVAL '30 minutes';
   ```

---

### 2. "Stuck" Running Games — no moves being made

**Symptoms:** A game is `RUNNING` but the player has not moved for > 5 minutes.

**Diagnosis:**
```sql
SELECT g.id, g.next_player_id, u.username, g.updated_at
FROM games g
JOIN users u ON u.id = g.next_player_id
WHERE g.status = 'RUNNING'
  AND g.updated_at < NOW() - INTERVAL '5 minutes';
```

**Resolution (emergency only):**
```sql
-- Option A: Cancel the game
UPDATE games SET status = 'CANCELLED' WHERE id = '<GAME_ID>';

-- Option B: Force-advance the turn (requires knowing next_player_id in the rotation)
-- Use the GamesService.updateTurn endpoint instead of direct SQL where possible.
```

**Post-mortem checklist:**
- Did the AI worker crash mid-game?
- Did the player's WebSocket disconnect without the server noticing?
- Check `GamesObservabilityService` logs for the `game_id`.

---

### 3. Idempotency Errors

#### `400 Bad Request — "X-Idempotency-Key header is required"`
- The frontend is not sending the header on a mutating request (roll dice, buy property).
- Fix: frontend must generate a UUID v4 for every mutation and include it as `Idempotency-Key`.

#### `409 Conflict — "A request with this idempotency key is already in progress"`
- A duplicate request arrived while the first is still processing.
- Normal behaviour; advise the client to wait 2–3 seconds before retrying.
- If it persists: inspect the Redis key directly:
  ```bash
  redis-cli GET "idempotency:<KEY>"
  ```
  If status is still `processing` after > 30 s, the original request likely failed silently.
  Delete the key to unblock the user:
  ```bash
  redis-cli DEL "idempotency:<KEY>"
  ```

#### `200 OK — replayed response`
- Normal; the same idempotency key was submitted a second time and the cached response was returned.
- Monitor `tycoon_idempotency_hits_total` to detect abusive retry patterns.

---

### 4. `GameNotFoundException` (404) Spike

**Cause:** Stale client IDs, or a game was cancelled server-side and the client hasn't refreshed.

**Resolution:**
- No server action required in most cases. Check whether a deployment rolled back and removed games from the DB.

---

### 5. `GameFullException` (409) Spike

**Cause:** Many players attempting to join the same game simultaneously.

**Resolution:**
- Expected during viral moments; monitor and scale if CPU > 80%.
- If it's unexpected (single game constantly full), investigate whether `maxPlayers` is being set too low.

---

## Operational Procedures

### Inspect Game State in Redis

```bash
# Current game cache
redis-cli GET "cache:game:<GAME_ID>"

# All matchmaking keys
redis-cli KEYS "*matchmaking*"

# Idempotency records for a specific key
redis-cli GET "idempotency:<KEY_VALUE>"

# Session tokens for a player
redis-cli GET "refresh_token:<USER_ID>"
```

### Purge Stale Idempotency Keys

Idempotency keys have a 24 h TTL by default. To manually purge for a specific game:
```bash
redis-cli DEL "idempotency:<KEY_VALUE>"
```

### Force-Finish a Game (Admin)

Use the admin API (requires `ADMIN` role JWT):
```bash
curl -X PATCH https://api.tycoon.gg/games/<GAME_ID> \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"status": "FINISHED"}'
```

### Rebalance AI Players

If AI players are not making moves:
1. Check jobs worker is running:
   ```bash
   kubectl get pods -l app=tycoon-jobs
   ```
2. Bounce the worker:
   ```bash
   kubectl rollout restart deployment/tycoon-jobs
   ```
3. Check for errors in `GamePlayersService.rollDice` logs filtered by AI player IDs (`isAI: true`).

---

## Incident Response

### Severity Levels

| Level | Condition | Response Time |
|-------|-----------|---------------|
| P0 | All games fail to start; matchmaking completely down | 15 min |
| P1 | > 20% of games stuck; idempotency service unavailable | 1 h |
| P2 | Elevated error rates, degraded matchmaking p95 | 4 h |
| P3 | Single-game issues, edge-case exceptions | Next business day |

### P0 Response Checklist

1. [ ] Verify Redis is healthy: `GET /health/redis`
2. [ ] Verify DB is reachable: `GET /health/ready`
3. [ ] Check backend pod logs: `kubectl logs -l app=tycoon-backend --tail=200`
4. [ ] Check for recent deployments: `kubectl rollout history deployment/tycoon-backend`
5. [ ] Rollback if deployment caused the incident: `kubectl rollout undo deployment/tycoon-backend`
6. [ ] Notify `#incidents` Slack channel with: time detected, impact, current status.

---

## Runbook Automation

Automated smoke test (run after every deployment):
```bash
cd backend
bash scripts/smoke-test.sh
```

Expected output includes:
```
✅ /health/ready → healthy
✅ POST /games → 201
✅ POST /games/:id/join → 200
✅ PATCH /games/:id/roll-dice → 200 (idempotent replay on 2nd call)
```

---

## Feature Flags

No feature flags are currently active for Games & Matchmaking.
New flags must be added to `ConfigService` and documented here before enabling.

---

## Support Contacts

| Team | Channel |
|------|---------|
| Game Logic | #team-game-engine |
| Infrastructure / Redis | #team-infra |
| On-call (P0/P1) | PagerDuty → Tycoon Backend policy |

---

*Last updated: 2026-06-24 — SW-BE-018*
