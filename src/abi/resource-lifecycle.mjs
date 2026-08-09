import { validateBindingIr } from "../binding-ir/contract.mjs";
import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";

export class ResourceLifecycleGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ResourceLifecycleGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new ResourceLifecycleGenerationError(code, message, details);
};

const deepFreeze = value => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const namedTypeId = typeRef => (typeRef.kind === "named" ? typeRef.id : null);
const clone = value => (value === null || value === undefined ? value : structuredClone(value));

const requireObject = (value, path) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-lifecycle-abi", `${path} must be an object`, { path });
  }
  return value;
};

const requireString = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    fail("invalid-lifecycle-abi", `${path} must be a non-empty string`, { path });
  }
  return value;
};

const representationOf = (typeRef, typeMap, parameters = new Map()) => {
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

const compileSite = (site, role, typeMap, parameters) => {
  if (site === null) return null;
  const representation = representationOf(site.type, typeMap, parameters);
  const typeId = namedTypeId(site.type);
  const plan = {
    role,
    type: clone(site.type),
    representation,
    ownership: site.ownership,
    mutability: site.mutability ?? "immutable",
    lifetime: clone(site.lifetime),
    transport: representation === "identity" ? "handle" : "copy",
    transition:
      site.ownership === "copy"
        ? "copy"
        : site.ownership === "borrow"
          ? "borrow"
          : site.ownership === "lease"
            ? "acquire-lease"
            : "transfer",
  };
  if (typeId !== null) plan.typeId = typeId;
  if (role === "result" && representation === "identity") {
    plan.projection =
      site.ownership === "borrow" ? "canonical-borrow" : "canonical-owner";
  }
  return deepFreeze(plan);
};

const declarationEntry = (abi, declaration) => {
  const entry = abi.declarations?.[declaration.id];
  if (!entry) {
    fail(
      "missing-lifecycle-symbol",
      `${declaration.id} has no private ABI symbol for its lifecycle call`,
      { declaration: declaration.id },
    );
  }
  requireObject(entry, `abi.declarations.${declaration.id}`);
  requireString(entry.symbol, `abi.declarations.${declaration.id}.symbol`);
  if (entry.adapter !== null) {
    fail(
      "unsupported-lifecycle-adapter",
      `${declaration.id} requires an adapter that resource lifecycle v1 cannot lower`,
      { declaration: declaration.id },
    );
  }
  return entry;
};

const compileCall = (declaration, abi, typeMap) => {
  if (declaration.typeParameters.length > 0) {
    fail(
      "unsupported-generic",
      `${declaration.id} requires monomorphization metadata for resource lifecycle v1`,
      { declaration: declaration.id },
    );
  }
  const parameters = new Map(
    declaration.typeParameters.map(parameter => [parameter.id, parameter]),
  );
  const entry = declarationEntry(abi, declaration);
  return deepFreeze({
    declarationId: declaration.id,
    name: declaration.name,
    kind: declaration.kind,
    symbol: entry.symbol,
    receiver: compileSite(declaration.receiver, "receiver", typeMap, parameters),
    parameters: declaration.parameters.map(parameter => ({
      name: parameter.name,
      optional: parameter.optional,
      default: clone(parameter.default),
      ...compileSite(parameter, "parameter", typeMap, parameters),
    })),
    result: compileSite(declaration.result, "result", typeMap, parameters),
    resultMode: declaration.resultMode,
    effects: [...declaration.effects],
    failure: clone(declaration.failure),
  });
};

const validatePropertyPairs = properties => {
  const groups = new Map();
  for (const property of properties) {
    const getter = property.parameters.length === 0 && property.mutability !== "write";
    const setter =
      property.parameters.length === 1 &&
      property.mutability === "write" &&
      property.result.type.kind === "primitive" &&
      property.result.type.name === "unit";
    if (!getter && !setter) {
      fail("unsupported-property-shape", `${property.id} is neither a getter nor setter`, {
        declaration: property.id,
      });
    }
    const role = getter ? "getter" : "setter";
    const group = groups.get(property.name) ?? {};
    if (group[role]) {
      fail("duplicate-property-accessor", `${property.name} has two ${role}s`, {
        property: property.name,
        declarations: [group[role].id, property.id],
      });
    }
    group[role] = property;
    groups.set(property.name, group);
  }
  for (const [name, group] of groups) {
    if (
      group.getter &&
      group.setter &&
      canonicalizeJsonValue(group.getter.result.type, "property.getter.type") !==
        canonicalizeJsonValue(group.setter.parameters[0].type, "property.setter.type")
    ) {
      fail("property-type-mismatch", `${name} getter and setter disagree`, {
        property: name,
        declarations: [group.getter.id, group.setter.id],
      });
    }
  }
};

export const compileResourceLifecycleV1 = (ir, typeId, abi) => {
  validateBindingIr(ir);
  requireObject(abi, "abi");
  requireObject(abi.declarations, "abi.declarations");
  requireObject(abi.resources, "abi.resources");
  if (abi.initialize !== null) requireString(abi.initialize, "abi.initialize");
  const typeMap = new Map(ir.types.map(type => [type.id, type]));
  const type = typeMap.get(typeId);
  if (!type) {
    fail("unknown-resource", `Binding IR has no resource ${typeId}`, { typeId });
  }
  if (type.kind !== "resource" || type.representation !== "identity") {
    fail("not-a-resource", `${typeId} is not an identity-bearing resource`, { typeId });
  }

  const resourceAbi = abi.resources?.[typeId];
  if (!resourceAbi) {
    fail("missing-lifecycle-resource", `${typeId} has no private ABI resource entry`, {
      typeId,
    });
  }
  requireObject(resourceAbi, `abi.resources.${typeId}`);
  if (!new Set(["lean", "host"]).has(resourceAbi.side)) {
    fail("invalid-lifecycle-abi", `${typeId} has an unsupported handle side`, {
      typeId,
      side: resourceAbi.side,
    });
  }
  if (
    !Number.isSafeInteger(resourceAbi.kind) ||
    resourceAbi.kind < 1 ||
    resourceAbi.kind > 0x7f
  ) {
    fail("invalid-lifecycle-abi", `${typeId} has an invalid handle kind`, {
      typeId,
      kind: resourceAbi.kind,
    });
  }
  requireString(resourceAbi.dispose, `abi.resources.${typeId}.dispose`);
  const constructors = ir.declarations.filter(
    declaration =>
      declaration.kind === "constructor" && namedTypeId(declaration.result.type) === typeId,
  );
  if (constructors.length !== 1) {
    fail(
      "resource-constructor-count",
      `${typeId} requires exactly one constructor for resource lifecycle v1`,
      { typeId, actual: constructors.length },
    );
  }
  const methods = ir.declarations.filter(
    declaration =>
      declaration.kind === "method" && namedTypeId(declaration.receiver?.type) === typeId,
  );
  const properties = ir.declarations.filter(
    declaration =>
      declaration.kind === "property" && namedTypeId(declaration.receiver?.type) === typeId,
  );
  validatePropertyPairs(properties);
  const constructor = compileCall(constructors[0], abi, typeMap);
  const compiledMethods = methods.map(method => compileCall(method, abi, typeMap));
  const compiledProperties = properties.map(property => compileCall(property, abi, typeMap));

  if (constructor.result.typeId !== typeId) {
    fail("constructor-result", `${constructor.declarationId} constructs another resource`, {
      typeId,
      actual: constructor.result.typeId,
    });
  }

  return deepFreeze({
    kind: "resource-lifecycle-v1",
    abiVersion: 1,
    typeId,
    resourceKindId: type.resource.kindId,
    initialize: abi.initialize,
    handle: {
      side: resourceAbi.side,
      kind: resourceAbi.kind,
    },
    identity: {
      projection: "canonical-wrapper",
      cache: "weak-per-runtime-token",
    },
    disposal: {
      policy: type.resource.disposal,
      explicit: type.resource.disposal !== "runtime",
      runtimeShutdown: true,
      fallback: type.resource.fallback,
      cycles: type.resource.cycles,
      symbol: resourceAbi.dispose,
    },
    constructor,
    methods: compiledMethods,
    properties: compiledProperties,
  });
};
