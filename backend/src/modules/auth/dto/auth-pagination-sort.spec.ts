/**
 * SW-BE-002: Auth & JWT — pagination and stable sorting
 *
 * Validates that GetRefreshTokensDto:
 *  - Accepts every valid RefreshTokenSortField value.
 *  - Rejects arbitrary column names (SQL-injection / schema-probe defence).
 *  - Defaults sortBy to 'createdAt' when omitted.
 *  - Inherits standard PaginationDto constraints (page, limit, sortOrder).
 *
 * All tests are pure unit tests — no HTTP server, no DB.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetRefreshTokensDto, RefreshTokenSortField } from './get-refresh-tokens.dto';
import { SortOrder } from '../../../common/dto/pagination.dto';

async function getErrors(plain: object): Promise<string[]> {
  const instance = plainToInstance(GetRefreshTokensDto, plain);
  const errors = await validate(instance as object);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// ---------------------------------------------------------------------------
// sortBy allowlist
// ---------------------------------------------------------------------------

describe('GetRefreshTokensDto — sortBy allowlist (SW-BE-002)', () => {
  it('accepts every valid RefreshTokenSortField value', async () => {
    for (const field of Object.values(RefreshTokenSortField)) {
      const errors = await getErrors({ sortBy: field });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an arbitrary column name', async () => {
    const errors = await getErrors({ sortBy: 'password' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a SQL-injection-style value', async () => {
    const errors = await getErrors({ sortBy: "1; DROP TABLE refresh_tokens--" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects "tokenHash" — internal column must not be sortable', async () => {
    const errors = await getErrors({ sortBy: 'tokenHash' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('defaults sortBy to createdAt when omitted', () => {
    const dto = plainToInstance(GetRefreshTokensDto, {});
    expect(dto.sortBy).toBe(RefreshTokenSortField.CREATED_AT);
  });

  it('passes with no sortBy (omitted)', async () => {
    const errors = await getErrors({});
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Inherited PaginationDto constraints
// ---------------------------------------------------------------------------

describe('GetRefreshTokensDto — pagination constraints (SW-BE-002)', () => {
  it('passes with valid page and limit', async () => {
    const errors = await getErrors({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('rejects page less than 1', async () => {
    const errors = await getErrors({ page: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects limit greater than 100', async () => {
    const errors = await getErrors({ limit: 101 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects limit less than 1', async () => {
    const errors = await getErrors({ limit: 0 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('defaults page to 1 when omitted', () => {
    const dto = plainToInstance(GetRefreshTokensDto, {});
    expect(dto.page).toBe(1);
  });

  it('defaults limit to 10 when omitted', () => {
    const dto = plainToInstance(GetRefreshTokensDto, {});
    expect(dto.limit).toBe(10);
  });

  it('accepts ASC and DESC sortOrder', async () => {
    for (const order of [SortOrder.ASC, SortOrder.DESC]) {
      const errors = await getErrors({ sortOrder: order });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an invalid sortOrder value', async () => {
    const errors = await getErrors({ sortOrder: 'RANDOM' });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Stable sort guarantee: all fields are deterministic enum values
// ---------------------------------------------------------------------------

describe('RefreshTokenSortField enum stability (SW-BE-002)', () => {
  it('enum values match the RefreshToken entity column names', () => {
    expect(RefreshTokenSortField.CREATED_AT).toBe('createdAt');
    expect(RefreshTokenSortField.LAST_USED_AT).toBe('lastUsedAt');
    expect(RefreshTokenSortField.EXPIRES_AT).toBe('expiresAt');
  });

  it('enum has exactly three sort fields', () => {
    expect(Object.values(RefreshTokenSortField)).toHaveLength(3);
  });
});
