import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";

export class InitializationGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InitializationGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new InitializationGenerationError(code, message, details);
};

export const compileInitializationV1 = (ir, abi) => {
  validateBindingIr(ir);
  if (abi === null || typeof abi !== "object" || Array.isArray(abi)) {
    fail("invalid-initialization-abi", "private ABI must be an object");
  }
  if (
    abi.initialize !== null &&
    (typeof abi.initialize !== "string" || abi.initialize.length === 0)
  ) {
    fail(
      "invalid-initialization-abi",
      "private ABI initialize must be null or a non-empty symbol",
    );
  }
  return Object.freeze({
    kind: "initialization-v1",
    abiVersion: 1,
    bindingIrSha256: hashBindingIr(ir),
    required: abi.initialize !== null,
    symbol: abi.initialize,
    trigger: "first-call",
    scope: "component-runtime",
    success: "nonzero",
    failure: "terminal",
    retry: "never",
  });
};
