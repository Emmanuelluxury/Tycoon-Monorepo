import { Test, TestingModule } from '@nestjs/testing';
import {
  WebhooksObservabilityService,
  WebhookEventType,
} from './webhooks-observability.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('WebhooksObservabilityService', () => {
  let service: WebhooksObservabilityService;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      logWithMeta: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksObservabilityService,
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<WebhooksObservabilityService>(
      WebhooksObservabilityService,
    );
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTraceContext', () => {
    it('should generate trace_id when none provided', () => {
      const ctx = service.createTraceContext('stripe');
      expect(ctx).toHaveProperty('trace_id');
      expect(ctx.trace_id).toBeDefined();
      expect(ctx.trace_id.length).toBeGreaterThan(0);
      expect(ctx.source).toBe('stripe');
      expect(ctx.ts).toBeDefined();
    });

    it('should use provided traceId', () => {
      const ctx = service.createTraceContext('stripe', 'my-trace-123');
      expect(ctx.trace_id).toBe('my-trace-123');
      expect(ctx.source).toBe('stripe');
    });
  });

  describe('startTimer', () => {
    it('should return an end function', () => {
      const timer = service.startTimer('stripe', 'payment.succeeded');
      expect(typeof timer.end).toBe('function');
    });

    it('end function is callable without throwing', () => {
      const timer = service.startTimer('stripe', 'payment.succeeded');
      expect(() => timer.end()).not.toThrow();
    });
  });

  describe('logHttpRequest', () => {
    it('should call logger with HTTP request details', () => {
      service.logHttpRequest('POST', '/webhooks/stripe', 200, 45);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook HTTP request',
        expect.objectContaining({
          method: 'POST',
          path: 'stripe',
          statusCode: 200,
          durationMs: 45,
        }),
      );
    });

    it('should classify /webhooks/stripe path as stripe', () => {
      service.logHttpRequest('POST', '/webhooks/stripe', 200, 45);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook HTTP request',
        expect.objectContaining({
          path: 'stripe',
        }),
      );
    });

    it('should classify unknown paths as other', () => {
      service.logHttpRequest('GET', '/unknown', 404, 10);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook HTTP request',
        expect.objectContaining({
          path: 'other',
        }),
      );
    });
  });

  describe('logWebhookReceived', () => {
    it('should log webhook received event', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookReceived(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook received: stripe - payment.succeeded',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook received',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.RECEIVED,
        }),
      );
    });

    it('should include traceId when provided', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookReceived(context, 'trace-abc');

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook received',
        expect.objectContaining({
          trace_id: 'trace-abc',
        }),
      );
    });

    it('should handle missing source and eventType', () => {
      const context = {
        webhookId: 'wh_123',
      };

      service.logWebhookReceived(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook received: unknown - unknown',
        'WebhooksObservability',
      );
    });

    it('should sanitize sensitive fields from context', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        signature: 'secret_signature',
        secret: 'secret_key',
      } as any;

      service.logWebhookReceived(context);

      const loggedContext = loggerService.logWithMeta.mock.calls[0][2];
      expect(loggedContext).not.toHaveProperty('signature');
      expect(loggedContext).not.toHaveProperty('secret');
    });
  });

  describe('logSignatureVerification', () => {
    it('should log successful signature verification', () => {
      service.logSignatureVerification('stripe', true, 5);

      expect(loggerService.debug).toHaveBeenCalledWith(
        'Signature verified for stripe in 5ms',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Signature verification',
        expect.objectContaining({
          event: WebhookEventType.SIGNATURE_VERIFIED,
          source: 'stripe',
          result: 'valid',
          durationMs: 5,
        }),
      );
    });

    it('should log failed signature verification with reason', () => {
      service.logSignatureVerification('stripe', false, 3, 'signature_mismatch');

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Signature verification failed for stripe: signature_mismatch',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'warn',
        'Signature verification',
        expect.objectContaining({
          event: WebhookEventType.SIGNATURE_FAILED,
          source: 'stripe',
          result: 'invalid',
          durationMs: 3,
          failureReason: 'signature_mismatch',
        }),
      );
    });

    it('should include traceId when provided', () => {
      service.logSignatureVerification('stripe', true, 5, undefined, 'trace-xyz');

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Signature verification',
        expect.objectContaining({
          trace_id: 'trace-xyz',
        }),
      );
    });

    it('should record metrics for signature verification', () => {
      service.logSignatureVerification('stripe', true, 5);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Signature verification',
        expect.objectContaining({
          event: WebhookEventType.SIGNATURE_VERIFIED,
          source: 'stripe',
          result: 'valid',
          durationMs: 5,
        }),
      );
    });
  });

  describe('logIdempotencyHit', () => {
    it('should log idempotency hit', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logIdempotencyHit(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Duplicate webhook detected: wh_123 (stripe)',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Idempotency hit',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.IDEMPOTENCY_HIT,
        }),
      );
    });

    it('should include traceId when provided', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logIdempotencyHit(context, 'trace-456');

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Idempotency hit',
        expect.objectContaining({
          trace_id: 'trace-456',
        }),
      );
    });
  });

  describe('logWebhookProcessed', () => {
    it('should log successful webhook processing', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookProcessed(context, 150);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook processed: wh_123 (stripe) in 150ms',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook processed',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.PROCESSED,
          processingTimeMs: 150,
        }),
      );
    });

    it('should include traceId when provided', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookProcessed(context, 150, 'trace-789');

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook processed',
        expect.objectContaining({
          trace_id: 'trace-789',
        }),
      );
    });

    it('should record processing duration metrics', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookProcessed(context, 150);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook processed',
        expect.objectContaining({
          processingTimeMs: 150,
        }),
      );
    });
  });

  describe('logWebhookProcessingFailed', () => {
    it('should log webhook processing failure', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };
      const error = new Error('Database connection failed');

      service.logWebhookProcessingFailed(context, error, 200);

      expect(loggerService.error).toHaveBeenCalledWith(
        'Webhook processing failed: wh_123 (stripe) - Database connection failed',
        error.stack,
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'error',
        'Webhook processing failed',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.PROCESSING_FAILED,
          error: 'Database connection failed',
          errorType: 'Error',
          processingTimeMs: 200,
        }),
      );
    });

    it('should include traceId when provided', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };
      const error = new Error('Database connection failed');

      service.logWebhookProcessingFailed(context, error, 200, 'trace-fail');

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'error',
        'Webhook processing failed',
        expect.objectContaining({
          trace_id: 'trace-fail',
        }),
      );
    });

    it('should record error metrics by error type', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };
      const error = new Error('Database connection failed');

      service.logWebhookProcessingFailed(context, error, 200);

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'error',
        'Webhook processing failed',
        expect.objectContaining({
          errorType: 'Error',
        }),
      );
    });
  });

  describe('getMetricsText', () => {
    it('should return a string', async () => {
      const metricsText = await service.getMetricsText();
      expect(typeof metricsText).toBe('string');
    });
  });

  describe('metrics counters', () => {
    it('should log webhook events', () => {
      service.logWebhookReceived({
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook received: stripe - payment.succeeded',
        'WebhooksObservability',
      );
    });

    it('should log idempotency hits', () => {
      service.logIdempotencyHit({
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });

      expect(loggerService.log).toHaveBeenCalledWith(
        'Duplicate webhook detected: wh_123 (stripe)',
        'WebhooksObservability',
      );
    });
  });

  describe('security - no secrets in logs', () => {
    it('should not log signature values', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        signature: 'secret_signature_value',
      } as any;

      service.logWebhookReceived(context);

      const allLogCalls = [
        ...loggerService.log.mock.calls,
        ...loggerService.logWithMeta.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const callString = JSON.stringify(call);
        expect(callString).not.toContain('secret_signature_value');
      });
    });

    it('should not log secret values', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        secret: 'webhook_secret_key',
        token: 'auth_token_value',
      } as any;

      service.logWebhookProcessed(context, 100);

      const allLogCalls = [
        ...loggerService.log.mock.calls,
        ...loggerService.logWithMeta.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const callString = JSON.stringify(call);
        expect(callString).not.toContain('webhook_secret_key');
        expect(callString).not.toContain('auth_token_value');
      });
    });
  });
});
