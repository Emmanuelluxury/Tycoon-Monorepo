import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { randomBytes } from 'crypto';
import { WebhooksObservabilityService } from './webhooks-observability.service';

@Injectable()
export class WebhooksObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly obs: WebhooksObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      correlationId?: string;
    }>();
    const res = context.switchToHttp().getResponse<{
      statusCode?: number;
    }>();

    const method = req.method || 'UNKNOWN';
    const path = req.path || req.url || '';

    const traceId = this.extractTraceId(req);
    (req as { webhookTraceId?: string }).webhookTraceId = traceId;

    const traceContext = this.obs.createTraceContext('webhook', traceId);

    this.obs.logger.logWithMeta('info', 'Webhook HTTP request received', {
      method,
      path: this.classifyPath(path),
      trace_id: traceContext.trace_id,
      source: 'webhook',
    });

    const startNs = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs =
            Number(process.hrtime.bigint() - startNs) / 1_000_000;
          const statusCode = res.statusCode || 200;
          this.obs.logHttpRequest(
            method,
            path,
            statusCode,
            Math.round(durationMs),
            traceContext.trace_id,
          );
        },
        error: (err: unknown) => {
          const durationMs =
            Number(process.hrtime.bigint() - startNs) / 1_000_000;
          const statusCode = err instanceof Error && 'status' in err
            ? (err as any).status || 500
            : 500;
          this.obs.logHttpRequest(
            method,
            path,
            statusCode,
            Math.round(durationMs),
            traceContext.trace_id,
          );
        },
      }),
    );
  }

  private extractTraceId(req: {
    headers: Record<string, string | string[] | undefined>;
    correlationId?: string;
  }): string {
    const header = req.headers['x-request-id'];
    if (typeof header === 'string' && header.length > 0 && header.length <= 128) {
      return header;
    }
    if (req.correlationId && typeof req.correlationId === 'string') {
      return req.correlationId;
    }
    return randomBytes(8).toString('hex');
  }

  private classifyPath(path: string): string {
    if (path.startsWith('/webhooks/stripe')) return 'stripe';
    if (path.startsWith('/webhooks/')) return 'webhook';
    return 'other';
  }
}
