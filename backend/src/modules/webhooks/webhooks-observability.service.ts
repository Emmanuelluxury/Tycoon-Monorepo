import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { LoggerService } from '../../common/logger/logger.service';
import { randomBytes } from 'crypto';

const SIGNATURE_VERIFICATION_BUCKETS = [
  0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
];

const WEBHOOK_PROCESSING_BUCKETS = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

const HTTP_DURATION_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
];

export enum WebhookEventType {
  RECEIVED = 'received',
  SIGNATURE_VERIFIED = 'signature_verified',
  SIGNATURE_FAILED = 'signature_failed',
  IDEMPOTENCY_HIT = 'idempotency_hit',
  PROCESSED = 'processed',
  PROCESSING_FAILED = 'processing_failed',
}

export interface WebhookLogContext {
  webhookId?: string;
  eventType?: string;
  source?: string;
  statusCode?: number;
  error?: string;
  timestamp?: string;
  signatureValid?: boolean;
  idempotent?: boolean;
  processingTimeMs?: number;
  traceId?: string;
}

export interface TraceContext {
  trace_id: string;
  source: string;
  ts: string;
}

export interface TimerHandle {
  end: () => void;
}

@Injectable()
export class WebhooksObservabilityService {
  readonly registry = new Registry();

  private readonly webhookEventsTotal: Counter;
  private readonly signatureVerificationDuration: Histogram;
  private readonly signatureVerificationTotal: Counter;
  private readonly webhookProcessingDuration: Histogram;
  private readonly idempotencyHitsTotal: Counter;
  private readonly httpRequestsTotal: Counter;
  private readonly webhookErrorsTotal: Counter;
  private readonly httpRequestDuration: Histogram;

  constructor(private readonly logger: LoggerService) {
    this.webhookEventsTotal = new Counter({
      name: 'tycoon_webhook_events_total',
      help: 'Total webhook events received by source and event type',
      labelNames: ['source', 'event_type', 'status'],
      registers: [this.registry],
    });

    this.signatureVerificationDuration = new Histogram({
      name: 'tycoon_webhook_signature_verification_duration_seconds',
      help: 'Time spent verifying webhook signatures',
      labelNames: ['source', 'result'],
      buckets: SIGNATURE_VERIFICATION_BUCKETS,
      registers: [this.registry],
    });

    this.signatureVerificationTotal = new Counter({
      name: 'tycoon_webhook_signature_verification_total',
      help: 'Total signature verification attempts by result',
      labelNames: ['source', 'result', 'failure_reason'],
      registers: [this.registry],
    });

    this.webhookProcessingDuration = new Histogram({
      name: 'tycoon_webhook_processing_duration_seconds',
      help: 'Time spent processing webhooks end-to-end',
      labelNames: ['source', 'event_type'],
      buckets: WEBHOOK_PROCESSING_BUCKETS,
      registers: [this.registry],
    });

    this.idempotencyHitsTotal = new Counter({
      name: 'tycoon_webhook_idempotency_hits_total',
      help: 'Number of duplicate webhooks detected via idempotency',
      labelNames: ['source', 'event_type'],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'tycoon_webhook_http_requests_total',
      help: 'Total webhook HTTP requests by method, path, and status',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.webhookErrorsTotal = new Counter({
      name: 'tycoon_webhook_errors_total',
      help: 'Total webhook processing errors by error type',
      labelNames: ['source', 'event_type', 'error_type'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'tycoon_webhook_http_request_duration_seconds',
      help: 'Duration of webhook HTTP requests',
      labelNames: ['method', 'path'],
      buckets: HTTP_DURATION_BUCKETS,
      registers: [this.registry],
    });
  }

  createTraceContext(source: string, traceId?: string): TraceContext {
    return {
      trace_id: traceId || this.generateTraceId(),
      source,
      ts: new Date().toISOString(),
    };
  }

  startTimer(source: string, eventType?: string): TimerHandle {
    const start = process.hrtime.bigint();
    const labels = {
      source,
      event_type: eventType || 'unknown',
    };
    return {
      end: () => {
        const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
        this.webhookProcessingDuration.observe(labels, durationSeconds);
      },
    };
  }

  logWebhookReceived(context: WebhookLogContext, traceId?: string): void {
    const sanitizedContext = this.sanitizeContext(context);
    const resolvedTraceId = traceId || context.traceId;

    this.logger.log(
      `Webhook received: ${context.source || 'unknown'} - ${context.eventType || 'unknown'}`,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('info', 'Webhook received', {
      ...sanitizedContext,
      event: WebhookEventType.RECEIVED,
      ...(resolvedTraceId ? { trace_id: resolvedTraceId } : {}),
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'received',
    });
  }

  logSignatureVerification(
    source: string,
    success: boolean,
    durationMs: number,
    failureReason?: string,
    traceId?: string,
  ): void {
    const result = success ? 'valid' : 'invalid';
    const durationSeconds = durationMs / 1000;

    if (success) {
      this.logger.debug(
        `Signature verified for ${source} in ${durationMs}ms`,
        'WebhooksObservability',
      );
    } else {
      this.logger.warn(
        `Signature verification failed for ${source}: ${failureReason || 'unknown reason'}`,
        'WebhooksObservability',
      );
    }

    this.signatureVerificationDuration.observe(
      { source, result },
      durationSeconds,
    );

    this.signatureVerificationTotal.inc({
      source,
      result,
      failure_reason: failureReason || 'none',
    });

    this.logger.logWithMeta(
      success ? 'debug' : 'warn',
      'Signature verification',
      {
        event: success
          ? WebhookEventType.SIGNATURE_VERIFIED
          : WebhookEventType.SIGNATURE_FAILED,
        source,
        result,
        durationMs,
        failureReason: failureReason || undefined,
        ...(traceId ? { trace_id: traceId } : {}),
      },
    );
  }

  logIdempotencyHit(context: WebhookLogContext, traceId?: string): void {
    const sanitizedContext = this.sanitizeContext(context);
    const resolvedTraceId = traceId || context.traceId;

    this.logger.log(
      `Duplicate webhook detected: ${context.webhookId} (${context.source})`,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('info', 'Idempotency hit', {
      ...sanitizedContext,
      event: WebhookEventType.IDEMPOTENCY_HIT,
      ...(resolvedTraceId ? { trace_id: resolvedTraceId } : {}),
    });

    this.idempotencyHitsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'idempotent',
    });
  }

  logWebhookProcessed(
    context: WebhookLogContext,
    durationMs: number,
    traceId?: string,
  ): void {
    const sanitizedContext = this.sanitizeContext(context);
    const resolvedTraceId = traceId || context.traceId;

    this.logger.log(
      `Webhook processed: ${context.webhookId} (${context.source}) in ${durationMs}ms`,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('info', 'Webhook processed', {
      ...sanitizedContext,
      event: WebhookEventType.PROCESSED,
      processingTimeMs: durationMs,
      ...(resolvedTraceId ? { trace_id: resolvedTraceId } : {}),
    });

    this.webhookProcessingDuration.observe(
      {
        source: context.source || 'unknown',
        event_type: context.eventType || 'unknown',
      },
      durationMs / 1000,
    );

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'processed',
    });
  }

  logWebhookProcessingFailed(
    context: WebhookLogContext,
    error: Error,
    durationMs: number,
    traceId?: string,
  ): void {
    const sanitizedContext = this.sanitizeContext(context);
    const resolvedTraceId = traceId || context.traceId;
    const errorType = error.name || 'UnknownError';

    this.logger.error(
      `Webhook processing failed: ${context.webhookId} (${context.source}) - ${error.message}`,
      error.stack,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('error', 'Webhook processing failed', {
      ...sanitizedContext,
      event: WebhookEventType.PROCESSING_FAILED,
      error: error.message,
      errorStack: error.stack,
      errorType,
      processingTimeMs: durationMs,
      ...(resolvedTraceId ? { trace_id: resolvedTraceId } : {}),
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'failed',
    });

    this.webhookErrorsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      error_type: errorType,
    });
  }

  logHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    traceId?: string,
  ): void {
    const pathLabel = this.classifyPath(path);
    const durationSeconds = durationMs / 1000;

    this.httpRequestsTotal.inc({
      method,
      path: pathLabel,
      status: statusCode.toString(),
    });

    this.httpRequestDuration.observe(
      { method, path: pathLabel },
      durationSeconds,
    );

    this.logger.logWithMeta('info', 'Webhook HTTP request', {
      method,
      path: pathLabel,
      statusCode,
      durationMs,
      ...(traceId ? { trace_id: traceId } : {}),
    });
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  private classifyPath(path: string): string {
    if (path.startsWith('/webhooks/stripe')) return 'stripe';
    if (path.startsWith('/webhooks/')) return 'webhook';
    return 'other';
  }

  private generateTraceId(): string {
    return randomBytes(8).toString('hex');
  }

  private sanitizeContext(context: WebhookLogContext): WebhookLogContext {
    const sanitized = { ...context };
    delete (sanitized as any).signature;
    delete (sanitized as any).secret;
    delete (sanitized as any).token;
    delete (sanitized as any).authorization;
    return sanitized;
  }
}
