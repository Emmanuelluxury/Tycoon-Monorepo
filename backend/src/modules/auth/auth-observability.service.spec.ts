/**
 * SW-BE-001: Auth observability — unit tests
 *
 * Verifies that:
 *  1. AuthObservabilityService is instantiable.
 *  2. Each auth event increments the correct Prometheus counter labels.
 *  3. getMetricsText() produces Prometheus text output containing the counters.
 *  4. No PII is present in metric names or label values.
 */
import { AuthObservabilityService } from './auth-observability.service';
import { AuthAuditEvent } from './audit/auth-audit.events';

describe('AuthObservabilityService', () => {
  let service: AuthObservabilityService;

  beforeEach(() => {
    service = new AuthObservabilityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('exposes a Prometheus registry', () => {
    expect(service.registry).toBeDefined();
  });

  describe('getMetricsText()', () => {
    it('returns a non-empty string', async () => {
      const text = await service.getMetricsText();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('contains tycoon_auth_events_total after a LOGIN_SUCCESS event', async () => {
      service.record(AuthAuditEvent.LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_auth_events_total');
    });

    it('contains tycoon_auth_login_attempts_total', async () => {
      service.record(AuthAuditEvent.LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_auth_login_attempts_total');
    });

    it('contains tycoon_auth_token_events_total', async () => {
      service.record(AuthAuditEvent.TOKEN_REFRESHED);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_auth_token_events_total');
    });
  });

  describe('record() — login events', () => {
    it('increments login_attempts{method=password,result=success} on LOGIN_SUCCESS', async () => {
      service.record(AuthAuditEvent.LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      expect(text).toContain('method="password"');
      expect(text).toContain('result="success"');
    });

    it('increments login_attempts{method=password,result=failure} on LOGIN_FAILED', async () => {
      service.record(AuthAuditEvent.LOGIN_FAILED);
      const text = await service.getMetricsText();
      expect(text).toContain('result="failure"');
    });

    it('increments login_attempts{method=password,result=suspended} on LOGIN_SUSPENDED', async () => {
      service.record(AuthAuditEvent.LOGIN_SUSPENDED);
      const text = await service.getMetricsText();
      expect(text).toContain('result="suspended"');
    });

    it('increments login_attempts{method=wallet,result=success} on WALLET_LOGIN_SUCCESS', async () => {
      service.record(AuthAuditEvent.WALLET_LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      expect(text).toContain('method="wallet"');
      expect(text).toContain('result="success"');
    });

    it('increments login_attempts{method=wallet,result=failure} on WALLET_LOGIN_FAILED', async () => {
      service.record(AuthAuditEvent.WALLET_LOGIN_FAILED);
      const text = await service.getMetricsText();
      expect(text).toContain('method="wallet"');
      expect(text).toContain('result="failure"');
    });
  });

  describe('record() — token events', () => {
    it('increments token_events{action=refresh_ok} on TOKEN_REFRESHED', async () => {
      service.record(AuthAuditEvent.TOKEN_REFRESHED);
      const text = await service.getMetricsText();
      expect(text).toContain('action="refresh_ok"');
    });

    it('increments token_events{action=refresh_failed} on TOKEN_REFRESH_FAILED', async () => {
      service.record(AuthAuditEvent.TOKEN_REFRESH_FAILED);
      const text = await service.getMetricsText();
      expect(text).toContain('action="refresh_failed"');
    });

    it('increments token_events{action=reuse_detected} on TOKEN_REUSE_DETECTED', async () => {
      service.record(AuthAuditEvent.TOKEN_REUSE_DETECTED);
      const text = await service.getMetricsText();
      expect(text).toContain('action="reuse_detected"');
    });

    it('increments token_events{action=logout} on LOGOUT', async () => {
      service.record(AuthAuditEvent.LOGOUT);
      const text = await service.getMetricsText();
      expect(text).toContain('action="logout"');
    });
  });

  describe('PII safety', () => {
    it('metric output does not contain email addresses', async () => {
      service.record(AuthAuditEvent.LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      expect(text).not.toMatch(/@/);
    });

    it('metric label names contain no PII fields', async () => {
      service.record(AuthAuditEvent.LOGIN_SUCCESS);
      const text = await service.getMetricsText();
      const piiFields = ['user_id', 'email', 'ip', 'token', 'password'];
      piiFields.forEach((field) => expect(text).not.toContain(field));
    });
  });
});
