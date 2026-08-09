import { validateBindingIr } from "./contract.mjs";

export class BindingIrFrontendError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BindingIrFrontendError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new BindingIrFrontendError(code, message, details);
};

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const createBindingIrFrontend = ({
  producerId,
  adapter,
  adapterVersion,
  analyze,
}) => {
  if (typeof producerId !== "string" || producerId.length === 0) {
    fail("invalid-frontend", "producerId must be a non-empty string");
  }
  if (typeof adapter !== "string" || adapter.length === 0) {
    fail("invalid-frontend", "adapter must be a non-empty string");
  }
  if (!Number.isSafeInteger(adapterVersion) || adapterVersion < 1) {
    fail("invalid-frontend", "adapterVersion must be a positive integer");
  }
  if (typeof analyze !== "function") {
    fail("invalid-frontend", "analyze must be a function");
  }

  return Object.freeze({
    producerId,
    adapter,
    adapterVersion,
    async analyze(input) {
      const candidate = await analyze(input);
      validateBindingIr(candidate);
      const producer = candidate.producers.find(item => item.id === producerId);
      if (!producer) {
        fail("missing-producer", `binding IR does not declare producer ${producerId}`, {
          producerId,
        });
      }
      if (producer.adapter !== adapter || producer.adapterVersion !== adapterVersion) {
        fail("frontend-version", `binding IR producer ${producerId} does not match its frontend`, {
          producerId,
          expected: { adapter, adapterVersion },
          actual: {
            adapter: producer.adapter,
            adapterVersion: producer.adapterVersion,
          },
        });
      }
      return deepFreeze(structuredClone(candidate));
    },
  });
};
