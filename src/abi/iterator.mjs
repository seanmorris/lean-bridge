import { validateBindingIr } from "../binding-ir/contract.mjs";

export class IteratorGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "IteratorGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new IteratorGenerationError(code, message, details);
};

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const scalar = (type, path) => {
  if (type.kind !== "primitive") {
    fail("unsupported-iterator-value", `${path} requires a copied scalar`, { path, type });
  }
  if (new Set(["bool", "uint8", "uint16", "uint32"]).has(type.name)) {
    return { codec: type.name === "bool" ? "bool" : "uint32", byteWidth: 4 };
  }
  if (new Set(["int8", "int16", "int32"]).has(type.name)) {
    return { codec: "int32", byteWidth: 4 };
  }
  if (type.name === "float32") return { codec: "float32", byteWidth: 4 };
  if (type.name === "float64") return { codec: "float64", byteWidth: 8 };
  fail("unsupported-iterator-value", `${path} uses unsupported scalar ${type.name}`, {
    path,
    type: type.name,
  });
};

export const supportsIteratorValue = type => {
  try {
    scalar(type, "value");
    return true;
  } catch (error) {
    if (error instanceof IteratorGenerationError) return false;
    throw error;
  }
};

export const compileIteratorV1 = (
  ir,
  declarationId,
  {
    abiVersion = 1,
    side,
    handleKind,
    next,
    dispose,
  } = {},
) => {
  validateBindingIr(ir);
  if (abiVersion !== 1) {
    fail("unsupported-iterator-version", `iterator ABI ${abiVersion} is unsupported`, {
      actual: abiVersion,
      supported: [1],
    });
  }
  if (side !== "lean" || !Number.isSafeInteger(handleKind) || handleKind < 1 || handleKind > 0x7f) {
    fail("invalid-iterator-handle", `${declarationId} has an invalid cursor handle`, {
      side,
      handleKind,
    });
  }
  for (const [name, value] of Object.entries({ next, dispose })) {
    if (typeof value !== "string" || value.length === 0) {
      fail("invalid-iterator-symbol", `${declarationId} has no ${name} symbol`, { name });
    }
  }
  const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
  if (!declaration) {
    fail("missing-declaration", `Binding IR has no declaration ${declarationId}`, {
      declaration: declarationId,
    });
  }
  if (
    declaration.kind !== "function" ||
    declaration.resultMode !== "iterator" ||
    declaration.typeParameters.length > 0
  ) {
    fail(
      "unsupported-iterator-declaration",
      `${declarationId} must be a synchronous monomorphic iterator function`,
      { declaration: declarationId, resultMode: declaration.resultMode },
    );
  }
  for (const parameter of declaration.parameters) {
    scalar(parameter.type, `${declarationId}.${parameter.name}`);
  }
  const value = scalar(declaration.result.type, `${declarationId}.result`);
  const byteSize = value.byteWidth === 8 ? 24 : 20;

  return deepFreeze({
    kind: "iterator-v1",
    abiVersion,
    declarationId,
    delivery: "iterator",
    cursor: {
      typeId: `${declarationId}/iterator`,
      handle: { side, kind: handleKind },
      ownership: "lease",
      lifetime: { scope: "explicit", anchor: null },
      disposal: {
        explicit: true,
        hostProtocol: "return",
        fallback: "queued-finalizer",
        symbol: dispose,
      },
    },
    step: {
      symbol: next,
      byteSize,
      header: {
        abiVersion: 0,
        byteSize: 4,
        state: 8,
        detail: 12,
      },
      states: { value: 0, done: 1 },
      value: {
        type: declaration.result.type,
        ...value,
        offset: 16,
      },
    },
  });
};

export const compileAsyncIteratorV1 = (
  ir,
  declarationId,
  {
    abiVersion = 1,
    side,
    handleKind,
    next,
    cancel,
    dispose,
  } = {},
) => {
  validateBindingIr(ir);
  if (abiVersion !== 1) {
    fail("unsupported-iterator-version", `iterator ABI ${abiVersion} is unsupported`, {
      actual: abiVersion,
      supported: [1],
    });
  }
  if (side !== "lean" || !Number.isSafeInteger(handleKind) || handleKind < 1 || handleKind > 0x7f) {
    fail("invalid-iterator-handle", `${declarationId} has an invalid cursor handle`, {
      side,
      handleKind,
    });
  }
  for (const [name, value] of Object.entries({ next, cancel, dispose })) {
    if (typeof value !== "string" || value.length === 0) {
      fail("invalid-iterator-symbol", `${declarationId} has no ${name} symbol`, { name });
    }
  }
  const declaration = ir.declarations.find(candidate => candidate.id === declarationId);
  if (!declaration) {
    fail("missing-declaration", `Binding IR has no declaration ${declarationId}`, {
      declaration: declarationId,
    });
  }
  if (
    declaration.kind !== "function" ||
    declaration.resultMode !== "async-iterator" ||
    declaration.typeParameters.length > 0
  ) {
    fail(
      "unsupported-iterator-declaration",
      `${declarationId} must be a monomorphic async iterator function`,
      { declaration: declarationId, resultMode: declaration.resultMode },
    );
  }
  for (const parameter of declaration.parameters) {
    scalar(parameter.type, `${declarationId}.${parameter.name}`);
  }
  const value = scalar(declaration.result.type, `${declarationId}.result`);
  const resolver =
    value.codec === "int32"
      ? "__leanBridgePendingResolveIteratorI32"
      : new Set(["float32", "float64"]).has(value.codec)
        ? "__leanBridgePendingResolveIteratorF64"
        : "__leanBridgePendingResolveIteratorU32";

  return deepFreeze({
    kind: "async-iterator-v1",
    abiVersion,
    declarationId,
    delivery: "async-iterator",
    cursor: {
      typeId: `${declarationId}/async-iterator`,
      handle: { side, kind: handleKind },
      ownership: "lease",
      lifetime: { scope: "explicit", anchor: null },
      disposal: {
        explicit: true,
        hostProtocol: "return",
        fallback: "queued-finalizer",
        symbol: dispose,
      },
    },
    step: {
      symbol: next,
      cancelSymbol: cancel,
      resolver,
      states: { value: 0, done: 1 },
      value: {
        type: declaration.result.type,
        ...value,
      },
      pending: {
        kind: "pending-operation-v1",
        abiVersion: 1,
        delivery: "promise",
        settlement: { cardinality: "exactly-once", late: "reject" },
        cancellation: { supported: true, cleanup: "before-reject" },
      },
    },
  });
};
