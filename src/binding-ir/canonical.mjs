import { createHash } from "node:crypto";

import { validateBindingIr } from "./contract.mjs";

export const BINDING_IR_SCHEMA_VERSION = 1;
export const SUPPORTED_BINDING_IR_SCHEMA_VERSIONS = Object.freeze([1]);

export class BindingIrCanonicalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BindingIrCanonicalError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class BindingIrCompatibilityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BindingIrCompatibilityError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const canonicalFail = (code, message, details = {}) => {
  throw new BindingIrCanonicalError(code, message, details);
};

const assertUnicodeScalarString = (value, path) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        canonicalFail("invalid-unicode", `${path} contains an unpaired high surrogate`, {
          path,
          index,
        });
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      canonicalFail("invalid-unicode", `${path} contains an unpaired low surrogate`, {
        path,
        index,
      });
    }
  }
};

const serializeCanonical = (value, path, ancestors) => {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicodeScalarString(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      canonicalFail("invalid-number", `${path} must contain a finite JSON number`, {
        path,
        actual: value,
      });
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    canonicalFail("non-json-value", `${path} contains a non-JSON value`, {
      path,
      actualType: typeof value,
    });
  }
  if (ancestors.has(value)) {
    canonicalFail("cycle", `${path} contains a reference cycle`, { path });
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          canonicalFail("array-hole", `${path}[${index}] is missing`, {
            path: `${path}[${index}]`,
          });
        }
        items.push(serializeCanonical(value[index], `${path}[${index}]`, ancestors));
      }
      return `[${items.join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      canonicalFail("non-json-object", `${path} must contain a plain JSON object`, {
        path,
      });
    }
    const keys = Object.keys(value).sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    const members = keys.map(key => {
      assertUnicodeScalarString(key, `${path} key`);
      return `${JSON.stringify(key)}:${serializeCanonical(value[key], `${path}.${key}`, ancestors)}`;
    });
    return `{${members.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
};

export const diagnoseBindingIrVersion = value => {
  const actual = value?.schemaVersion;
  const supported = [...SUPPORTED_BINDING_IR_SCHEMA_VERSIONS];
  if (!Number.isSafeInteger(actual) || actual < 1) {
    return Object.freeze({
      compatible: false,
      code: "invalid-schema-version",
      actual,
      supported,
      relation: "invalid",
      action: "Regenerate the binding IR with a frontend that emits a positive schemaVersion.",
    });
  }
  if (supported.includes(actual)) {
    return Object.freeze({
      compatible: true,
      code: "exact-schema-version",
      actual,
      supported,
      relation: "exact",
      action: null,
    });
  }
  const relation = actual < supported[0] ? "older" : "newer";
  return Object.freeze({
    compatible: false,
    code: relation === "older" ? "migration-required" : "consumer-upgrade-required",
    actual,
    supported,
    relation,
    action:
      relation === "older"
        ? `Migrate schema version ${actual} to version ${BINDING_IR_SCHEMA_VERSION} before generation.`
        : `Upgrade the consumer to support schema version ${actual}.`,
  });
};

export const assertCompatibleBindingIrVersion = value => {
  const diagnostic = diagnoseBindingIrVersion(value);
  if (!diagnostic.compatible) {
    throw new BindingIrCompatibilityError(
      diagnostic.code,
      diagnostic.action,
      diagnostic,
    );
  }
  return diagnostic;
};

export const parseBindingIr = text => {
  let value;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new BindingIrCanonicalError("invalid-json", "Binding IR is not valid JSON", {
      cause: cause.message,
    });
  }
  assertCompatibleBindingIrVersion(value);
  return validateBindingIr(value);
};

export const canonicalizeBindingIr = value => {
  assertCompatibleBindingIrVersion(value);
  validateBindingIr(value);
  return serializeCanonical(value, "bindingIr", new Set());
};

export const hashBindingIr = value =>
  createHash("sha256").update(canonicalizeBindingIr(value), "utf8").digest("hex");

export const migrateBindingIr = (value, targetVersion = BINDING_IR_SCHEMA_VERSION) => {
  if (targetVersion !== BINDING_IR_SCHEMA_VERSION) {
    throw new BindingIrCompatibilityError(
      "unsupported-migration-target",
      `This tool cannot emit binding IR schema version ${targetVersion}.`,
      { targetVersion, supported: [...SUPPORTED_BINDING_IR_SCHEMA_VERSIONS] },
    );
  }
  const diagnostic = diagnoseBindingIrVersion(value);
  if (!diagnostic.compatible) {
    throw new BindingIrCompatibilityError(
      "migration-unavailable",
      `No automatic migration from schema version ${String(diagnostic.actual)} is registered.`,
      diagnostic,
    );
  }
  validateBindingIr(value);
  return structuredClone(value);
};
