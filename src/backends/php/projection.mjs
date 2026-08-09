import { compileFiniteGenericSpecializations } from "../../abi/generic-specialization.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

export class PhpProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpProjectionError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpProjectionError(code, message, details);
};

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const clone = value => structuredClone(value);

const words = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean);

const pascal = value => words(value)
  .map(word => `${word[0].toUpperCase()}${word.slice(1)}`)
  .join("");

const camel = value => {
  const name = pascal(value);
  return name.length === 0 ? name : `${name[0].toLowerCase()}${name.slice(1)}`;
};

const fqcn = (namespace, name) => `${namespace}\\${name}`;

const primitiveProjection = (name, namespace) => {
  const fixedIntegers = new Map([
    ["uint8", [0, 0xff]],
    ["uint16", [0, 0xffff]],
    ["uint32", [0, 0xffffffff]],
    ["int8", [-0x80, 0x7f]],
    ["int16", [-0x8000, 0x7fff]],
    ["int32", [-0x80000000, 0x7fffffff]],
  ]);
  if (name === "unit") {
    return { kind: "primitive", binding: name, phpType: "void", phpDocType: "void", validation: null, capabilities: [] };
  }
  if (name === "bool") {
    return { kind: "primitive", binding: name, phpType: "bool", phpDocType: "bool", validation: null, capabilities: [] };
  }
  if (fixedIntegers.has(name)) {
    const [minimum, maximum] = fixedIntegers.get(name);
    return {
      kind: "primitive",
      binding: name,
      phpType: "int",
      phpDocType: `int<${minimum}, ${maximum}>`,
      validation: { kind: "integer-range", minimum, maximum },
      capabilities: ["checked-integer-ranges-v1"],
    };
  }
  if (name === "int64") {
    return {
      kind: "primitive",
      binding: name,
      phpType: "int",
      phpDocType: "int",
      validation: { kind: "php-int-bits", minimum: 64 },
      capabilities: ["php-int64-v1"],
    };
  }
  if (new Set(["uint64", "nat", "int"]).has(name)) {
    return {
      kind: "primitive",
      binding: name,
      phpType: `\\${fqcn(namespace, "BigInteger")}`,
      phpDocType: `\\${fqcn(namespace, "BigInteger")}`,
      validation: { kind: "lean-integer", signed: name !== "uint64" && name !== "nat" },
      capabilities: ["big-integer-value-v1"],
    };
  }
  if (new Set(["float32", "float64"]).has(name)) {
    return {
      kind: "primitive",
      binding: name,
      phpType: "float",
      phpDocType: "float",
      validation: { kind: "floating-point", bits: name === "float32" ? 32 : 64 },
      capabilities: ["checked-float-width-v1"],
    };
  }
  if (name === "string") {
    return { kind: "primitive", binding: name, phpType: "string", phpDocType: "string", validation: { kind: "utf-8" }, capabilities: ["utf8-string-v1"] };
  }
  if (name === "bytes") {
    return {
      kind: "primitive",
      binding: name,
      phpType: `\\${fqcn(namespace, "Bytes")}`,
      phpDocType: `\\${fqcn(namespace, "Bytes")}`,
      validation: null,
      capabilities: ["bytes-value-v1"],
    };
  }
  fail("unsupported-primitive", `PHP projection does not define ${name}`, { primitive: name });
};

const projectTypeRef = (typeRef, typeMap, namespace) => {
  if (typeRef.kind === "primitive") return primitiveProjection(typeRef.name, namespace);
  if (typeRef.kind === "parameter") {
    return {
      kind: "parameter",
      binding: typeRef.id,
      phpType: "mixed",
      phpDocType: typeRef.id,
      validation: null,
      capabilities: ["finite-generic-adapter-v1"],
    };
  }
  if (typeRef.kind === "named") {
    const type = typeMap.get(typeRef.id);
    if (!type) fail("unknown-type", `PHP projection cannot resolve ${typeRef.id}`, { type: typeRef.id });
    if (type.kind === "alias") {
      const target = projectTypeRef(type.target, typeMap, namespace);
      return { ...target, binding: typeRef.id, alias: fqcn(namespace, type.name) };
    }
    if (type.kind === "callback") {
      return {
        kind: "callback",
        binding: typeRef.id,
        phpType: "callable",
        phpDocType: `\\${fqcn(namespace, type.name)}|callable`,
        class: fqcn(namespace, type.name),
        validation: { kind: "callable" },
        capabilities: ["callable-adapter-v1"],
      };
    }
    return {
      kind: type.kind,
      binding: typeRef.id,
      phpType: `\\${fqcn(namespace, type.name)}`,
      phpDocType: `\\${fqcn(namespace, type.name)}`,
      class: fqcn(namespace, type.name),
      validation: { kind: type.kind === "resource" ? "resource-class" : "value-class" },
      capabilities: [type.kind === "resource" ? "canonical-object-identity-v1" : "copied-value-object-v1"],
    };
  }
  if (typeRef.kind === "apply") {
    const argumentsProjected = typeRef.arguments.map(argument => projectTypeRef(argument, typeMap, namespace));
    const capabilities = [...new Set(argumentsProjected.flatMap(argument => argument.capabilities))];
    if (typeRef.constructor === "array") {
      return {
        kind: "application",
        binding: "array",
        phpType: "array",
        phpDocType: `list<${argumentsProjected[0].phpDocType}>`,
        arguments: argumentsProjected,
        validation: { kind: "list" },
        capabilities: [...capabilities, "typed-list-v1"],
      };
    }
    if (typeRef.constructor === "option") {
      return {
        kind: "application",
        binding: "option",
        phpType: `${argumentsProjected[0].phpType}|null`,
        phpDocType: `${argumentsProjected[0].phpDocType}|null`,
        arguments: argumentsProjected,
        validation: null,
        capabilities,
      };
    }
    if (typeRef.constructor === "result") {
      return {
        kind: "application",
        binding: "result",
        phpType: `\\${fqcn(namespace, "Result")}`,
        phpDocType: `\\${fqcn(namespace, "Result")}<${argumentsProjected.map(argument => argument.phpDocType).join(", ")}>`,
        arguments: argumentsProjected,
        validation: { kind: "result-object" },
        capabilities: [...capabilities, "result-value-v1"],
      };
    }
    if (typeRef.constructor === "tuple") {
      return {
        kind: "application",
        binding: "tuple",
        phpType: "array",
        phpDocType: `array{${argumentsProjected.map(argument => argument.phpDocType).join(", ")}}`,
        arguments: argumentsProjected,
        validation: { kind: "tuple", length: argumentsProjected.length },
        capabilities: [...capabilities, "typed-tuple-v1"],
      };
    }
  }
  fail("unsupported-type", "PHP projection received an unsupported type reference", { typeRef });
};

const identityType = (namespace, projectedType, role, ownership) => {
  if (!new Set(["resource", "callback"]).has(projectedType.kind)) return projectedType.phpType;
  if (projectedType.kind === "callback" && role === "parameter") return "callable";
  if (role === "result" && ownership !== "copy") return `\\${projectedType.class}`;
  return projectedType.phpType;
};

const transportType = (namespace, projectedType, role) => {
  if (projectedType.kind === "resource") return `\\${fqcn(namespace, "Internal\\Identity")}`;
  if (projectedType.kind === "callback") {
    return role === "parameter" ? "callable" : `\\${fqcn(namespace, "Internal\\Identity")}`;
  }
  return projectedType.phpType;
};

const projectSite = (site, role, typeMap, namespace) => {
  if (site === null) return null;
  const type = projectTypeRef(site.type, typeMap, namespace);
  return {
    ...(site.name ? { name: site.name } : {}),
    type,
    publicType: identityType(namespace, type, role, site.ownership),
    transportType: transportType(namespace, type, role),
    ownership: site.ownership,
    lifetime: clone(site.lifetime),
    ...(site.mutability ? { mutability: site.mutability } : {}),
    ...(typeof site.optional === "boolean" ? { optional: site.optional } : {}),
    ...(site.default !== undefined ? { default: clone(site.default) } : {}),
  };
};

const deliveryProjection = (resultMode, resultType, namespace) => {
  if (resultMode === "value") return { kind: "value", phpType: resultType };
  if (resultMode === "promise") {
    return {
      kind: "awaitable",
      phpType: `\\${fqcn(namespace, "Awaitable")}`,
      phpDocType: `\\${fqcn(namespace, "Awaitable")}<${resultType}>`,
      capability: "bridge-awaitable-v1",
    };
  }
  if (resultMode === "iterator") {
    return {
      kind: "iterator",
      phpType: "\\Traversable",
      phpDocType: `\\Traversable<int, ${resultType}>`,
      capability: "php-traversable-v1",
    };
  }
  if (resultMode === "async-iterator") {
    return {
      kind: "async-iterator",
      phpType: `\\${fqcn(namespace, "AsyncIterator")}`,
      phpDocType: `\\${fqcn(namespace, "AsyncIterator")}<${resultType}>`,
      capability: "bridge-async-iterator-v1",
    };
  }
  fail("unsupported-result-mode", `PHP projection does not define ${resultMode}`, { resultMode });
};

const operationName = declaration => camel(declaration.id.replace(":", " "));

const publicTarget = (declaration, typeMap, namespace) => {
  if (declaration.kind === "constructor") {
    const type = typeMap.get(declaration.result.type.id);
    return { kind: "constructor", class: fqcn(namespace, type.name), name: "__construct" };
  }
  if (new Set(["method", "property"]).has(declaration.kind)) {
    const type = typeMap.get(declaration.receiver.type.id);
    return { kind: declaration.kind, class: fqcn(namespace, type.name), name: declaration.name };
  }
  return { kind: "function", namespace, name: declaration.name };
};

const declarationCapabilities = operation => {
  const capabilities = new Set(["typed-operation-interface-v1"]);
  for (const site of [operation.receiver, ...operation.parameters, operation.result].filter(Boolean)) {
    for (const capability of site.type.capabilities) capabilities.add(capability);
    if (site.ownership === "borrow") capabilities.add(`borrow-${site.lifetime.scope}-v1`);
    if (site.ownership === "lease") capabilities.add(`lease-${site.lifetime.scope}-v1`);
    if (site.ownership === "transfer") capabilities.add(`transfer-${site.lifetime.scope}-v1`);
  }
  if (operation.failure.errors.length > 0) capabilities.add("named-exceptions-v1");
  if (operation.delivery.capability) capabilities.add(operation.delivery.capability);
  for (const capability of operation.capabilities) capabilities.add(capability);
  return [...capabilities].sort();
};

const projectType = (type, typeMap, namespace) => {
  const base = {
    id: type.id,
    name: type.name,
    fqcn: fqcn(namespace, type.name),
    sourceKind: type.kind,
    representation: type.representation,
    mutability: type.mutability,
    documentation: clone(type.documentation),
    assurance: clone(type.assurance),
  };
  if (type.kind === "record") {
    const fields = type.fields.map(field => ({
      name: field.name,
      type: projectTypeRef(field.type, typeMap, namespace),
      readonly: field.mutability !== "write",
      documentation: clone(field.documentation),
    }));
    return {
      ...base,
      projection: "value-object",
      readonly: type.mutability === "immutable" && fields.every(field => field.readonly),
      fields,
      typeParameters: clone(type.typeParameters),
    };
  }
  if (type.kind === "resource") {
    return {
      ...base,
      projection: "resource-object",
      identity: "canonical-per-runtime",
      closeMethod: "close",
      disposal: type.resource.disposal,
      fallback: type.resource.fallback,
      cycles: type.resource.cycles,
      typeParameters: clone(type.typeParameters),
    };
  }
  if (type.kind === "callback") {
    const parameters = type.callable.parameters.map(parameter => projectSite(parameter, "parameter", typeMap, namespace));
    const result = projectSite(type.callable.result, "result", typeMap, namespace);
    return {
      ...base,
      projection: "invokable-object",
      accepts: "callable",
      closeMethod: "close",
      invocation: type.callable.invocation,
      reentry: type.callable.reentry,
      selfDisposal: type.callable.selfDisposal,
      parameters,
      result,
      delivery: deliveryProjection(type.callable.resultMode, result.publicType, namespace),
      effects: clone(type.callable.effects),
      failure: clone(type.callable.failure),
      typeParameters: clone(type.typeParameters),
    };
  }
  return {
    ...base,
    projection: "phpdoc-alias",
    target: projectTypeRef(type.target, typeMap, namespace),
    typeParameters: clone(type.typeParameters),
  };
};

const projectOperation = (declaration, typeMap, namespace) => {
  const receiver = projectSite(declaration.receiver, "receiver", typeMap, namespace);
  const parameters = declaration.parameters.map(parameter => projectSite(parameter, "parameter", typeMap, namespace));
  const result = projectSite(declaration.result, "result", typeMap, namespace);
  let specializations = [];
  if (declaration.typeParameters.length > 0) {
    specializations = compileFiniteGenericSpecializations(declaration).map(branch => clone(branch));
  }
  const operation = {
    id: declaration.id,
    transportMethod: operationName(declaration),
    public: publicTarget(declaration, typeMap, namespace),
    overloadKey: declaration.overloadKey,
    specializations,
    receiver,
    parameters,
    result,
    delivery: deliveryProjection(declaration.resultMode, result.publicType, namespace),
    mutability: declaration.mutability,
    effects: clone(declaration.effects),
    failure: clone(declaration.failure),
    capabilities: clone(declaration.capabilities),
    documentation: clone(declaration.documentation),
    assurance: clone(declaration.assurance),
  };
  return { ...operation, requiredCapabilities: declarationCapabilities(operation) };
};

const lifecycleOperations = (types, namespace) => types.flatMap(type => {
  if (type.projection === "resource-object") {
    return [{
      kind: "resource-close",
      type: type.id,
      publicMethod: "close",
      transportMethod: `${camel(type.name)}Close`,
      parameterType: `\\${fqcn(namespace, "Internal\\Identity")}`,
      idempotent: true,
      failure: { mode: "none", errors: [], unexpected: "poison-runtime" },
      requiredCapabilities: ["deterministic-close-v1"],
    }];
  }
  if (type.projection === "invokable-object") {
    return [
      {
        kind: "callable-call",
        type: type.id,
        publicMethod: "__invoke",
        transportMethod: `${camel(type.name)}Call`,
        receiverType: `\\${fqcn(namespace, "Internal\\Identity")}`,
        parameters: clone(type.parameters),
        result: clone(type.result),
        delivery: clone(type.delivery),
        failure: clone(type.failure),
        requiredCapabilities: ["callable-adapter-v1"],
      },
      {
        kind: "callable-close",
        type: type.id,
        publicMethod: "close",
        transportMethod: `${camel(type.name)}Close`,
        parameterType: `\\${fqcn(namespace, "Internal\\Identity")}`,
        idempotent: true,
        failure: { mode: "none", errors: [], unexpected: "poison-runtime" },
        requiredCapabilities: ["deterministic-close-v1"],
      },
    ];
  }
  return [];
});

const collectProjectedTypeCapabilities = type => {
  const capabilities = new Set();
  const visit = value => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (Array.isArray(value.capabilities)) {
      for (const capability of value.capabilities) capabilities.add(capability);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(type);
  return capabilities;
};

const assertUniqueTransportMethods = (operations, lifecycle) => {
  const methods = new Map();
  for (const operation of [...operations, ...lifecycle]) {
    const name = operation.transportMethod;
    if (methods.has(name)) {
      fail("duplicate-transport-method", `${name} represents two PHP transport operations`, {
        method: name,
        declarations: [methods.get(name), operation.id ?? operation.type],
      });
    }
    methods.set(name, operation.id ?? operation.type);
  }
};

export const compilePhpProjection = (ir, { namespace } = {}) => {
  validateBindingIr(ir);
  const phpNamespace = namespace ?? pascal(ir.component.name);
  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\\[A-Za-z_][A-Za-z0-9_]*)*$/.test(phpNamespace)) {
    fail("invalid-namespace", "PHP projection requires a valid namespace", {
      component: ir.component.id,
      namespace: phpNamespace,
    });
  }
  const typeMap = new Map(ir.types.map(type => [type.id, type]));
  const types = ir.types.map(type => projectType(type, typeMap, phpNamespace));
  const operations = ir.declarations.map(declaration => projectOperation(declaration, typeMap, phpNamespace));
  const lifecycle = lifecycleOperations(types, phpNamespace);
  assertUniqueTransportMethods(operations, lifecycle);
  const requiredCapabilities = new Set([
    "php-8.2-v1",
    "shared-runtime-v1",
    "typed-operation-interface-v1",
    "weak-canonical-object-cache-v1",
  ]);
  for (const operation of operations) {
    for (const capability of operation.requiredCapabilities) requiredCapabilities.add(capability);
  }
  for (const type of types) {
    for (const capability of collectProjectedTypeCapabilities(type)) requiredCapabilities.add(capability);
  }
  for (const operation of lifecycle) {
    for (const capability of operation.requiredCapabilities) requiredCapabilities.add(capability);
  }
  return deepFreeze({
    schemaVersion: 1,
    component: clone(ir.component),
    bindingIrSha256: hashBindingIr(ir),
    package: {
      composerName: ir.component.id.slice(0, ir.component.id.lastIndexOf("@")),
      namespace: phpNamespace,
      minimumPhp: "8.2",
    },
    conventions: {
      bytes: fqcn(phpNamespace, "Bytes"),
      bigInteger: fqcn(phpNamespace, "BigInteger"),
      awaitable: fqcn(phpNamespace, "Awaitable"),
      asyncIterator: fqcn(phpNamespace, "AsyncIterator"),
      closeMethod: "close",
      iterator: "Traversable",
    },
    identity: {
      publicKey: "opaque runtime identity",
      phpCache: "identity to WeakReference<object>",
      reverseLookup: "WeakMap<object, identity>",
      scope: "one shared Lean runtime",
      explicitClose: true,
      finalizationRole: "fallback-only",
    },
    transport: {
      interface: fqcn(phpNamespace, "Internal\\Transport"),
      identity: fqcn(phpNamespace, "Internal\\Identity"),
      visibility: "internal",
      dispatch: "one-typed-method-per-declaration",
    },
    types,
    errors: ir.errors.map(error => ({
      id: error.id,
      name: error.name,
      fqcn: fqcn(phpNamespace, error.name),
      category: error.category,
      payload: error.payload === null ? null : projectTypeRef(error.payload, typeMap, phpNamespace),
      documentation: clone(error.documentation),
    })),
    operations,
    lifecycle,
    requiredCapabilities: [...requiredCapabilities].sort(),
    assurance: clone(ir.assurance),
    documentation: clone(ir.documentation),
  });
};

export const compilePhpTransportManifest = (projection, profile) => {
  if (profile === null || typeof profile !== "object" || Array.isArray(profile)) {
    fail("invalid-transport-profile", "PHP transport profile must be an object");
  }
  if (typeof profile.id !== "string" || profile.id.length === 0 || !Array.isArray(profile.capabilities)) {
    fail("invalid-transport-profile", "PHP transport profile requires id and capabilities", { profile });
  }
  const capabilities = [...new Set(profile.capabilities)].sort();
  if (capabilities.some(capability => typeof capability !== "string" || capability.length === 0)) {
    fail("invalid-transport-profile", "PHP transport capabilities must be non-empty strings", { profile: profile.id });
  }
  const supported = new Set(capabilities);
  const capabilityGaps = projection.requiredCapabilities
    .filter(capability => !supported.has(capability))
    .map(capability => ({
      capability,
      blocking: true,
      reason: `${profile.id} does not implement ${capability}`,
    }));
  return deepFreeze({
    schemaVersion: 1,
    component: clone(projection.component),
    bindingIrSha256: projection.bindingIrSha256,
    transport: profile.id,
    capabilities,
    supported: capabilityGaps.length === 0,
    capabilityGaps,
  });
};

export const assertPhpTransportSupported = manifest => {
  if (!manifest.supported) {
    fail("unsupported-transport", `${manifest.transport} cannot publish ${manifest.component.id}`, {
      transport: manifest.transport,
      component: manifest.component.id,
      capabilityGaps: clone(manifest.capabilityGaps),
    });
  }
  return manifest;
};
