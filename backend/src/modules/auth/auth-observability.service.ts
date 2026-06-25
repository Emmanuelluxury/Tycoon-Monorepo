/**
 * SW-BE-001: Auth & JWT — observability (logs, traces, metrics)
 *
 * AuthObservabilityService adds structured Prometheus metrics on top of
 * the existing AuthAuditService log trail.
 *
 * Design constraints:
 *  - No secrets, tokens, passwords, or PII in metric labels.
 *  - Counters only (statsd-style); no histograms that could leak timing of
 *    individual accounts.
 *  - Integrates with the existing Registry used by HttpMetricsService so all
 *    auth metrics are scraped from the same /metrics endpoint.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { AuthAuditEvent, AuthAuditEventType } from './audit/auth-audit.events';

@Injectable()
export class AuthObservabilityService {
  private readonly logger = new Logger(AuthObservabilityService.name);

  /** Shared Prometheus registry; exported so the metrics controller can scrape it. */
  readonly registry = new Registry();

  /** Total auth events labelled only by event type — no user-level labels. */
  private readonly authEventsTotal: Counter<'event'>;

  /** Login outcomes segmented by method (password | wallet) and result (success | failure | suspended). */
  private readonly loginAttemptsTotal: Counter<'method' | 'result'>;

  /** Token lifecycle events: refresh_ok, refresh_failed, reuse_detected, logout. */
  private readonly tokenEventsTotal: Counter<'action'>;

  constructor() {
    this.authEventsTotal = new Counter({
      name: 'tycoon_auth_events_total',
      help: 'Total auth audit events by type',
      labelNames: ['event'],
      registers: [this.registry],
    });

    this.loginAttemptsTotal = new Counter({
      name: 'tycoon_auth_login_attempts_total',
      help: 'Login attempts by auth method and result',
      labelNames: ['method', 'result'],
      registers: [this.registry],
    });

    this.tokenEventsTotal = new Counter({
      name: 'tycoon_auth_token_events_total',
      help: 'Token lifecycle events (refresh, reuse detection, logout)',
      labelNames: ['action'],
      registers: [this.registry],
    });
  }

  /**
   * Record an auth event.
   * Call this alongside AuthAuditService.record() so both log + metric are updated.
   */
  record(event: AuthAuditEventType): void {
    // Increment generic event counter — event label is safe (enum value, no PII).
    this.authEventsTotal.inc({ event });

    // Increment more specific counters for dashboarding.
    switch (event) {
      case AuthAuditEvent.LOGIN_SUCCESS:
        this.loginAttemptsTotal.inc({ method: 'password', result: 'success' });
        this.logger.log(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.LOGIN_FAILED:
        this.loginAttemptsTotal.inc({ method: 'password', result: 'failure' });
        this.logger.warn(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.LOGIN_SUSPENDED:
        this.loginAttemptsTotal.inc({ method: 'password', result: 'suspended' });
        this.logger.warn(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.WALLET_LOGIN_SUCCESS:
        this.loginAttemptsTotal.inc({ method: 'wallet', result: 'success' });
        this.logger.log(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.WALLET_LOGIN_FAILED:
        this.loginAttemptsTotal.inc({ method: 'wallet', result: 'failure' });
        this.logger.warn(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.TOKEN_REFRESHED:
        this.tokenEventsTotal.inc({ action: 'refresh_ok' });
        break;

      case AuthAuditEvent.TOKEN_REFRESH_FAILED:
        this.tokenEventsTotal.inc({ action: 'refresh_failed' });
        this.logger.warn(`[OBS] ${event}`);
        break;

      case AuthAuditEvent.TOKEN_REUSE_DETECTED:
        this.tokenEventsTotal.inc({ action: 'reuse_detected' });
        this.logger.warn(`[OBS] ${event} — potential replay attack`);
        break;

      case AuthAuditEvent.LOGOUT:
        this.tokenEventsTotal.inc({ action: 'logout' });
        break;

      default:
        // Unknown event types are still counted in the generic counter above.
        break;
    }
  }

  /** Render all auth metrics in Prometheus text format. */
  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
