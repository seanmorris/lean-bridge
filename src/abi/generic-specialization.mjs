import { validateBindingIr } from "../binding-ir/contract.mjs";

export class GenericSpecializationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GenericSpecializationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new GenericSpecializationError(code, message, details);
};

const deepFreeze = value => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const GUARDS = Object.freeze({
  bool: "boolean",
  uint8: "number",
  uint16: "number",
  uint32: "number",
  int8: "number",
  int16: "number",
  int32: "number",
  float32: "number",
  float64: "number",
  uint64: "bigint",
  int64: "bigint",
  nat: "bigint",
  int: "bigint",
  string: "string",
  bytes: "bytes",
});

export const compileGenericSpecializationV1 = (ir, declarationId, adapter = null) => {
  validateBindingIr(ir);
  const declaration = ir.declarations.find(item => item.id === declarationId);
  if (!declaration) fail("unknown-generic-declaration", `unknown declaration ${declarationId}`);
  if (
    declaration.kind !== "function" ||
    declaration.typeParameters.length !== 1 ||
    declaration.typeParameters[0].representation !== "copied" ||
    declaration.typeParameters[0].constraints.length !== 0 ||
    declaration.parameters.length !== 1 ||
    declaration.parameters[0].type.kind !== "parameter" ||
    declaration.parameters[0].type.id !== declaration.typeParameters[0].id ||
    declaration.result.type.kind !== "parameter" ||
    declaration.result.type.id !== declaration.typeParameters[0].id ||
    declaration.resultMode !== "value"
  ) {
    fail(
      "unsupported-generic-shape",
      `${declarationId} is not a synchronous copied identity specialization`,
      { declaration: declarationId },
    );
  }
  const metadata = declaration.source.extensions["lean-wasm.org/specializations"];
  if (!Array.isArray(metadata) || metadata.length === 0) {
    fail("missing-generic-specializations", `${declarationId} has no specialization metadata`, {
      declaration: declarationId,
    });
  }
  const privateBranches = adapter
    ? new Map(adapter.branches.map(branch => [branch.id, branch.symbol]))
    : null;
  const ids = new Set();
  const guards = new Map();
  const branches = metadata.map((branch, index) => {
    if (
      branch === null ||
      typeof branch !== "object" ||
      Array.isArray(branch) ||
      Object.keys(branch).sort().join(",") !== "id,type" ||
      typeof branch.id !== "string" ||
      branch.id.length === 0 ||
      branch.type?.kind !== "primitive" ||
      !(branch.type.name in GUARDS)
    ) {
      fail("invalid-generic-specialization", `${declarationId} specialization ${index} is invalid`, {
        declaration: declarationId,
        index,
      });
    }
    if (ids.has(branch.id)) {
      fail("duplicate-generic-specialization", `${declarationId} repeats ${branch.id}`, {
        declaration: declarationId,
        specialization: branch.id,
      });
    }
    ids.add(branch.id);
    const guard = GUARDS[branch.type.name];
    if (guards.has(guard)) {
      fail(
        "ambiguous-generic-specialization",
        `${declarationId} maps ${guards.get(guard)} and ${branch.id} to ${guard}`,
        { declaration: declarationId, guard },
      );
    }
    guards.set(guard, branch.id);
    const symbol = privateBranches?.get(branch.id);
    if (privateBranches && (typeof symbol !== "string" || symbol.length === 0)) {
      fail("missing-generic-symbol", `${declarationId} has no private symbol for ${branch.id}`, {
        declaration: declarationId,
        specialization: branch.id,
      });
    }
    return {
      id: branch.id,
      type: structuredClone(branch.type),
      guard,
      ...(symbol ? { symbol } : {}),
    };
  });
  if (privateBranches && privateBranches.size !== branches.length) {
    fail("unknown-generic-symbol", `${declarationId} private specializations do not match metadata`, {
      declaration: declarationId,
    });
  }
  return deepFreeze({
    kind: "generic-specialization-v1",
    abiVersion: 1,
    declarationId,
    parameter: declaration.parameters[0].name,
    typeParameter: declaration.typeParameters[0].id,
    branches,
  });
};
