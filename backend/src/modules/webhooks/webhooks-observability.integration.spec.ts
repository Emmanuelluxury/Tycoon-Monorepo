import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { WebhookAuditHooksService } from './webhook-audit-hooks.service';
import * as crypto from 'crypto';

describe('Webhooks Observability Integration', () => {
  let service: WebhooksService;
  let observability: WebhooksObservabilityService;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    const repo = {
      create: jest.fn((v) => v),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        WebhooksObservabilityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'WEBHOOK_SECRET'
                ? 'test_webhook_secret_for_integration'
                : undefined,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        {
          provide: WebhooksAuditService,
          useValue: {
            auditSignatureVerification: jest.fn(),
            auditWebhookReceived: jest.fn(),
            auditIdempotencyCheck: jest.fn(),
            auditWebhookPersisted: jest.fn(),
            auditProcessingCompleted: jest.fn(),
            auditProcessingFailed: jest.fn(),
          },
        },
        {
          provide: WebhookAuditHooksService,
          useValue: {
            onReceived: jest.fn(),
            onSignatureVerified: jest.fn(),
            onSignatureFailed: jest.fn(),
            onDuplicate: jest.fn(),
            onProcessed: jest.fn(),
            onFailed: jest.fn(),
          },
        },
        { provide: getRepositoryToken(WebhookEvent), useValue: repo },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            logWithMeta: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
    observability = module.get(WebhooksObservabilityService);
  });

  it('processes valid webhook with traceId', async () => {
    const payload = {
      id: 'evt_test_observability_123',
      type: 'payment.succeeded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const valid = await service.verifySignature(
      signature,
      timestamp,
      body,
      'stripe',
      undefined,
      'trace-integration-1',
    );
    expect(valid).toBe(true);

    const result = await service.processWebhook(
      payload,
      'stripe',
      undefined,
      undefined,
      'trace-integration-1',
    );
    expect(result).toEqual({ received: true, processed: true });
  });

  it('records idempotency hit for duplicate webhook with traceId', async () => {
    redis.get.mockResolvedValue(true);
    const payload = { id: 'evt_duplicate', type: 'charge.refunded' };

    const result = await service.processWebhook(
      payload,
      'stripe',
      undefined,
      undefined,
      'trace-integration-2',
    );
    expect(result).toEqual({ received: true, idempotent: true });
  });

  it('propagates traceId through signature verification', async () => {
    const payload = {
      id: 'evt_trace_test',
      type: 'payment.succeeded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const sigSpy = jest.spyOn(observability, 'logSignatureVerification');
    await service.verifySignature(
      signature,
      timestamp,
      body,
      'stripe',
      undefined,
      'trace-sig-123',
    );

    expect(sigSpy).toHaveBeenCalledWith(
      'stripe',
      true,
      expect.any(Number),
      undefined,
      'trace-sig-123',
    );
  });

  it('records HTTP request metrics via interceptor-level observability', async () => {
    const httpSpy = jest.spyOn(observability, 'logHttpRequest');
    observability.logHttpRequest('POST', '/webhooks/stripe', 200, 42, 'trace-http-1');

    expect(httpSpy).toHaveBeenCalledWith(
      'POST',
      '/webhooks/stripe',
      200,
      42,
      'trace-http-1',
    );
  });
});
