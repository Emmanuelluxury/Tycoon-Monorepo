# Webhooks Quick Reference (SW-BE-029)

**For on-call teams during incidents**

---

## Critical Environment Variables

```bash
# REQUIRED in production (min 16 chars)
WEBHOOK_SECRET=your-secret-here

# OPTIONAL (uses sensible defaults)
WEBHOOK_SIGNATURE_TOLERANCE_SECONDS=300        # Default: 300 (5 minutes)
WEBHOOK_IDEMPOTENCY_TTL_DAYS=7                 # Default: 7 days
PAYMENT_WEBHOOK_SECRET=payment-secret-here     # REQUIRED in production
```

**Verification:**
```bash
# Check if configuration is set
env | grep WEBHOOK

# Application startup will FAIL if WEBHOOK_SECRET not configured in production
# Look for log: "webhook configuration validated" ✅
```

---

## Common Issues & Quick Fixes

### Signature Verification Failing (INC-001)

**Symptoms:** 401 errors, metric `tycoon_webhook_signature_verification_total{result="failed"}` increasing

**Quick Fix:**
```bash
# 1. Verify secret matches provider
echo "Check provider dashboard for current secret"

# 2. Check server time (must be within 5 min of provider)
date
ntpq -p

# 3. Query failed webhooks
curl 'http://localhost:3000/api/webhooks/audit-failed?limit=5'

# 4. If time is off, sync:
timedatectl set-ntp true
systemctl restart ntpd
```

### Duplicate Webhooks Processing (INC-002)

**Symptoms:** Same event processed twice, audit shows `idempotency.hit: false`

**Quick Fix:**
```bash
# 1. Check Redis
redis-cli PING              # Should respond PONG
redis-cli DBSIZE            # Show key count
redis-cli INFO MEMORY       # Check memory usage

# 2. Check if key exists
redis-cli GET webhook:evt_123  # Should exist after first processing

# 3. If Redis is down, restart it
kubectl delete pod -l app=redis

# 4. Monitor recovery
watch 'curl -s http://localhost:3000/metrics | grep tycoon_webhook_idempotency'
```

### High Latency (INC-003)

**Symptoms:** Processing takes >5 seconds, queue backing up

**Quick Fix:**
```bash
# 1. Check database
pg_isready -h $DB_HOST -p $DB_PORT

# 2. Check pod resources
kubectl top pods -l app=tycoon-backend

# 3. Scale if needed
kubectl scale deployment tycoon-backend --replicas=5

# 4. Monitor
kubectl top pods -l app=tycoon-backend --sort-by=memory
```

### Redis Down (INC-004)

**Symptoms:** Redis connection refused, application can't start

**Quick Fix:**
```bash
# 1. Immediate: Restart Redis
kubectl get pod -l app=redis
kubectl delete pod <redis-pod>

# 2. Verify it's up
redis-cli PING

# 3. Restart application
kubectl rollout restart deployment/tycoon-backend

# 4. Check startup logs
kubectl logs -l app=tycoon-backend --tail=50
```

### Configuration Error at Startup (INC-005)

**Symptoms:** Application crashes on startup, "WEBHOOK_SECRET not configured"

**Quick Fix:**
```bash
# 1. Set the environment variable
kubectl set env deployment/tycoon-backend WEBHOOK_SECRET=<value>

# 2. Restart
kubectl rollout restart deployment/tycoon-backend

# 3. Verify startup
kubectl logs -l app=tycoon-backend --tail=50 | grep "webhook configuration"
```

---

## Monitoring URLs

```bash
# Health check
curl http://localhost:3000/health

# Prometheus metrics
curl http://localhost:3000/metrics | grep tycoon_webhook

# Audit logs
curl http://localhost:3000/api/webhooks/audit-stats
curl http://localhost:3000/api/webhooks/audit-failed?limit=10
curl http://localhost:3000/api/webhooks/audit/evt_123
```

---

## Alert Thresholds

| Alert | Threshold | Action |
|---|---|---|
| Signature failures | >10% in 5m | Check INC-001 playbook |
| Redis unavailable | Down 1m | Check INC-004 playbook |
| Processing latency p99 | >5s | Check INC-003 playbook |
| Startup validation failure | Any | Check INC-005 playbook |

---

## Emergency Rollback

```bash
# 1. Revert deployment
kubectl rollout undo deployment/tycoon-backend

# 2. If secret changed, revert in provider
# (Manual step via provider dashboard)

# 3. Monitor
kubectl logs -f -l app=tycoon-backend

# 4. Create incident ticket
```

---

## Escalation Path

1. **On-Call Level 1:** Use quick fixes above
2. **Platform Team:** Redis/infrastructure issues
3. **Backend Lead:** Signature verification issues
4. **Security Team:** Secret compromise suspected

---

## Documentation Links

- **Full Runbook:** `docs/webhooks-runbook.md`
- **Incident Playbooks:** `docs/webhooks-runbook.md` (INC-001 through INC-005)
- **Secret Rotation:** `src/modules/webhooks/SECRET_ROTATION.md`
- **Metrics:** `src/modules/webhooks/OBSERVABILITY.md`

---

**Version:** SW-BE-029 | **Last Updated:** 2025-06 | **Status:** Production Ready
