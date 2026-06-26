import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetSignedUrlDto, DownloadFileDto, UploadMetadataDto } from '../dto/upload-file.dto';
import {
  UploadsPaginationDto,
  UPLOADS_SORT_WHITELIST,
} from '../dto/uploads-pagination.dto';
import { SortOrder } from '../../../../common/dto/pagination.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function errors(cls: any, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain);
  return validate(instance);
}

// ---------------------------------------------------------------------------
// GetSignedUrlDto
// ---------------------------------------------------------------------------
describe('GetSignedUrlDto', () => {
  it('accepts a valid key', async () => {
    expect(await errors(GetSignedUrlDto, { key: 'avatars/user-1/photo.jpg' })).toHaveLength(0);
  });

  it('rejects empty string', async () => {
    const e = await errors(GetSignedUrlDto, { key: '' });
    expect(e.some((v) => v.property === 'key')).toBe(true);
  });

  it('rejects missing key', async () => {
    const e = await errors(GetSignedUrlDto, {});
    expect(e.some((v) => v.property === 'key')).toBe(true);
  });

  it('rejects key longer than 500 chars', async () => {
    const e = await errors(GetSignedUrlDto, { key: 'a'.repeat(501) });
    expect(e.some((v) => v.property === 'key')).toBe(true);
  });

  it('rejects keys with disallowed characters (e.g. spaces)', async () => {
    const e = await errors(GetSignedUrlDto, { key: 'avatars/user 1/photo.jpg' });
    expect(e.some((v) => v.property === 'key')).toBe(true);
  });

  it('accepts keys at exactly 500 chars with valid characters', async () => {
    const key = 'a/'.repeat(249) + 'a';  // 499 + 1 = 500 chars
    expect(await errors(GetSignedUrlDto, { key })).toHaveLength(0);
  });

  it('rejects non-string key', async () => {
    const e = await errors(GetSignedUrlDto, { key: 12345 as any });
    expect(e.some((v) => v.property === 'key')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DownloadFileDto
// ---------------------------------------------------------------------------
describe('DownloadFileDto', () => {
  it('accepts a valid token', async () => {
    const e = await errors(DownloadFileDto, {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
    });
    expect(e).toHaveLength(0);
  });

  it('rejects missing token', async () => {
    const e = await errors(DownloadFileDto, {});
    expect(e.some((v) => v.property === 'token')).toBe(true);
  });

  it('rejects empty token string', async () => {
    const e = await errors(DownloadFileDto, { token: '' });
    expect(e.some((v) => v.property === 'token')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UploadMetadataDto (optional fields)
// ---------------------------------------------------------------------------
describe('UploadMetadataDto', () => {
  it('accepts empty object (all fields optional)', async () => {
    expect(await errors(UploadMetadataDto, {})).toHaveLength(0);
  });

  it('accepts valid description', async () => {
    expect(await errors(UploadMetadataDto, { description: 'My avatar photo' })).toHaveLength(0);
  });

  it('rejects description longer than 500 chars', async () => {
    const e = await errors(UploadMetadataDto, { description: 'x'.repeat(501) });
    expect(e.some((v) => v.property === 'description')).toBe(true);
  });

  it('accepts valid tags', async () => {
    expect(await errors(UploadMetadataDto, { tags: 'avatar,profile' })).toHaveLength(0);
  });

  it('rejects tags with disallowed characters', async () => {
    const e = await errors(UploadMetadataDto, { tags: 'avatar profile' }); // space not allowed
    expect(e.some((v) => v.property === 'tags')).toBe(true);
  });

  it('rejects tags longer than 200 chars', async () => {
    const e = await errors(UploadMetadataDto, { tags: 'a,'.repeat(101) });
    expect(e.some((v) => v.property === 'tags')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UploadsPaginationDto
// ---------------------------------------------------------------------------
describe('UploadsPaginationDto', () => {
  it('accepts defaults (empty object)', async () => {
    expect(await errors(UploadsPaginationDto, {})).toHaveLength(0);
  });

  it('defaults sortBy to "id"', () => {
    const dto = plainToInstance(UploadsPaginationDto, {});
    expect(dto.sortBy).toBe('id');
  });

  it('defaults sortOrder to DESC', () => {
    const dto = plainToInstance(UploadsPaginationDto, {});
    expect(dto.sortOrder).toBe(SortOrder.DESC);
  });

  it('accepts all whitelisted sortBy values', async () => {
    for (const field of UPLOADS_SORT_WHITELIST) {
      const e = await errors(UploadsPaginationDto, { sortBy: field });
      expect(e).toHaveLength(0);
    }
  });

  it('rejects sortBy not in whitelist', async () => {
    const e = await errors(UploadsPaginationDto, { sortBy: 'userId' }); // not in whitelist
    expect(e.some((v) => v.property === 'sortBy')).toBe(true);
  });

  it('rejects SQL injection attempt via sortBy', async () => {
    const e = await errors(UploadsPaginationDto, { sortBy: 'id; DROP TABLE uploads; --' });
    expect(e.some((v) => v.property === 'sortBy')).toBe(true);
  });

  it('accepts valid page + limit combination', async () => {
    const e = await errors(UploadsPaginationDto, { page: 2, limit: 25 });
    expect(e).toHaveLength(0);
  });

  it('rejects page < 1', async () => {
    const e = await errors(UploadsPaginationDto, { page: 0 });
    expect(e.some((v) => v.property === 'page')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const e = await errors(UploadsPaginationDto, { limit: 101 });
    expect(e.some((v) => v.property === 'limit')).toBe(true);
  });

  it('accepts search term', async () => {
    const e = await errors(UploadsPaginationDto, { search: 'avatar' });
    expect(e).toHaveLength(0);
  });

  it('accepts valid sortOrder values', async () => {
    for (const order of Object.values(SortOrder)) {
      const e = await errors(UploadsPaginationDto, { sortOrder: order });
      expect(e).toHaveLength(0);
    }
  });

  it('rejects invalid sortOrder', async () => {
    const e = await errors(UploadsPaginationDto, { sortOrder: 'RANDOM' });
    expect(e.some((v) => v.property === 'sortOrder')).toBe(true);
  });
});
