import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { Upload } from './entities/upload.entity';
import { SortOrder } from '../../common/dto/pagination.dto';
import { UploadsPaginationDto, UPLOADS_SORT_WHITELIST } from './dto/uploads-pagination.dto';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

export interface StoredFile {
  id?: number;
  /** Storage key (S3 key or relative path for local). */
  key: string;
  /** Pre-signed URL valid for `signedUrlTtlSeconds` seconds. */
  url: string;
}

interface DownloadTokenPayload {
  typ: 'upload-download';
  key: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    private readonly auditTrail: AuditTrailService,
  ) {
    const bucket = this.config.get<string>('upload.s3Bucket');
    if (bucket) {
      const region = this.config.get<string>('upload.s3Region') ?? 'us-east-1';
      const endpoint = this.config.get<string>('upload.s3Endpoint') || undefined;
      this.s3 = new S3Client({ region, ...(endpoint ? { endpoint } : {}) });
      this.logger.log(`S3 storage enabled – bucket: ${bucket}`);
    } else {
      this.s3 = null;
      this.logger.warn('AWS_S3_BUCKET not set – falling back to local disk storage');
    }
  }

  async store(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId?: number,
  ): Promise<StoredFile> {
    const key = `${Date.now()}-${randomBytes(8).toString('hex')}/${originalName}`;

    // 1. Physical Storage
    if (this.s3) {
      await this.storeS3(buffer, key, mimeType);
    } else {
      await this.storeLocal(buffer, key);
    }

    // 2. Database Record
    const upload = this.uploadRepository.create({
      key,
      originalName,
      mimeType,
      size: buffer.length,
      userId,
    });
    const savedUpload = await this.uploadRepository.save(upload);

    // 3. Audit Trail
    await this.auditTrail.log(AuditAction.UPLOAD_CREATED, {
      userId,
      changes: { key, originalName, mimeType, size: buffer.length },
      reason: 'File upload processed',
    });

    const url = this.s3
      ? await this.getS3SignedUrl(key)
      : this.buildLocalSignedUrl(key);

    return { id: savedUpload.id, key, url };
  }

  /**
   * Get paginated and stably-sorted list of uploads.
   *
   * Stable sort: primary sort on the whitelisted `sortBy` column; secondary
   * sort always on `id ASC` so that equal primary keys have a deterministic
   * order across pages.
   */
  async findAll(paginationDto: UploadsPaginationDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = SortOrder.DESC,
      search,
    } = paginationDto;

    // Validate sortBy against whitelist (guard against runtime misuse)
    const safeSortBy = (UPLOADS_SORT_WHITELIST as readonly string[]).includes(sortBy)
      ? sortBy
      : 'id';

    const qb = this.uploadRepository.createQueryBuilder('upload');

    if (search) {
      qb.where(
        'upload.originalName ILIKE :search OR upload.key ILIKE :search',
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`upload.${safeSortBy}`, sortOrder)
      .addOrderBy('upload.id', 'ASC') // secondary key → stable pagination
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  /**
   * Delete a stored file and its database record.
   */
  async deleteFile(key: string, userId?: number): Promise<void> {
    const upload = await this.uploadRepository.findOne({ where: { key } });

    // 1. Delete from physical storage
    if (this.s3) {
      const bucket = this.config.get<string>('upload.s3Bucket')!;
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } else {
      const baseDir = this.config.get<string>('upload.localUploadDir') ?? './storage/uploads';
      try {
        await unlink(join(baseDir, key));
      } catch (err) {
        this.logger.error(`Failed to delete local file ${key}:`, err);
      }
    }

    // 2. Delete database record
    if (upload) {
      await this.uploadRepository.remove(upload);
    }

    // 3. Audit Trail
    await this.auditTrail.log(AuditAction.UPLOAD_DELETED, {
      userId,
      changes: { key },
      reason: 'File deletion processed',
    });
  }

  /**
   * Generate a fresh signed download URL for a previously stored key.
   * Useful when the original URL has expired.
   */
  async signedUrl(key: string): Promise<string> {
    return this.s3 ? this.getS3SignedUrl(key) : this.buildLocalSignedUrl(key);
  }

  /**
   * Resolve a local download token and return the raw file buffer.
   * Only relevant when S3 is not configured.
   */
  async resolveLocalDownload(token: string): Promise<{ buffer: Buffer; key: string }> {
    const payload = await this.jwt.verifyAsync<DownloadTokenPayload>(token);
    if (payload.typ !== 'upload-download') {
      throw new Error('Invalid token type');
    }
    const baseDir =
      this.config.get<string>('upload.localUploadDir') ?? './storage/uploads';
    const filePath = join(baseDir, payload.key);
    const buffer = await readFile(filePath);
    return { buffer, key: payload.key };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async storeS3(buffer: Buffer, key: string, mimeType: string): Promise<void> {
    const bucket = this.config.get<string>('upload.s3Bucket')!;
    await this.s3!.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
  }

  private async getS3SignedUrl(key: string): Promise<string> {
    const bucket = this.config.get<string>('upload.s3Bucket')!;
    const ttl = this.config.get<number>('upload.signedUrlTtlSeconds') ?? 3600;
    return getSignedUrl(
      this.s3!,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttl },
    );
  }

  private async storeLocal(buffer: Buffer, key: string): Promise<void> {
    const baseDir =
      this.config.get<string>('upload.localUploadDir') ?? './storage/uploads';
    const dir = join(baseDir, key.split('/')[0]);
    await mkdir(dir, { recursive: true });
    await writeFile(join(baseDir, key), buffer);
  }

  private buildLocalSignedUrl(key: string): string {
    const ttl = this.config.get<number>('upload.signedUrlTtlSeconds') ?? 3600;
    const token = this.jwt.sign(
      { typ: 'upload-download', key } satisfies DownloadTokenPayload,
      { expiresIn: ttl },
    );
    return `/uploads/download?token=${token}`;
  }
}
