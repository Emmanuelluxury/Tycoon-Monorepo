import { of, throwError } from 'rxjs';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import {
  WebhooksObservabilityInterceptor,
} from './webhooks-observability.interceptor';
import { WebhooksObservabilityService } from './webhooks-observability.service';

function makeObs() {
  return {
    createTraceContext: jest.fn((source: string, traceId?: string) => ({
      trace_id: traceId || 'generated-trace',
      source,
      ts: new Date().toISOString(),
    })),
    logHttpRequest: jest.fn(),
    logger: {
      logWithMeta: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  } as unknown as WebhooksObservabilityService;
}

function makeContext(
  path: string,
  headers: Record<string, string | string[] | undefined> = {},
  method = 'POST',
) {
  const req = {
    method,
    path,
    url: path,
    headers,
    correlationId: undefined as string | undefined,
  } as Record<string, unknown>;
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode: 200 }),
    }),
    _req: req,
  } as unknown as ExecutionContext & { _req: Record<string, unknown> };
}

describe('WebhooksObservabilityInterceptor (SW-BE-019)', () => {
  let obs: WebhooksObservabilityService;
  let interceptor: WebhooksObservabilityInterceptor;

  beforeEach(() => {
    obs = makeObs();
    interceptor = new WebhooksObservabilityInterceptor(obs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('traceId extraction', () => {
    it('uses x-request-id header as traceId when present', async () => {
      const ctx = makeContext('/webhooks/stripe', { 'x-request-id': 'trace-123' });
      const next = { handle: () => of({}) };

      await interceptor.intercept(ctx, next).toPromise();

      expect(obs.createTraceContext).toHaveBeenCalledWith('webhook', 'trace-123');
    });

    it('generates fallback traceId when x-request-id is absent', async () => {
      const ctx = makeContext('/webhooks/stripe', {});
      const next = { handle: () => of({}) };

      await interceptor.intercept(ctx, next).toPromise();

      const call = (obs.createTraceContext as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('webhook');
      expect(typeof call[1]).toBe('string');
      expect(call[1].length).toBeGreaterThan(0);
    });

    it('generates fallback traceId when x-request-id exceeds 128 chars', async () => {
      const longId = 'x'.repeat(200);
      const ctx = makeContext('/webhooks/stripe', { 'x-request-id': longId });
      const next = { handle: () => of({}) };

      await interceptor.intercept(ctx, next).toPromise();

      const call = (obs.createTraceContext as jest.Mock).mock.calls[0];
      expect(call[1]).not.toBe(longId);
      expect(call[1].length).toBeGreaterThan(0);
    });

    it('falls back to correlationId when x-request-id is absent', async () => {
      const req = {
        method: 'POST',
        path: '/webhooks/stripe',
        url: '/webhooks/stripe',
        headers: {},
        correlationId: 'corr-456',
      } as Record<string, unknown>;
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => ({ statusCode: 200 }),
        }),
        _req: req,
      } as unknown as ExecutionContext & { _req: Record<string, unknown> };
      const next = { handle: () => of({}) };

      await interceptor.intercept(ctx, next).toPromise();

      expect(obs.createTraceContext).toHaveBeenCalledWith('webhook', 'corr-456');
    });
  });

  describe('HTTP request logging', () => {
    it('logs request received before handler resolves', async () => {
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => of({ id: 1 }) };

      await interceptor.intercept(ctx, next).toPromise();

      expect(obs.logger.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook HTTP request received',
        expect.objectContaining({
          method: 'POST',
          source: 'webhook',
        }),
      );
    });

    it('records HTTP outcome on success', async () => {
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => of({ received: true, processed: true }) };

      await interceptor.intercept(ctx, next).toPromise();

      expect(obs.logHttpRequest).toHaveBeenCalled();
      const call = (obs.logHttpRequest as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('POST');
      expect(call[1]).toBe('/webhooks/stripe');
      expect(call[2]).toBe(200);
      expect(typeof call[3]).toBe('number');
      expect(typeof call[4]).toBe('string');
      expect(call[4].length).toBeGreaterThan(0);
    });

    it('records HTTP outcome on error with status code', async () => {
      const err = new BadRequestException('bad request') as any;
      err.status = 400;
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => throwError(() => err) };

      try {
        await interceptor.intercept(ctx, next).toPromise();
      } catch {
        // expected
      }

      expect(obs.logHttpRequest).toHaveBeenCalled();
      const call = (obs.logHttpRequest as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('POST');
      expect(call[1]).toBe('/webhooks/stripe');
      expect(call[2]).toBe(400);
      expect(typeof call[3]).toBe('number');
      expect(typeof call[4]).toBe('string');
      expect(call[4].length).toBeGreaterThan(0);
    });

    it('re-throws the original error after recording', async () => {
      const err = new BadRequestException('bad');
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => throwError(() => err) };

      try {
        await interceptor.intercept(ctx, next).toPromise();
        fail('should have thrown');
      } catch (e) {
        expect(e).toBe(err);
      }
    });

    it('propagates response value unchanged on success', async () => {
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => of({ key: 'value' }) };

      const result = await interceptor.intercept(ctx, next).toPromise();

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('path classification', () => {
    it('classifies /webhooks/stripe as stripe', async () => {
      const ctx = makeContext('/webhooks/stripe');
      const next = { handle: () => of({}) };

      await interceptor.intercept(ctx, next).toPromise();

      expect(obs.logHttpRequest).toHaveBeenCalled();
      const call = (obs.logHttpRequest as jest.Mock).mock.calls[0];
      expect(call[0]).toBe('POST');
      expect(call[1]).toBe('/webhooks/stripe');
      expect(call[2]).toBe(200);
      expect(typeof call[3]).toBe('number');
      expect(typeof call[4]).toBe('string');
      expect(call[4].length).toBeGreaterThan(0);
    });
  });
});
