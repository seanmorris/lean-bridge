import { validateBindingIr } from "../binding-ir/contract.mjs";

export class PendingOperationGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PendingOperationGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new PendingOperationGenerationError(code, message, details);
};

const deepFreeze = value => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const clone = value => (value === null || value === undefined ? value : structuredClone(value));

const representationOf = (typeRef, typeMap, parameters) => {
  if (typeRef.kind === "primitive") return "copied";
  if (typeRef.kind === "named") return typeMap.get(typeRef.id)?.representation;
  if (typeRef.kind === "parameter") return parameters.get(typeRef.id)?.representation;
  if (typeRef.kind === "apply") {
    const representations = typeRef.arguments.map(argument =>
      representationOf(argument, typeMap, parameters),
    );
    if (representations.includes("identity")) return "identity";
    if (representations.includes("any")) return "any";
    return "copied";
  }
  return undefined;
};

const captureAction = ownership => {
  if (ownership === "copy") return "copy-into-operation";
  if (ownership === "borrow") return "retain-borrow-until-settlement";
  if (ownership === "lease") return "retain-lease-until-settlement";
  return "take-ownership-until-settlement";
};

const cleanupAction = ownership =>
  ownership === "copy" ? "none" : "release-after-settlement";

const compileCapture = (site, source, name, typeMap, parameters) => {
  if (site === null) return null;
  return deepFreeze({
    source,
    name,
    type: clone(site.type),
    representation: representationOf(site.type, typeMap, parameters),
    ownership: site.ownership,
    lifetime: clone(site.lifetime),
    capture: captureAction(site.ownership),
    cleanup: cleanupAction(site.ownership),
  });
};

const compileDelivery = (site, typeMap, parameters) => ({
  type: clone(site.type),
  representation: representationOf(site.type, typeMap, parameters),
  ownership: site.ownership,
  lifetime: clone(site.lifetime),
  delivery:
    site.ownership === "copy"
      ? "lift-copy"
      : site.ownership === "borrow"
        ? "project-canonical-borrow"
        : "project-canonical-owner",
});

export const compilePendingOperationV1 = (ir, declarationId) => {
  validateBindingIr(ir);
  const declaration = ir.declarations.find(item => item.id === declarationId);
  if (!declaration) {
    fail("unknown-declaration", `Binding IR has no declaration ${declarationId}`, {
      declarationId,
    });
  }
  if (declaration.resultMode !== "promise") {
    fail(
      "not-a-promise",
      `${declarationId} uses ${declaration.resultMode} delivery instead of promise delivery`,
      { declarationId, resultMode: declaration.resultMode },
    );
  }
  if (declaration.typeParameters.length > 0) {
    fail(
      "unsupported-generic",
      `${declarationId} requires monomorphization metadata for pending-operation v1`,
      { declarationId },
    );
  }

  const typeMap = new Map(ir.types.map(type => [type.id, type]));
  const parameters = new Map();
  const captures = [];
  if (declaration.receiver !== null) {
    captures.push(
      compileCapture(
        declaration.receiver,
        "receiver",
        "receiver",
        typeMap,
        parameters,
      ),
    );
  }
  for (const parameter of declaration.parameters) {
    captures.push(
      compileCapture(
        parameter,
        "parameter",
        parameter.name,
        typeMap,
        parameters,
      ),
    );
  }

  return deepFreeze({
    kind: "pending-operation-v1",
    abiVersion: 1,
    declarationId,
    delivery: "promise",
    execution: {
      suspension: "stackless",
      pendingStack: "empty",
      reentry: "same-agent",
    },
    settlement: {
      cardinality: "exactly-once",
      late: "reject",
      cleanup: "reverse-capture-order",
    },
    cancellation: {
      state: "terminal",
      cleanup: "required",
      lateSettlement: "reject",
    },
    shutdown: {
      newOperations: "reject",
      pendingOperations: "cancel",
    },
    captures,
    result: compileDelivery(declaration.result, typeMap, parameters),
    failure: clone(declaration.failure),
  });
};
