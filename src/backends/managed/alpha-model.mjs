import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

export class ManagedBindingGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ManagedBindingGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new ManagedBindingGenerationError(code, message, details);
};

const expectedTypes = Object.freeze({ Payload: "record", Box: "resource", Transform: "callback" });
const expectedDeclarations = Object.freeze({
  box: "constructor",
  read: "method",
  identity: "method",
  roundTrip: "function",
  withCallback: "function",
  makeAdder: "function",
});

const requiredFeatures = Object.freeze([
  "direct-functions",
  "copied-values",
  "owned-resources",
  "host-callbacks",
  "returned-callables",
  "declared-failures",
  "deterministic-close",
]);

const capabilityGaps = Object.freeze([
  Object.freeze({ feature: "asynchronous-results", reason: "The managed POC does not yet project asynchronous Binding IR delivery." }),
  Object.freeze({ feature: "iterators", reason: "The managed POC does not yet project Binding IR iterators." }),
  Object.freeze({ feature: "additional-platforms", reason: "The canonical native artifacts currently target Linux x64 with glibc 2.38 or newer." }),
]);

const assertAlphaRecord = type => {
  const fields = type.fields.map(field => `${field.name}:${field.type.kind === "primitive" ? field.type.name : `${field.type.constructor}<${field.type.arguments[0]?.name}>`}`);
  const expected = ["enabled:bool", "count:uint32", "label:string", "bytes:bytes", "values:array<uint32>"];
  if (JSON.stringify(fields) !== JSON.stringify(expected)) {
    fail("unsupported-managed-record", "the managed POC requires the canonical Alpha.Payload field contract", { actual: fields, expected });
  }
};

export const compileManagedAlphaModel = (ir, target) => {
  if (!new Set(["dotnet", "jvm", "ruby"]).has(target)) fail("unknown-managed-target", `unknown managed target ${target}`);
  validateBindingIr(ir);
  for (const [name, kind] of Object.entries(expectedTypes)) {
    const type = ir.types.find(item => item.name === name);
    if (!type || type.kind !== kind) fail("unsupported-managed-type", `the managed POC requires ${name} as a ${kind}`);
    if (type.typeParameters.length !== 0) fail("unsupported-generic-type", `${type.id} requires a generic managed type declaration`);
    if (name === "Payload") assertAlphaRecord(type);
    if (name === "Box" && (type.resource.disposal !== "required" || type.representation !== "identity")) {
      fail("unsupported-managed-resource", "Box must be an explicitly disposed identity resource");
    }
    if (name === "Transform" && (type.callable.resultMode !== "value" || type.callable.parameters.length !== 1)) {
      fail("unsupported-managed-callback", "Transform must be the canonical synchronous uint32 callback");
    }
  }
  for (const [name, kind] of Object.entries(expectedDeclarations)) {
    const declarations = ir.declarations.filter(item => item.name === name && item.kind === kind);
    if (declarations.length !== 1) fail("unsupported-managed-declaration", `the managed POC requires one ${kind} named ${name}`);
    if (declarations[0].typeParameters.length !== 0) fail("unsupported-generic-declaration", `${declarations[0].id} requires finite generic projection work`);
    if (declarations[0].resultMode !== "value") fail("unsupported-result-mode", `${declarations[0].id} is not synchronous`);
  }
  if (ir.errors.some(error => error.payload !== null)) fail("unsupported-error-payload", "the managed POC does not yet preserve error payloads");
  return Object.freeze({
    target,
    component: Object.freeze({ ...ir.component }),
    bindingIrSha256: hashBindingIr(ir),
    requiredFeatures,
    capabilityGaps,
  });
};

export const managedBindingManifest = ({ model, generator, files, publicFiles, internalFiles, packageFiles = [] }) => Object.freeze({
  schemaVersion: 1,
  component: model.component.id,
  bindingIrSha256: model.bindingIrSha256,
  generator: Object.freeze({ id: `lean-wasm/${generator}`, version: 1 }),
  target: model.target,
  exports: [
    "Payload", "Transform", "Box", "OwnedTransform", "Alpha",
    "LeanBridgeException", "DisposedResourceException", "CallbackThrewException",
  ],
  supportedFeatures: [...model.requiredFeatures],
  capabilityGaps: model.capabilityGaps.map(gap => ({ ...gap })),
  publicFiles: [...publicFiles],
  internalFiles: [...internalFiles],
  packageFiles: [...packageFiles],
  files: [...files, "binding-manifest.json"],
});
