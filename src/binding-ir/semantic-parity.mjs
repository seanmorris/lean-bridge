import { createHash } from "node:crypto";

import { compileFiniteGenericSpecializations } from "../abi/generic-specialization.mjs";
import { generateCBindingPackage } from "../backends/c/generate.mjs";
import { generateJavaScriptPackage } from "../backends/javascript/generate.mjs";
import { generatePhpBindingPackage } from "../backends/php/generate.mjs";
import { generatePythonBindingPackage } from "../backends/python/generate.mjs";
import { generateRustBindingPackage } from "../backends/rust/generate.mjs";
import { canonicalizeJsonValue, hashBindingIr } from "./canonical.mjs";
import { validateBindingIr } from "./contract.mjs";

export class BindingSemanticParityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BindingSemanticParityError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new BindingSemanticParityError(code, message, details);
};

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const clone = value => structuredClone(value);
const sha256 = value => createHash("sha256").update(value, "utf8").digest("hex");

const BACKENDS = Object.freeze({
  javascript: Object.freeze({
    generate: generateJavaScriptPackage,
    values: "typed objects",
    resources: "classes",
    callbacks: "functions",
    errors: "exceptions",
    cleanup: "dispose and queued finalization",
    delivery: Object.freeze({
      value: "value",
      promise: "Promise",
      iterator: "Iterable",
      "async-iterator": "AsyncIterable",
    }),
  }),
  php: Object.freeze({
    generate: generatePhpBindingPackage,
    values: "readonly value objects",
    resources: "canonical classes",
    callbacks: "callables and invokable objects",
    errors: "exceptions",
    cleanup: "close and destructor fallback",
    delivery: Object.freeze({
      value: "value",
      promise: "Awaitable",
      iterator: "Traversable",
      "async-iterator": "AsyncIterator",
    }),
  }),
  python: Object.freeze({
    generate: generatePythonBindingPackage,
    values: "frozen dataclasses",
    resources: "classes and context managers",
    callbacks: "callables",
    errors: "exceptions",
    cleanup: "close, context management, and finalization",
    delivery: Object.freeze({
      value: "value",
      promise: "Awaitable",
      iterator: "Iterator",
      "async-iterator": "AsyncIterator",
    }),
  }),
  c: Object.freeze({
    generate: generateCBindingPackage,
    values: "typed structs",
    resources: "opaque structs",
    callbacks: "function pointers with context",
    errors: "status and typed error output",
    cleanup: "generated clear and dispose functions",
    delivery: Object.freeze({ value: "value and output parameter" }),
  }),
  rust: Object.freeze({
    generate: generateRustBindingPackage,
    values: "owned structs",
    resources: "structs with borrowed receivers",
    callbacks: "closures and callable resources",
    errors: "Result",
    cleanup: "Drop",
    delivery: Object.freeze({ value: "value" }),
  }),
});

const assuranceRecords = (ids, assuranceById) => ids.map(id => {
  const claim = assuranceById.get(id);
  if (!claim) fail("unknown-assurance", `semantic contract cannot resolve ${id}`, { assurance: id });
  return clone(claim);
});

const callableSite = site => site === null ? null : ({
  type: clone(site.type),
  ownership: site.ownership,
  lifetime: clone(site.lifetime),
  ...(site.mutability ? { mutability: site.mutability } : {}),
  ...(site.name ? { name: site.name } : {}),
  ...(typeof site.optional === "boolean" ? { optional: site.optional } : {}),
  ...(site.default !== undefined ? { default: clone(site.default) } : {}),
});

const typeContract = (type, assuranceById) => ({
  id: type.id,
  name: type.name,
  kind: type.kind,
  representation: type.representation,
  mutability: type.mutability,
  typeParameters: clone(type.typeParameters),
  fields: clone(type.fields),
  target: clone(type.target),
  resource: clone(type.resource),
  callable: clone(type.callable),
  documentation: clone(type.documentation),
  source: clone(type.source),
  assurance: assuranceRecords(type.assurance, assuranceById),
});

const declarationContract = (declaration, assuranceById) => ({
  id: declaration.id,
  name: declaration.name,
  kind: declaration.kind,
  overloadKey: declaration.overloadKey,
  callable: {
    typeParameters: clone(declaration.typeParameters),
    receiver: callableSite(declaration.receiver),
    parameters: declaration.parameters.map(callableSite),
    result: callableSite(declaration.result),
    resultMode: declaration.resultMode,
  },
  genericInstantiations: declaration.typeParameters.length === 0
    ? []
    : compileFiniteGenericSpecializations(declaration).map(branch => ({
      id: branch.id,
      type: clone(branch.type),
    })),
  mutability: declaration.mutability,
  effects: clone(declaration.effects),
  failure: clone(declaration.failure),
  capabilities: clone(declaration.capabilities),
  documentation: clone(declaration.documentation),
  source: clone(declaration.source),
  assurance: assuranceRecords(declaration.assurance, assuranceById),
});

export const compileBindingSemanticContract = ir => {
  validateBindingIr(ir);
  const assuranceById = new Map(ir.assurance.map(claim => [claim.id, claim]));
  return deepFreeze({
    schemaVersion: 1,
    component: clone(ir.component),
    bindingIrSha256: hashBindingIr(ir),
    documentation: clone(ir.documentation),
    types: ir.types.map(type => typeContract(type, assuranceById)),
    declarations: ir.declarations.map(declaration => declarationContract(declaration, assuranceById)),
    errors: clone(ir.errors),
    assurance: clone(ir.assurance),
  });
};

export const hashBindingSemanticContract = contract =>
  sha256(canonicalizeJsonValue(contract, "binding-semantic-contract"));

const parseManifest = (backend, files) => {
  try {
    return JSON.parse(files["binding-manifest.json"]);
  } catch {
    fail("invalid-package-manifest", `${backend} did not generate a valid binding manifest`, { backend });
  }
};

const deliveryModes = contract => [...new Set(
  contract.declarations.map(declaration => declaration.callable.resultMode),
)].sort();

export const compileCrossLanguageSemanticParity = (
  ir,
  { backends = Object.keys(BACKENDS) } = {},
) => {
  const contract = compileBindingSemanticContract(ir);
  const semanticContractSha256 = hashBindingSemanticContract(contract);
  const requested = [...new Set(backends)];
  if (requested.length < 2) {
    fail("insufficient-backends", "semantic parity requires at least two target languages", {
      backends: requested,
    });
  }
  const packages = requested.map(backend => {
    const profile = BACKENDS[backend];
    if (!profile) fail("unknown-backend", `semantic parity has no ${backend} backend`, { backend });
    const files = profile.generate(ir);
    const manifest = parseManifest(backend, files);
    if (manifest.component !== ir.component.id || manifest.bindingIrSha256 !== contract.bindingIrSha256) {
      fail("package-contract-drift", `${backend} package does not identify the semantic fixture`, {
        backend,
        expectedComponent: ir.component.id,
        actualComponent: manifest.component,
        expectedBindingIrSha256: contract.bindingIrSha256,
        actualBindingIrSha256: manifest.bindingIrSha256,
      });
    }
    const unsupportedDelivery = deliveryModes(contract).filter(mode => !(mode in profile.delivery));
    if (unsupportedDelivery.length > 0) {
      fail("unreported-delivery-gap", `${backend} generated a package without a delivery mapping`, {
        backend,
        resultModes: unsupportedDelivery,
      });
    }
    return {
      backend,
      generator: clone(manifest.generator),
      bindingIrSha256: manifest.bindingIrSha256,
      semanticContractSha256,
      exports: clone(manifest.exports),
      capabilityGaps: clone(manifest.capabilityGaps ?? []),
      projection: {
        values: profile.values,
        resources: profile.resources,
        callbacks: profile.callbacks,
        errors: profile.errors,
        cleanup: profile.cleanup,
        delivery: Object.fromEntries(deliveryModes(contract).map(mode => [mode, profile.delivery[mode]])),
      },
    };
  });
  return deepFreeze({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: contract.bindingIrSha256,
    semanticContractSha256,
    contract,
    packages,
  });
};

export const supportedSemanticParityBackends = Object.freeze(Object.keys(BACKENDS));
