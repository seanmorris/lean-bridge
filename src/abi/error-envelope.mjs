import { validateBindingIr } from "../binding-ir/contract.mjs";

export class ErrorEnvelopeGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ErrorEnvelopeGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new ErrorEnvelopeGenerationError(code, message, details);
};

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const align = (value, alignment) => Math.ceil(value / alignment) * alignment;

const scalar = (type, path) => {
  if (type.kind !== "primitive") {
    fail("unsupported-error-value", `${path} requires a copied scalar`, { path, type });
  }
  if (type.name === "unit") {
    return { codec: "unit", byteWidth: 0, alignment: 1 };
  }
  if (new Set(["bool", "uint8", "uint16", "uint32"]).has(type.name)) {
    return { codec: type.name === "bool" ? "bool" : "uint32", byteWidth: 4, alignment: 4 };
  }
  if (new Set(["int8", "int16", "int32"]).has(type.name)) {
    return { codec: "int32", byteWidth: 4, alignment: 4 };
  }
  if (type.name === "float32") {
    return { codec: "float32", byteWidth: 4, alignment: 4 };
  }
  if (type.name === "float64") {
    return { codec: "float64", byteWidth: 8, alignment: 8 };
  }
  fail("unsupported-error-value", `${path} uses unsupported scalar ${type.name}`, {
    path,
    type: type.name,
  });
};

export const supportsErrorEnvelopeValue = type => {
  if (type === null) return true;
  try {
    scalar(type, "value");
    return true;
  } catch (error) {
    if (error instanceof ErrorEnvelopeGenerationError) return false;
    throw error;
  }
};

export const compileErrorEnvelopeV1 = (
  ir,
  declarationId,
  { abiVersion = 1, maxEnvelopeBytes = 256 } = {},
) => {
  validateBindingIr(ir);
  if (abiVersion !== 1) {
    fail("unsupported-error-envelope-version", `error envelope ABI ${abiVersion} is unsupported`, {
      actual: abiVersion,
      supported: [1],
    });
  }
  if (!Number.isSafeInteger(maxEnvelopeBytes) || maxEnvelopeBytes < 24) {
    fail("invalid-error-envelope-limit", "maxEnvelopeBytes must be at least 24", {
      actual: maxEnvelopeBytes,
    });
  }
  const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
  if (!declaration) {
    fail("missing-declaration", `Binding IR has no declaration ${declarationId}`, {
      declaration: declarationId,
    });
  }
  if (
    declaration.kind !== "function" ||
    declaration.resultMode !== "value" ||
    declaration.typeParameters.length > 0 ||
    declaration.failure.mode !== "declared"
  ) {
    fail(
      "unsupported-error-envelope-declaration",
      `${declarationId} must be a synchronous, monomorphic function with declared failures`,
      { declaration: declarationId },
    );
  }
  for (const parameter of declaration.parameters) {
    scalar(parameter.type, `${declarationId}.${parameter.name}`);
  }

  const resultScalar = scalar(declaration.result.type, `${declarationId}.result`);
  const resultOffset = align(16, resultScalar.alignment);
  const result = {
    type: declaration.result.type,
    ...resultScalar,
    offset: resultScalar.byteWidth === 0 ? null : resultOffset,
  };
  const afterResult = resultOffset + resultScalar.byteWidth;
  const errorMap = new Map(ir.errors.map(error => [error.id, error]));
  const payloadScalars = declaration.failure.errors.map(errorId => {
    const error = errorMap.get(errorId);
    if (!error) {
      fail("missing-declared-error", `${declarationId} names unknown error ${errorId}`, {
        declaration: declarationId,
        error: errorId,
      });
    }
    return error.payload === null
      ? undefined
      : scalar(error.payload, `${errorId}.payload`);
  });
  const payloadAlignment = Math.max(1, ...payloadScalars.map(item => item?.alignment ?? 1));
  const payloadOffset = align(afterResult, payloadAlignment);
  const payloadBytes = Math.max(0, ...payloadScalars.map(item => item?.byteWidth ?? 0));
  const byteSize = align(payloadOffset + payloadBytes, 8);
  if (byteSize > maxEnvelopeBytes) {
    fail("error-envelope-limit", `${declarationId} requires ${byteSize} envelope bytes`, {
      declaration: declarationId,
      byteSize,
      maxEnvelopeBytes,
    });
  }

  const errors = declaration.failure.errors.map((errorId, index) => {
    const error = errorMap.get(errorId);
    const payloadScalar = payloadScalars[index];
    return {
      tag: index + 1,
      id: error.id,
      name: error.name,
      category: error.category,
      payload:
        payloadScalar === undefined
          ? null
          : {
              type: error.payload,
              ...payloadScalar,
              offset: payloadOffset,
            },
    };
  });

  return deepFreeze({
    kind: "error-envelope-v1",
    abiVersion,
    declarationId,
    byteSize,
    header: {
      abiVersion: 0,
      byteSize: 4,
      outcome: 8,
      errorTag: 12,
    },
    outcomes: {
      ok: 0,
      declared: 1,
      unexpected: 2,
    },
    result,
    errors,
    unexpected: declaration.failure.unexpected,
  });
};
