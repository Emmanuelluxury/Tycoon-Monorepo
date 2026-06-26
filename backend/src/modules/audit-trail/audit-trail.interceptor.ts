import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditTrailService } from './audit-trail.service';
import { AuditAction } from './entities/audit-trail.entity';
import { Reflector } from '@nestjs/core';

export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * Extracts a compact, non-sensitive summary from the handler's return value
 * to populate the `changes` field in the audit trail record.
 *
 * Only scalar / status fields are captured; raw payloads are never stored to
 * keep the audit log small and free of sensitive data.
 */
function buildResultSummary(value: unknown): Record<string, unknown> | undefined {
    if (value === null || value === undefined) return undefined;

    // For string payloads (e.g. Prometheus metrics text), record byte length only.
    if (typeof value === 'string') {
        return { byteLength: value.length };
    }

    if (typeof value !== 'object') return undefined;

    const v = value as Record<string, unknown>;
    const summary: Record<string, unknown> = {};

    // Capture health / status fields common across health check responses.
    if (typeof v['status'] === 'string') summary['status'] = v['status'];
    if (typeof v['redis'] === 'string') summary['redis'] = v['redis'];
    if (typeof v['database'] === 'string') summary['database'] = v['database'];

    return Object.keys(summary).length > 0 ? summary : undefined;
}

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditTrailInterceptor.name);

    constructor(
        private readonly auditTrailService: AuditTrailService,
        private readonly reflector: Reflector,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const action = this.reflector.get<AuditAction>(
            AUDIT_ACTION_KEY,
            context.getHandler(),
        );

        if (!action) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest<{
            user?: { id?: number; email?: string };
            ip?: string;
            headers: Record<string, string | string[] | undefined>;
        }>();
        const user = request.user;
        const startNs = process.hrtime.bigint();

        return next.handle().pipe(
            tap(async (result: unknown) => {
                const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
                const resultSummary = buildResultSummary(result);

                const changes: Record<string, unknown> = {
                    durationMs: Math.round(durationMs),
                    ...(resultSummary && { result: resultSummary }),
                };

                try {
                    await this.auditTrailService.log(action, {
                        userId: user?.id,
                        userEmail: user?.email,
                        performedBy: user?.id,
                        ipAddress: request.ip,
                        userAgent: request.headers['user-agent'] as string | undefined,
                        changes,
                    });
                } catch (error) {
                    this.logger.error(`Failed to log audit trail for ${action}:`, error);
                }
            }),
        );
    }
}
