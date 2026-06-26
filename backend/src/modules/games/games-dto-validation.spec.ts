import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RollDiceDto } from './dto/roll-dice.dto';
import { PayRentDto } from './dto/pay-rent.dto';
import { PayTaxDto } from './dto/pay-tax.dto';
import { BuyPropertyDto } from './dto/buy-property.dto';
import {
  GameValidationException,
  GameException,
  mapValidationErrorToGameException,
} from './exceptions/game-exceptions';

/**
 * SW-BE-016: DTO validation and error mapping unit tests.
 * Verifies that all games action DTOs enforce constraints and that
 * validation errors map cleanly to GameException shapes.
 */

// ─── helpers ────────────────────────────────────────────────────────────────

async function validateDto(cls: new () => any, plain: object) {
  const instance = plainToInstance(cls, plain);
  return validate(instance);
}

// ─── RollDiceDto ────────────────────────────────────────────────────────────

describe('RollDiceDto', () => {
  it('accepts valid dice values', async () => {
    const errs = await validateDto(RollDiceDto, { dice1: 1, dice2: 6 });
    expect(errs).toHaveLength(0);
  });

  it('rejects dice value 0 (below min)', async () => {
    const errs = await validateDto(RollDiceDto, { dice1: 0, dice2: 3 });
    expect(errs.some((e) => e.property === 'dice1')).toBe(true);
  });

  it('rejects dice value 7 (above max)', async () => {
    const errs = await validateDto(RollDiceDto, { dice1: 7, dice2: 3 });
    expect(errs.some((e) => e.property === 'dice1')).toBe(true);
  });

  it('rejects non-integer dice', async () => {
    const errs = await validateDto(RollDiceDto, { dice1: 2.5, dice2: 3 });
    expect(errs.some((e) => e.property === 'dice1')).toBe(true);
  });

  it('rejects missing dice fields', async () => {
    const errs = await validateDto(RollDiceDto, {});
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PayRentDto ─────────────────────────────────────────────────────────────

describe('PayRentDto', () => {
  it('accepts valid payeeId and baseRent', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 2, baseRent: 50 });
    expect(errs).toHaveLength(0);
  });

  it('rejects payeeId 0 (below min)', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 0, baseRent: 50 });
    expect(errs.some((e) => e.property === 'payeeId')).toBe(true);
  });

  it('rejects non-integer payeeId', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 1.5, baseRent: 50 });
    expect(errs.some((e) => e.property === 'payeeId')).toBe(true);
  });

  it('rejects negative baseRent', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 1, baseRent: -10 });
    expect(errs.some((e) => e.property === 'baseRent')).toBe(true);
  });

  it('rejects zero baseRent', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 1, baseRent: 0 });
    expect(errs.some((e) => e.property === 'baseRent')).toBe(true);
  });

  it('rejects missing fields', async () => {
    const errs = await validateDto(PayRentDto, {});
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PayTaxDto ──────────────────────────────────────────────────────────────

describe('PayTaxDto', () => {
  it('accepts valid baseTax', async () => {
    const errs = await validateDto(PayTaxDto, { baseTax: 75 });
    expect(errs).toHaveLength(0);
  });

  it('rejects negative baseTax', async () => {
    const errs = await validateDto(PayTaxDto, { baseTax: -5 });
    expect(errs.some((e) => e.property === 'baseTax')).toBe(true);
  });

  it('rejects zero baseTax', async () => {
    const errs = await validateDto(PayTaxDto, { baseTax: 0 });
    expect(errs.some((e) => e.property === 'baseTax')).toBe(true);
  });

  it('rejects missing baseTax', async () => {
    const errs = await validateDto(PayTaxDto, {});
    expect(errs.some((e) => e.property === 'baseTax')).toBe(true);
  });

  it('rejects string baseTax', async () => {
    const errs = await validateDto(PayTaxDto, { baseTax: 'fifty' });
    expect(errs.some((e) => e.property === 'baseTax')).toBe(true);
  });
});

// ─── BuyPropertyDto ─────────────────────────────────────────────────────────

describe('BuyPropertyDto', () => {
  it('accepts valid propertyCost and propertyId', async () => {
    const errs = await validateDto(BuyPropertyDto, {
      propertyCost: 200,
      propertyId: 5,
    });
    expect(errs).toHaveLength(0);
  });

  it('rejects negative propertyCost', async () => {
    const errs = await validateDto(BuyPropertyDto, {
      propertyCost: -50,
      propertyId: 1,
    });
    expect(errs.some((e) => e.property === 'propertyCost')).toBe(true);
  });

  it('rejects zero propertyCost', async () => {
    const errs = await validateDto(BuyPropertyDto, {
      propertyCost: 0,
      propertyId: 1,
    });
    expect(errs.some((e) => e.property === 'propertyCost')).toBe(true);
  });

  it('rejects non-integer propertyId', async () => {
    const errs = await validateDto(BuyPropertyDto, {
      propertyCost: 100,
      propertyId: 1.5,
    });
    expect(errs.some((e) => e.property === 'propertyId')).toBe(true);
  });

  it('rejects propertyId 0 (below min)', async () => {
    const errs = await validateDto(BuyPropertyDto, {
      propertyCost: 100,
      propertyId: 0,
    });
    expect(errs.some((e) => e.property === 'propertyId')).toBe(true);
  });

  it('rejects missing fields', async () => {
    const errs = await validateDto(BuyPropertyDto, {});
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Error mapping ──────────────────────────────────────────────────────────

describe('mapValidationErrorToGameException', () => {
  it('returns GameValidationException for isInt constraint', async () => {
    const errs = await validateDto(RollDiceDto, { dice1: 2.5, dice2: 3 });
    const ex = mapValidationErrorToGameException(errs);
    expect(ex).toBeInstanceOf(GameValidationException);
    expect(ex.errorCode).toBe('GAME_VALIDATION_ERROR');
  });

  it('returns GameValidationException for min constraint', async () => {
    const errs = await validateDto(PayRentDto, { payeeId: 0, baseRent: 50 });
    const ex = mapValidationErrorToGameException(errs);
    expect(ex).toBeInstanceOf(GameValidationException);
    expect(ex.errorCode).toBe('GAME_VALIDATION_ERROR');
  });

  it('returns generic GameException for empty errors array', () => {
    const ex = mapValidationErrorToGameException([]);
    expect(ex).toBeInstanceOf(GameException);
    expect(ex.errorCode).toBe('UNKNOWN_VALIDATION_ERROR');
  });

  it('error includes field and constraint info', async () => {
    const errs = await validateDto(PayTaxDto, { baseTax: -1 });
    const ex = mapValidationErrorToGameException(errs);
    expect(ex.details).toMatchObject({ field: 'baseTax' });
  });
});
