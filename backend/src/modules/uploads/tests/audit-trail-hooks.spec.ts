/**
 * Audit trail hooks – uploads controller
 *
 * Verifies that:
 *  1. AuditTrailInterceptor is applied at the class level.
 *  2. @AuditLog(UPLOAD_CREATED) metadata is set on the mutating endpoints.
 *  3. AuditTrailService.log is called with the correct action after a
 *     successful upload.
 *  4. Audit log failures do NOT propagate (fire-and-forget).
 *  5. GET (read-only) endpoints do NOT trigger an audit log entry.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { UploadsController } from '../uploads.controller';
import { UploadsService } from '../uploads.service';
import { VirusScanService } from '../virus-scan.service';
import { MulterExceptionFilter } from '../multer-exception.filter';
import { UploadsObservabilityService } from '../uploads-observability.service';
import { UploadsObservabilityInterceptor } from '../uploads-observability.interceptor';
import { UploadsErrorMapperService } from '../uploads-error-mapper.service';
import { AuditTrailInterceptor, AUDIT_ACTION_KEY } from '../../audit-trail/audit-trail.interceptor';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import { AuditAction } from '../../audit-trail/entities/audit-trail.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Minimal JPEG magic bytes
// ---------------------------------------------------------------------------
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------
const mockUploadsService = {
  store: jest.fn().mockResolvedValue({ key: 'test-key/avatar.jpg', url: '/signed?token=tok' }),
  signedUrl: jest.fn(),
  resolveLocalDownload: jest.fn(),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: { totalItems: 0, currentPage: 1, totalPages: 0, itemCount: 0, itemsPerPage: 10 } }),
};

const mockVirusScan = { scan: jest.fn().mockResolvedValue(undefined) };

const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };

const mockObservability = {
  recordUploadOutcome: jest.fn(),
  recordMulterError: jest.fn(),
  recordVirusScanOutcome: jest.fn(),
  createTraceContext: jest.fn().mockReturnValue({ trace_id: 't', route: 'avatar', ts: '' }),
};

const mockAuditTrailService = { log: jest.fn().mockResolvedValue(undefined) };

const allowAll = { canActivate: jest.fn().mockReturnValue(true) };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('UploadsController – audit trail hooks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: VirusScanService, useValue: mockVirusScan },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UploadsObservabilityService, useValue: mockObservability },
        { provide: UploadsErrorMapperService, useValue: { mapMulterError: jest.fn() } },
        { provide: AuditTrailService, useValue: mockAuditTrailService },
        AuditTrailInterceptor,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAll)
      .overrideGuard(AdminGuard)
      .useValue(allowAll)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new MulterExceptionFilter());
    await app.init();
  });

  afterAll(() => app.close());
  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Metadata inspection – audit action decorators
  // -------------------------------------------------------------------------
  describe('@AuditLog metadata', () => {
    let reflector: Reflector;

    beforeAll(() => {
      reflector = app.get(Reflector);
    });

    it('uploadAvatar has UPLOAD_CREATED metadata', () => {
      const ctrl = app.get(UploadsController);
      const action = Reflect.getMetadata(AUDIT_ACTION_KEY, ctrl.uploadAvatar);
      expect(action).toBe(AuditAction.UPLOAD_CREATED);
    });

    it('uploadAdminAsset has UPLOAD_CREATED metadata', () => {
      const ctrl = app.get(UploadsController);
      const action = Reflect.getMetadata(AUDIT_ACTION_KEY, ctrl.uploadAdminAsset);
      expect(action).toBe(AuditAction.UPLOAD_CREATED);
    });

    it('listUploads has NO audit metadata (read-only)', () => {
      const ctrl = app.get(UploadsController);
      const action = Reflect.getMetadata(AUDIT_ACTION_KEY, ctrl.listUploads);
      expect(action).toBeUndefined();
    });

    it('getSignedUrl has NO audit metadata (read-only)', () => {
      const ctrl = app.get(UploadsController);
      const action = Reflect.getMetadata(AUDIT_ACTION_KEY, ctrl.getSignedUrl);
      expect(action).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // HTTP – audit log is triggered on successful avatar upload
  // -------------------------------------------------------------------------
  describe('POST /uploads/avatar', () => {
    it('calls AuditTrailService.log with UPLOAD_CREATED on success', async () => {
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', JPEG_MAGIC, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

      // Interceptor taps on success; service.log called at least once
      expect(mockAuditTrailService.log).toHaveBeenCalledWith(
        AuditAction.UPLOAD_CREATED,
        expect.objectContaining({
          userId: expect.anything(),
        }),
      );
    });

    it('does NOT call audit log when upload is rejected (oversize)', async () => {
      const oversize = Buffer.alloc(6 * 1024 * 1024, 0);
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', oversize, { filename: 'big.jpg', contentType: 'image/jpeg' });

      expect(mockAuditTrailService.log).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /uploads/admin/assets – also audited
  // -------------------------------------------------------------------------
  describe('POST /uploads/admin/assets', () => {
    it('calls AuditTrailService.log with UPLOAD_CREATED', async () => {
      await request(app.getHttpServer())
        .post('/uploads/admin/assets')
        .attach('file', JPEG_MAGIC, { filename: 'banner.jpg', contentType: 'image/jpeg' });

      expect(mockAuditTrailService.log).toHaveBeenCalledWith(
        AuditAction.UPLOAD_CREATED,
        expect.any(Object),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /uploads – NOT audited (read-only)
  // -------------------------------------------------------------------------
  describe('GET /uploads', () => {
    it('does NOT call AuditTrailService.log for the list endpoint', async () => {
      await request(app.getHttpServer()).get('/uploads');
      expect(mockAuditTrailService.log).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Resilience – audit failure must not surface to client
  // -------------------------------------------------------------------------
  describe('audit failure resilience', () => {
    it('returns 201 even when AuditTrailService.log rejects', async () => {
      mockAuditTrailService.log.mockRejectedValueOnce(new Error('DB unavailable'));

      const res = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .attach('file', JPEG_MAGIC, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
    });
  });
});
