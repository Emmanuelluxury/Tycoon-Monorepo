import { describe, expect, it } from "vitest";
import {
  isGasSafe,
  MAX_FUNCTION_CALL_GAS,
  validateCallContractParams,
  validateContractArgs,
} from "@/lib/near/call-contract-validation";
import { MAX_DEPOSIT_YOCTO } from "@/lib/near/security";
import type { CallContractValidationParams } from "@/lib/near/call-contract-validation";

const ALLOWED = "guest-book.testnet";

const BASE_PARAMS: CallContractValidationParams = {
  contractId: ALLOWED,
  methodName: "addMessage",
  args: { text: "hello" },
};

describe("isGasSafe", () => {
  it("allows default function-call gas", () => {
    expect(isGasSafe(BigInt("30000000000000"))).toBe(true);
  });

  it("rejects zero gas", () => {
    expect(isGasSafe(BigInt(0))).toBe(false);
  });

  it("rejects gas above MAX_FUNCTION_CALL_GAS", () => {
    expect(isGasSafe(MAX_FUNCTION_CALL_GAS + BigInt(1))).toBe(false);
  });
});

describe("validateContractArgs", () => {
  it("rejects non-object args", () => {
    expect(() => validateContractArgs("bad")).toThrow(/plain object/);
    expect(() => validateContractArgs(null)).toThrow(/plain object/);
    expect(() => validateContractArgs([1, 2])).toThrow(/plain object/);
  });

  it("rejects __proto__ keys", () => {
    expect(() =>
      validateContractArgs({ ["__proto__" as string]: { polluted: true } }),
    ).toThrow(/Invalid key/);
  });

  it("rejects oversized JSON payloads", () => {
    const huge = { data: "x".repeat(9000) };
    expect(() => validateContractArgs(huge)).toThrow(/exceeds/);
  });
});

describe("validateCallContractParams", () => {
  it("accepts valid params for the allowed contract", () => {
    expect(() => validateCallContractParams(BASE_PARAMS, ALLOWED)).not.toThrow();
  });

  it("rejects contract IDs not on the allowlist", () => {
    expect(() =>
      validateCallContractParams(
        { ...BASE_PARAMS, contractId: "other.testnet" },
        ALLOWED,
      ),
    ).toThrow(/not allowed/);
  });

  it("rejects invalid method names", () => {
    expect(() =>
      validateCallContractParams(
        { ...BASE_PARAMS, methodName: "bad-method!" },
        ALLOWED,
      ),
    ).toThrow(/Invalid NEAR method name/);
  });

  it("rejects deposits above the safe limit", () => {
    expect(() =>
      validateCallContractParams(
        { ...BASE_PARAMS, deposit: MAX_DEPOSIT_YOCTO + BigInt(1) },
        ALLOWED,
      ),
    ).toThrow(/exceeds the safe limit/);
  });

  it("rejects excessive gas", () => {
    expect(() =>
      validateCallContractParams(
        { ...BASE_PARAMS, gas: MAX_FUNCTION_CALL_GAS + BigInt(1) },
        ALLOWED,
      ),
    ).toThrow(/Gas/);
  });
});
