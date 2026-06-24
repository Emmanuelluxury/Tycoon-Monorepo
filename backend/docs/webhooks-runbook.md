# Webhooks Operational Runbook

## Overview
This runbook covers operational procedures for managing webhooks in the Tycoon backend system, including monitoring, troubleshooting, maintenance tasks, and detailed incident playbooks.

## Configuration (SW-BE-029)

### Environment Variables

All webhook configuration is environment-validated. Required variables in production:

| Variable | Type | Default | Required (Prod) | Description |
|---|---|---|---|---|
| `WEBHOOK_SECRET` | string | `dev-only-insecure-secret-change-me` | Yes | HMAC secret for signature verification (min 16 chars in production) |
| `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | int | 300 | No | Timestamp tolerance window for replay attack prevention (10-3600s) |
| `WEBHOOK_IDEMPOTENCY_TTL_DAYS` | int | 7 | No | Redis TTL for idempotency keys (1-365 days) |
| `PAYMENT_WEBHOOK_SECRET` | string | Empty | Yes | Payment provider webhook secret (min 16 chars in production) |
| `REDIS_HOST` / `REDIS_PORT` | string / int | localhost / 6379 | No | Redis connection for idempotency storage |

### Startup Validation

On startup, the application validates:
1. ✅ `WEBHOOK_SECRET` is configured and >= 16 bytes in production
2. ✅ `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` is between 10-3600 seconds
3. ✅ `WEBHOOK_IDEMPOTENCY_TTL_DAYS` is between 1-365 days
4. ✅ Redis connection is available (required for idempotency)

**Note:** The hardcoded fallback secret (`default_secret_change_me`) has been removed in SW-BE-029. Production deployments now must explicitly configure `WEBHOOK_SECRET`.

## Monitoring

### Health Checks
- Webhook endpoints are monitored via `/health` endpoint
- Redis connectivity is checked for idempotency storage
- Signature verification failures are logged and alerted
- Configuration validation occurs at startup (see logs)

### Key Metrics (Prometheus)
- `tycoon_webhook_events_total{source,event_type,status}` - Total events received
- `tycoon_webhook_signature_verification_duration_seconds{source,result}` - Verification latency
- `tycoon_webhook_signature_verification_total{source,result,failure_reason}` - Verification attempts
- `tycoon_webhook_processing_duration_seconds{source,event_type}` - Processing latency
- `tycoon_webhook_idempotency_hits_total{source,event_type}` - Duplicate detections

### Audit Trail
Access detailed audit logs via:
- `GET /webhooks/audit/:webhookId` - Logs for specific webhook
- `GET /webhooks/audit-failed?source=stripe&limit=100` - Failed operations
- `GET /webhooks/audit-stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Statistics

### Alerts
- High rate of signature verification failures (>5% in 5 minutes)
- Redis connectivity issues
- Webhook processing queue backlog
- Configuration validation failures at startup

## Troubleshooting

### Common Issues

#### Signature Verification Failures
**Symptoms:**
- 401 Unauthorized responses
- Audit logs show `signature_verification.failed` actions
- Prometheus metric `tycoon_webhook_signature_verification_total{result="failed"}` increasing

**Debug Steps:**
1. Identify failure reason from audit log or metric label:
   - `signature_mismatch` — Secret mismatch or payload tampering
   - `timestamp_outside_tolerance` — Clock skew between provider and server
   - `signature_length_mismatch` — Malformed signature header
   - `signature_format_error` — Invalid hex encoding

2. Check webhook secret:
   ```bash
   # Do NOT echo the secret; verify it's set
   echo $WEBHOOK_SECRET | wc -c  # Should be >= 17 (16 chars + newline)
   ```

3. Verify server time:
   ```bash
   # Server time must be within WEBHOOK_SIGNATURE_TOLERANCE_SECONDS of provider
   date && ntpq -p
   ```

4. Query audit trail:
   ```bash
   curl -s http://localhost:3000/api/webhooks/audit-failed?source=stripe&limit=5 | jq .
   ```

**Resolution:**
- Mismatch: Regenerate webhook secret on provider side; update `WEBHOOK_SECRET`
- Clock skew: Synchronize server time with NTP
- Malformed: Contact provider; verify signature header format
- Tolerance exceeded: Increase `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` (max 3600s)

#### Idempotency Failures (Duplicates)
**Symptoms:**
- Same event processed multiple times
- Duplicate database entries
- Audit logs show `idempotency.hit: false` for same `webhookId`

**Debug Steps:**
1. Check Redis connectivity:
   ```bash
   redis-cli PING  # Should respond PONG
   redis-cli INFO MEMORY | grep used_memory_human
   ```

2. Query idempotency key:
   ```bash
   redis-cli GET webhook:evt_123  # Should exist if already processed
   ```

3. Check TTL configuration:
   ```bash
   curl -s http://localhost:3000/api/webhooks/audit-stats | jq '.averageIdempotencyTtl'
   ```

**Resolution:**
- Redis unavailable: Restart Redis; verify connection pool settings
- Missing webhook ID: Contact provider; verify payload includes `id` field
- TTL expired: Increase `WEBHOOK_IDEMPOTENCY_TTL_DAYS` (max 365 days)
- High memory: Reduce TTL or increase Redis memory allocation

#### High Latency
**Symptoms:**
- Webhook processing taking >5 seconds
- Queue backlog building
- `tycoon_webhook_processing_duration_seconds` bucket for 10s+ increasing

**Debug Steps:**
1. Check database connectivity:
   ```bash
   pg_isready -h $DB_HOST -p $DB_PORT
   ```

2. Monitor processing latency:
   ```bash
   curl -s http://localhost:3000/metrics | grep tycoon_webhook_processing_duration
   ```

3. Check payload size:
   ```bash
   # Large payloads slow down processing
   # Typical: <10KB; Alert threshold: >100KB
   ```

**Resolution:**
- DB issues: Increase connection pool; check slow queries
- High load: Scale webhook workers or implement queueing (BullMQ)
- Large payloads: Coordinate with provider to reduce payload size

#### Missing Webhook Secret in Logs
**Symptoms:**
- Configuration validation fails at startup
- Application crashes with "WEBHOOK_SECRET not configured"

**Debug Steps:**
```bash
# Check if environment variable is set
env | grep WEBHOOK_SECRET

# In Kubernetes
kubectl describe pod <pod-name> | grep WEBHOOK_SECRET
kubectl get secret <secret-name> -o jsonpath='{.data.WEBHOOK_SECRET}' | base64 -d
```

**Resolution:**
- Set `WEBHOOK_SECRET` in `.env` or deployment configuration
- Ensure value is >= 16 characters
- Restart application
- Verify via startup logs: "webhook configuration validated"

## Maintenance

### Secret Rotation (Zero-Downtime)

**Procedure:**
1. Generate new secret (min 16 chars, high entropy)
2. Update provider webhook configuration with new secret
3. Update `WEBHOOK_SECRET` environment variable to new value
4. Deploy changes without restart (via config reload, if available)
5. Monitor signature verification metrics for 5 minutes
6. If failures spike, rollback; otherwise, continue
7. After 24 hours, remove old secret

**Example Script:**
```bash
#!/bin/bash
NEW_SECRET=$(openssl rand -hex 16)
OLD_SECRET=$WEBHOOK_SECRET

# Update in provider (manual or API call)
stripe_cli trigger webhook.verified --secret $NEW_SECRET

# Update in deployment
kubectl set env deployment/tycoon-backend WEBHOOK_SECRET=$NEW_SECRET

# Monitor for 5 minutes
for i in {1..5}; do
  FAILED=$(curl -s http://localhost:3000/metrics | \
    grep 'tycoon_webhook_signature_verification_total{result="failed"}' | \
    awk '{print $2}')
  echo "Minute $i: Failed signatures = $FAILED"
  sleep 60
done

# If satisfied, log old secret removal
echo "Rotation complete. Old secret was: [REDACTED]"
```

### Redis Maintenance

1. **Memory Management:**
   - Monitor Redis memory:
     ```bash
     redis-cli INFO MEMORY | grep -E "used_memory_human|maxmemory_human"
     ```
   - Set max memory policy:
     ```
     maxmemory 2gb
     maxmemory-policy allkeys-lru
     ```

2. **Persistence:**
   - Enable RDB snapshots for idempotency data
   - Frequency: Every 15 minutes or after 100 writes
   - Retention: 7 days

3. **Monitoring:**
   - Alert if memory > 80% of max
   - Alert if evictions occur
   - Track key count: `redis-cli DBSIZE`

### Audit Log Analysis

1. **Access Audit Endpoints:**
   ```bash
   # Get audit trail for specific webhook
   curl 'http://localhost:3000/api/webhooks/audit/evt_123'

   # Get failed operations in last 24 hours
   curl 'http://localhost:3000/api/webhooks/audit-failed?limit=100'

   # Get statistics by date range
   curl 'http://localhost:3000/api/webhooks/audit-stats?startDate=2024-06-01&endDate=2024-06-30'
   ```

2. **Common Queries:**
   ```sql
   -- Failed signature verifications in last hour
   SELECT webhookId, source, failureReason, COUNT(*) as count
   FROM webhookAuditLog
   WHERE action = 'webhook.signature.failed'
     AND createdAt > NOW() - INTERVAL '1 hour'
   GROUP BY webhookId, source, failureReason
   ORDER BY count DESC;

   -- Webhooks processed > 1 second
   SELECT webhookId, source, durationMs
   FROM webhookAuditLog
   WHERE action = 'webhook.processing.completed'
     AND durationMs > 1000
   ORDER BY durationMs DESC;

   -- Duplicate detections (idempotency hits)
   SELECT COUNT(*) as duplicates
   FROM webhookAuditLog
   WHERE action = 'webhook.idempotency.hit'
     AND createdAt > NOW() - INTERVAL '1 day';
   ```

## Incident Playbooks

### INC-001: Signature Verification Spike (>10% failure rate in 5m)

**Severity:** High | **MTTR:** 10 minutes

**Checklist:**
- [ ] Alert received: signature failure rate > 10% in 5-minute window
- [ ] Identify affected sources: `curl http://localhost:3000/metrics | grep 'failure_reason'`
- [ ] Confirm server time sync: `date && ntpq -p` (should differ < 5 seconds from NTP)
- [ ] Check webhook provider status page for outages
- [ ] Verify `WEBHOOK_SECRET` matches provider configuration (do not log value)
- [ ] Check Redis connectivity: `redis-cli PING`

**Resolution:**
1. **If clock skew detected:** Resync NTP; restart affected pods
2. **If secret mismatch:** Update `WEBHOOK_SECRET` from provider dashboard
3. **If provider issue:** Wait for provider to recover; monitor recovery
4. **If persistent:** Escalate to security team; review audit logs for tampering

**Post-Incident:**
- [ ] Review failed webhook IDs; replay if needed
- [ ] Document root cause in incident system
- [ ] Update alerting thresholds if false positive

### INC-002: Idempotency Failures (Duplicate Processing)

**Severity:** High | **MTTR:** 15 minutes

**Checklist:**
- [ ] Symptom confirmed: same `webhookId` processed twice
- [ ] Check Redis: `redis-cli DBSIZE` and `redis-cli INFO MEMORY`
- [ ] Query audit trail: `curl http://localhost:3000/api/webhooks/audit/evt_xxx`
- [ ] Confirm webhook payload includes `id` field
- [ ] Verify TTL: `WEBHOOK_IDEMPOTENCY_TTL_DAYS` >= 7

**Resolution:**
1. **If Redis down:** Restart Redis; redeploy webhook service
2. **If Redis at capacity:** Increase memory limit; adjust TTL down if needed
3. **If missing ID:** Coordinate with provider; configure payload to include ID
4. **If TTL too short:** Increase `WEBHOOK_IDEMPOTENCY_TTL_DAYS` to 30

**Deduplication:**
```bash
# Find duplicate webhooks
curl 'http://localhost:3000/api/webhooks/audit-stats?startDate=today' | \
  jq '.duplicateWebhookIds[]'

# Identify business impact
psql -c "SELECT COUNT(DISTINCT webhook_id) FROM duplicate_entries;"

# Replay correct business logic if needed
curl -X POST http://localhost:3000/api/webhooks/replay \
  -H "Content-Type: application/json" \
  -d '{"webhookIds": ["evt_123", "evt_124"]}'
```

**Post-Incident:**
- [ ] Fix provider configuration to ensure unique IDs
- [ ] Increase Redis capacity if memory was bottleneck
- [ ] Review business logic for duplicate safety (idempotent operations)

### INC-003: High Webhook Latency (>5s processing)

**Severity:** Medium | **MTTR:** 20 minutes

**Checklist:**
- [ ] Latency confirmed: `tycoon_webhook_processing_duration_seconds_bucket{le="5"}`
- [ ] Check database health: `pg_isready -h $DB_HOST`; verify connection pool
- [ ] Monitor CPU/memory on pod: `kubectl top pod <pod>`
- [ ] Check payload size: review recent webhook logs
- [ ] Query slow webhooks: see audit log SQL example above

**Resolution:**
1. **If DB slow:** Scale DB; check for table locks; analyze slow queries
2. **If pod resource constrained:** Increase pod resources; scale replicas
3. **If large payloads:** Contact provider; request payload size reduction
4. **If processing logic slow:** Profile webhook handler; optimize queries

**Scaling:**
```yaml
# Increase replica count in Kubernetes
kubectl scale deployment tycoon-backend --replicas=5

# Monitor impact
kubectl top pods -l app=tycoon-backend --sort-by=memory
```

**Post-Incident:**
- [ ] Document capacity limits (webhooks/sec for current setup)
- [ ] Configure proactive scaling based on queue depth
- [ ] Review SLA and set realistic latency targets

### INC-004: Redis Connectivity Lost

**Severity:** Critical | **MTTR:** 5 minutes

**Checklist:**
- [ ] Application errors: "Redis connection refused"
- [ ] Application cannot start if `REDIS_HOST` unavailable
- [ ] Webhooks cannot be marked idempotent
- [ ] Duplicate webhooks likely during outage

**Resolution:**
1. **Immediate:** Check Redis service health; restart if hung
   ```bash
   kubectl get pod -l app=redis
   kubectl logs <redis-pod>
   kubectl delete pod <redis-pod>  # Force restart
   ```

2. **Verify connectivity:** `redis-cli -h $REDIS_HOST -p $REDIS_PORT PING`

3. **Restart application:** `kubectl rollout restart deployment/tycoon-backend`

4. **Monitor recovery:** Watch idempotency hits resuming normally

**Prevention:**
- [ ] Add Redis readiness probe: `redis-cli PING`
- [ ] Configure pod anti-affinity (Redis on different node from app)
- [ ] Set up Redis cluster for failover

**Post-Incident:**
- [ ] Replay webhooks received during outage (if not idempotent)
- [ ] Review Redis HA configuration
- [ ] Update SLA for webhook processing availability

### INC-005: Configuration Validation Failure at Startup

**Severity:** Critical | **MTTR:** 2 minutes

**Checklist:**
- [ ] Application fails to start
- [ ] Logs show: "WEBHOOK_SECRET not configured" or "validation error"
- [ ] Check environment variables: `env | grep WEBHOOK`
- [ ] Verify deployment secret is mounted: `kubectl describe pod <pod> | grep -A 20 Mounts`

**Resolution:**
1. **Immediate:** Ensure `WEBHOOK_SECRET` is set in deployment:
   ```bash
   kubectl set env deployment/tycoon-backend WEBHOOK_SECRET=<value>
   ```

2. **Verify value is valid:**
   - Minimum 16 characters
   - No spaces or special characters requiring escaping

3. **Restart deployment:**
   ```bash
   kubectl rollout restart deployment/tycoon-backend
   ```

**Prevention:**
- [ ] Store secret in Kubernetes Secret or sealed-secret
- [ ] Add readiness probe that validates configuration
- [ ] Pre-deployment validation step in CI/CD

**Post-Incident:**
- [ ] Document secret management procedure
- [ ] Add configuration validation to deployment checklist

## Rollout Procedures

### Feature Flag Deployment
Webhooks features use feature flags for gradual rollout:

1. Deploy code with feature flag checks
2. Enable feature flag in staging environment
3. Test webhook processing with flag enabled
4. Gradually enable in production (canary deployment)
5. Monitor metrics and error rates
6. Fully enable or rollback based on results

### Backward Compatibility
- All webhook changes maintain backward compatibility
- New validation rules are additive
- Idempotency is transparent to webhook providers
- Configuration changes (SW-BE-029) are backward-compatible; no migration needed

### Migration Notes (SW-BE-029)

**Breaking Changes:** None

**Soft Changes:**
- Hardcoded fallback secret removed; must explicitly configure `WEBHOOK_SECRET` in production
- **Action:** Update deployment to include `WEBHOOK_SECRET` environment variable

**Feature Additions:**
- `WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` configurable (default 300)
- `WEBHOOK_IDEMPOTENCY_TTL_DAYS` configurable (default 7)
- Environment validation tests added
- **Action:** No change required; uses sensible defaults

**Test Coverage:**
- New tests added in `src/config/env.validation.webhooks.spec.ts`
- New service tests for configuration in `src/modules/webhooks/webhooks.service.spec.ts`
- Run: `npm test -- src/config/env.validation.webhooks.spec.ts src/modules/webhooks/webhooks.service.spec.ts`

## Security Considerations

### Secret Management
- Webhook secrets stored in secure environment variables (not files)
- No secrets logged in application logs (audit service sanitizes JSONB metadata)
- Regular secret rotation procedure (see Maintenance section)
- Use strong secret generation: `openssl rand -hex 16` (32 hex chars = 16 bytes)

### Rate Limiting
- Implement rate limiting at infrastructure level (Nginx, API Gateway)
- Monitor for abuse patterns: same IP, high failure rate
- Block suspicious IP addresses at WAF layer

### Audit Logging
- All webhook attempts logged with request ID
- Sensitive data redacted from logs (signature, token, password, webhookSecret)
- Logs retained for 90 days minimum for forensics
- PII not stored in webhook payloads (design requirement)

### Compliance
- SOC 2: Audit trail immutable; retention policy enforced
- GDPR: No personal data in webhook logs; user data export supported
- PCI DSS: No payment card data in logs; signature uses HSM-grade HMAC

## Disaster Recovery

### Scenario: Webhook Audit Log Corruption

1. Stop application: `kubectl scale deployment tycoon-backend --replicas=0`
2. Backup database: `pg_dump tycoon > backup.sql`
3. Restore from last good backup: `psql tycoon < backup.sql`
4. Restart application: `kubectl scale deployment tycoon-backend --replicas=3`
5. Audit trail restored to last backup point
6. Replay webhooks since last backup if needed

### Scenario: Extended Redis Outage

1. If Redis unavailable for > 1 hour, idempotency keys are lost
2. Webhooks received during outage must be manually replayed
3. Identify via audit logs: `action = 'webhook.received' AND createdAt > <outage_start>`
4. Replay: `curl -X POST /api/webhooks/replay -d '{"webhookIds": [...]}'`
5. Monitor for duplicate processing; implement business logic guards

---

**Last Updated:** 2025-06 | **Version:** 2.0 (SW-BE-029) | **Status:** Approved for Production