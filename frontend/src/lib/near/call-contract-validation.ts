/**
 * Pre-flight validation for NEAR contract calls.
 * SW-FE-039: security hardening review.
 */
import {
  DEFAULT_FUNCTION_CALL_GAS,
  isValidNearAccountId,
} from "@/lib/near/config";
import { isDepositSafe, MAX_DEPOSIT_YOCTO } from "@/lib/near/security";

export interface CallContractValidationParams {
  contractId: string;
  methodName: string;
  args: object;
  gas?: bigint;
  deposit?: bigint;
}

/** Upper bound: 100 Tgas — well above typical calls, blocks runaway gas values. */
export const MAX_FUNCTION_CALL_GAS = BigInt("100000000000000");

export const MAX_ARGS_JSON_BYTES = 8192;
export const MAX_ARGS_NESTING_DEPTH = 10;

const METHOD_NAME_RE = /^[a-zA-Z0-9_]{1,64}$/;
const UNSAFE_ARG_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isGasSafe(gas: bigint): boolean {
  return gas > BigInt(0) && gas <= MAX_FUNCTION_CALL_GAS;
}

function assertPlainObject(args: unknown): asserts args is Record<string, unknown> {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Contract args must be a plain object");
  }
}

function assertSafeArgKeys(obj: Record<string, unknown>, depth = 0): void {
  if (depth > MAX_ARGS_NESTING_DEPTH) {
    throw new Error(
      `Contract args exceed max nesting depth of ${MAX_ARGS_NESTING_DEPTH}`,
    );
  }
  for (const key of Object.keys(obj)) {
    if (UNSAFE_ARG_KEYS.has(key)) {
      throw new Error(`Invalid key in contract args: "${key}"`);
    }
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      assertSafeArgKeys(value as Record<string, unknown>, depth + 1);
    }
  }
}

/** Validates serialized size and disallows prototype-pollution keys. */
export function validateContractArgs(args: unknown): void {
  assertPlainObject(args);
  assertSafeArgKeys(args);
  const serialized = JSON.stringify(args);
  if (serialized.length > MAX_ARGS_JSON_BYTES) {
    throw new Error(
      `Contract args JSON exceeds ${MAX_ARGS_JSON_BYTES} bytes (${serialized.length} bytes)`,
    );
  }
}

/**
 * Validates all call parameters before the wallet is invoked.
 * `allowedContractId` is the app-configured contract — receiver must match.
 */
export function validateCallContractParams(
  params: CallContractValidationParams,
  allowedContractId: string,
): void {
  if (!isValidNearAccountId(params.contractId)) {
    throw new Error(`Invalid NEAR contract ID: "${params.contractId}"`);
  }
  if (params.contractId !== allowedContractId) {
    throw new Error(
      `Contract "${params.contractId}" is not allowed. Expected "${allowedContractId}".`,
    );
  }
  if (!METHOD_NAME_RE.test(params.methodName)) {
    throw new Error(`Invalid NEAR method name: "${params.methodName}"`);
  }

  validateContractArgs(params.args);

  const deposit = params.deposit ?? BigInt(0);
  if (!isDepositSafe(deposit)) {
    throw new Error(
      `Deposit ${deposit.toString()} yoctoNEAR exceeds the safe limit of ${MAX_DEPOSIT_YOCTO.toString()} (1 NEAR). Pass a smaller deposit.`,
    );
  }

  const gas = params.gas ?? DEFAULT_FUNCTION_CALL_GAS;
  if (!isGasSafe(gas)) {
    throw new Error(
      `Gas ${gas.toString()} exceeds the safe limit of ${MAX_FUNCTION_CALL_GAS.toString()}.`,
    );
  }
}
