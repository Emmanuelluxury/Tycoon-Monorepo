/**
 * SW-BE-029 — AuditTrailInterceptor: audit trail hooks tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditTrailInterceptor, AUDIT_ACTION_KEY } from './audit-trail.interceptor';
import { AuditTrailService } from './audit-trail.service';
import { AuditAction } from './entities/audit-trail.entity';

// ── helpers ───────────────────────────────────────────────────────────────────

const mockAuditService = { log: jest.fn() };
const mockReflector = { get: jest.fn() };

function buildContext(
  action: AuditAction | undefined,
  user?: { id?: number; email?: string },
): ExecutionContext {
  mockReflector.get.mockReturnValue(action);
  return {
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest-test' },
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(value: unknown): CallHandler {
  return { handle: () => of(value) } as unknown as CallHandler;
}

function buildErrorHandler(error: Error): CallHandler {
  return { handle: () => throwError(() => error) } as unknown as CallHandler;
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AuditTrailInterceptor', () => {
  let interceptor: AuditTrailInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailInterceptor,
        { provide: AuditTrailService, useValue: mockAuditService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    interceptor = module.get<AuditTrailInterceptor>(AuditTrailInterceptor);
    jest.clearAllMocks();
  });

  // ── no action metadata ────────────────────────────────────────────────────

  describe('when no @AuditLog decorator is present', () => {
    it('passes through without calling the audit service', (done) => {
      const ctx = buildContext(undefined);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          expect(mockAuditService.log).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  // ── action metadata present ───────────────────────────────────────────────

  describe('when @AuditLog(action) is present', () => {
    it('calls audit service with the correct action', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            expect(mockAuditService.log).toHaveBeenCalledWith(
              AuditAction.HEALTH_CHECK_ACCESSED,
              expect.any(Object),
            );
            done();
          });
        },
      });
    });

    it('includes durationMs in changes (positive number)', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { changes: Record<string, unknown> }];
            expect(typeof opts.changes['durationMs']).toBe('number');
            expect(opts.changes['durationMs'] as number).toBeGreaterThanOrEqual(0);
            done();
          });
        },
      });
    });

    it('captures health status in changes.result for health check response', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'degraded', redis: 'disconnected', database: 'connected' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { changes: Record<string, unknown> }];
            expect(opts.changes['result']).toMatchObject({
              status: 'degraded',
              redis: 'disconnected',
              database: 'connected',
            });
            done();
          });
        },
      });
    });

    it('captures byteLength for metrics scrape (string payload)', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.METRICS_SCRAPED);
      const metricsText = '# HELP tycoon_http_requests_total ...\n';
      const handler = buildHandler(metricsText);

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { changes: Record<string, unknown> }];
            expect(opts.changes['durationMs']).toBeDefined();
            expect((opts.changes['result'] as Record<string, unknown>)['byteLength']).toBe(metricsText.length);
            done();
          });
        },
      });
    });

    it('forwards userId and userEmail from request.user', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED, { id: 42, email: 'ops@example.com' });
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { userId: unknown; userEmail: unknown }];
            expect(opts.userId).toBe(42);
            expect(opts.userEmail).toBe('ops@example.com');
            done();
          });
        },
      });
    });

    it('handles unauthenticated requests (no user) without throwing', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED, undefined);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { userId: unknown }];
            expect(opts.userId).toBeUndefined();
            done();
          });
        },
      });
    });

    it('forwards ipAddress and userAgent', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { ipAddress: unknown; userAgent: unknown }];
            expect(opts.ipAddress).toBe('127.0.0.1');
            expect(opts.userAgent).toBe('jest-test');
            done();
          });
        },
      });
    });
  });

  // ── audit service failure ─────────────────────────────────────────────────

  describe('when audit service throws', () => {
    it('does not propagate the error to the caller', (done) => {
      mockAuditService.log.mockRejectedValue(new Error('DB write failed'));
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'healthy' });

      interceptor.intercept(ctx, handler).subscribe({
        next: (val) => {
          expect(val).toEqual({ status: 'healthy' });
          done();
        },
        error: done.fail,
      });
    });
  });

  // ── handler error ─────────────────────────────────────────────────────────

  describe('when the handler throws', () => {
    it('propagates the error and does not call audit service', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildErrorHandler(new Error('handler failure'));

      interceptor.intercept(ctx, handler).subscribe({
        next: () => done.fail('should not emit a value'),
        error: (err: Error) => {
          expect(err.message).toBe('handler failure');
          setImmediate(() => {
            expect(mockAuditService.log).not.toHaveBeenCalled();
            done();
          });
        },
      });
    });
  });

  // ── changes payload does not contain secrets ──────────────────────────────

  describe('audit changes payload', () => {
    it('does not include sensitive fields in changes', (done) => {
      mockAuditService.log.mockResolvedValue(undefined);
      const ctx = buildContext(AuditAction.HEALTH_CHECK_ACCESSED);
      const handler = buildHandler({ status: 'healthy', password: 'should-not-appear', token: 'secret' });

      interceptor.intercept(ctx, handler).subscribe({
        next: () => {
          setImmediate(() => {
            const [, opts] = mockAuditService.log.mock.calls[0] as [unknown, { changes: Record<string, unknown> }];
            const serialised = JSON.stringify(opts.changes);
            expect(serialised).not.toMatch(/password/i);
            expect(serialised).not.toMatch(/token/i);
            done();
          });
        },
      });
    });
  });
});
