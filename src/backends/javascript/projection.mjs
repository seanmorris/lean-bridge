import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import {
  ValueFrameGenerationError,
  compileValueFrameV1,
} from "../../abi/value-frame.mjs";
import {
  ResourceLifecycleGenerationError,
  compileResourceLifecycleV1,
} from "../../abi/resource-lifecycle.mjs";
import {
  PendingOperationGenerationError,
  compilePendingOperationV1,
} from "../../abi/pending-operation.mjs";
import {
  CallbackSignatureGenerationError,
  compileCallbackSignatureV1,
} from "../../abi/callback-signature.mjs";
import { analyzeJavaScriptCoverage } from "./coverage.mjs";

export class JavaScriptProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "JavaScriptProjectionError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new JavaScriptProjectionError(code, message, details);
};

const object = (value, path) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("invalid-private-abi", `${path} must be an object`, { path });
  }
};

const exactKeys = (value, required, path) => {
  object(value, path);
  const allowed = new Set(required);
  const missing = required.filter(key => !(key in value));
  if (missing.length > 0) {
    fail("invalid-private-abi", `${path} is missing ${missing.join(", ")}`, {
      path,
      missing,
    });
  }
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    fail("invalid-private-abi", `${path} contains unknown ${unknown.join(", ")}`, {
      path,
      unknown,
    });
  }
};

const nonemptyString = (value, path) => {
  if (typeof value !== "string" || value.length === 0) {
    fail("invalid-private-abi", `${path} must be a non-empty string`, { path });
  }
};

const validateAdapter = (adapter, path) => {
  if (adapter === null) return;
  if (adapter.kind === "value-frame-v1") {
    exactKeys(
      adapter,
      ["kind", "abiVersion", "maxCopyBytes", "maxArrayLength"],
      path,
    );
    if (adapter.abiVersion !== 1) {
      fail("unsupported-private-adapter", `${path} requests an unsupported adapter`, {
        path,
        kind: adapter.kind,
        abiVersion: adapter.abiVersion,
      });
    }
    for (const key of ["maxCopyBytes", "maxArrayLength"]) {
      if (!Number.isSafeInteger(adapter[key]) || adapter[key] < 1) {
        fail("invalid-private-abi", `${path}.${key} must be a positive integer`, {
          path: `${path}.${key}`,
        });
      }
    }
    return;
  }
  if (adapter.kind === "pending-operation-v1") {
    exactKeys(adapter, ["kind", "abiVersion", "cancel"], path);
    nonemptyString(adapter.cancel, `${path}.cancel`);
    if (adapter.abiVersion === 1) return;
  }
  if (adapter.kind === "callback-call-v1") {
    exactKeys(
      adapter,
      ["kind", "abiVersion", "callbackParameter", "maxDepth"],
      path,
    );
    nonemptyString(adapter.callbackParameter, `${path}.callbackParameter`);
    if (
      adapter.abiVersion === 1 &&
      Number.isSafeInteger(adapter.maxDepth) &&
      adapter.maxDepth >= 1 &&
      adapter.maxDepth <= 0xffff
    ) {
      return;
    }
  }
  if (adapter.kind === "callback-result-v1") {
    exactKeys(adapter, ["kind", "abiVersion", "maxDepth"], path);
    if (
      adapter.abiVersion === 1 &&
      Number.isSafeInteger(adapter.maxDepth) &&
      adapter.maxDepth >= 1 &&
      adapter.maxDepth <= 0xffff
    ) {
      return;
    }
  }
  fail("unsupported-private-adapter", `${path} requests an unsupported adapter`, {
    path,
    kind: adapter.kind,
    abiVersion: adapter.abiVersion,
  });
};

const compileAdapter = (ir, declaration, adapter, abi) => {
  if (adapter === null) return undefined;
  try {
    if (adapter.kind === "value-frame-v1") {
      return compileValueFrameV1(ir, declaration.id, adapter);
    }
    if (adapter.kind === "callback-call-v1") {
      const callbackIndex = declaration.parameters.findIndex(
        parameter => parameter.name === adapter.callbackParameter,
      );
      const parameter = declaration.parameters[callbackIndex];
      if (callbackIndex < 0 || parameter?.type.kind !== "named") {
        fail(
          "invalid-callback-parameter",
          `${declaration.id} has no named callback parameter ${adapter.callbackParameter}`,
          { declaration: declaration.id, parameter: adapter.callbackParameter },
        );
      }
      const signature = compileCallbackSignatureV1(
        ir,
        parameter.type.id,
        { maxDepth: adapter.maxDepth },
      );
      if (
        parameter.ownership !== "borrow" ||
        parameter.lifetime?.scope !== "call" ||
        signature.resultMode !== "value"
      ) {
        fail(
          "unsupported-callback-lifecycle",
          `${declaration.id}.${parameter.name} must be a synchronous callback borrowed for one call`,
          { declaration: declaration.id, parameter: parameter.name },
        );
      }
      return Object.freeze({
        kind: "callback-call-v1",
        abiVersion: 1,
        declarationId: declaration.id,
        callbackParameter: parameter.name,
        callbackIndex,
        signature,
      });
    }
    if (adapter.kind === "callback-result-v1") {
      const typeId = namedTypeId(declaration.result.type);
      const callbackType = ir.types.find(type => type.id === typeId);
      const transport = abi.callbacks[typeId];
      if (callbackType?.kind !== "callback" || !transport) {
        fail(
          "invalid-callback-result",
          `${declaration.id} does not return a callback with a private transport`,
          { declaration: declaration.id, typeId },
        );
      }
      const signature = compileCallbackSignatureV1(
        ir,
        typeId,
        { maxDepth: adapter.maxDepth },
      );
      if (
        declaration.resultMode !== "value" ||
        declaration.result.ownership !== "lease" ||
        declaration.result.lifetime?.scope !== "explicit" ||
        signature.resultMode !== "value"
      ) {
        fail(
          "unsupported-callback-lifecycle",
          `${declaration.id} must return a synchronous callback with an explicit lease`,
          { declaration: declaration.id },
        );
      }
      return Object.freeze({
        kind: "callback-result-v1",
        abiVersion: 1,
        declarationId: declaration.id,
        signature,
        handle: Object.freeze({ side: transport.side, kind: transport.kind }),
        callSymbol: transport.call,
        disposal: Object.freeze({
          explicit: true,
          fallback: "queued-finalizer",
          symbol: transport.dispose,
        }),
      });
    }
    return Object.freeze({
      ...compilePendingOperationV1(ir, declaration.id),
      cancelSymbol: adapter.cancel,
    });
  } catch (error) {
    if (
      !(error instanceof ValueFrameGenerationError) &&
      !(error instanceof PendingOperationGenerationError) &&
      !(error instanceof CallbackSignatureGenerationError)
    ) {
      throw error;
    }
    fail(error.code, error.message, error.details);
  }
};

const validatePrivateAbi = (ir, abi) => {
  exactKeys(
    abi,
    ["schemaVersion", "initialize", "declarations", "resources", "callbacks"],
    "abi",
  );
  if (abi.schemaVersion !== 1) {
    fail("unsupported-private-abi", "abi.schemaVersion must be 1", {
      expected: 1,
      actual: abi.schemaVersion,
    });
  }
  if (abi.initialize !== null) nonemptyString(abi.initialize, "abi.initialize");
  object(abi.declarations, "abi.declarations");
  object(abi.resources, "abi.resources");
  object(abi.callbacks, "abi.callbacks");

  const declarationIds = new Set(ir.declarations.map(item => item.id));
  for (const [id, entry] of Object.entries(abi.declarations)) {
    if (!declarationIds.has(id)) {
      fail("unknown-abi-declaration", `private ABI names unknown declaration ${id}`, { id });
    }
    exactKeys(entry, ["symbol", "adapter"], `abi.declarations.${id}`);
    nonemptyString(entry.symbol, `abi.declarations.${id}.symbol`);
    validateAdapter(entry.adapter, `abi.declarations.${id}.adapter`);
  }

  const resourceIds = new Set(
    ir.types.filter(type => type.kind === "resource").map(type => type.id),
  );
  const resourceTags = new Map();
  for (const [id, entry] of Object.entries(abi.resources)) {
    if (!resourceIds.has(id)) {
      fail("unknown-abi-resource", `private ABI names unknown resource ${id}`, { id });
    }
    exactKeys(entry, ["side", "kind", "dispose"], `abi.resources.${id}`);
    if (!new Set(["lean", "host"]).has(entry.side)) {
      fail("invalid-private-abi", `abi.resources.${id}.side is unsupported`, { id });
    }
    if (!Number.isSafeInteger(entry.kind) || entry.kind < 1 || entry.kind > 0x7f) {
      fail("invalid-private-abi", `abi.resources.${id}.kind must be from 1 through 127`, {
        id,
      });
    }
    nonemptyString(entry.dispose, `abi.resources.${id}.dispose`);
    const tag = `${entry.side}:${entry.kind}`;
    if (resourceTags.has(tag)) {
      fail(
        "duplicate-resource-tag",
        `${id} and ${resourceTags.get(tag)} use private resource tag ${tag}`,
        { tag, resources: [resourceTags.get(tag), id] },
      );
    }
    resourceTags.set(tag, id);
  }

  const callbackIds = new Set(
    ir.types.filter(type => type.kind === "callback").map(type => type.id),
  );
  for (const [id, entry] of Object.entries(abi.callbacks)) {
    if (!callbackIds.has(id)) {
      fail("unknown-abi-callback", `private ABI names unknown callback ${id}`, { id });
    }
    exactKeys(entry, ["side", "kind", "call", "dispose"], `abi.callbacks.${id}`);
    if (entry.side !== "lean") {
      fail("invalid-private-abi", `abi.callbacks.${id}.side must be lean`, { id });
    }
    if (!Number.isSafeInteger(entry.kind) || entry.kind < 1 || entry.kind > 0x7f) {
      fail("invalid-private-abi", `abi.callbacks.${id}.kind must be from 1 through 127`, {
        id,
      });
    }
    nonemptyString(entry.call, `abi.callbacks.${id}.call`);
    nonemptyString(entry.dispose, `abi.callbacks.${id}.dispose`);
    const tag = `${entry.side}:${entry.kind}`;
    if (resourceTags.has(tag)) {
      fail(
        "duplicate-resource-tag",
        `${id} and ${resourceTags.get(tag)} use private identity tag ${tag}`,
        { tag, resources: [resourceTags.get(tag), id] },
      );
    }
    resourceTags.set(tag, id);
  }
};

const declarationAbi = (abi, declaration) => {
  const entry = abi.declarations[declaration.id];
  if (!entry) {
    fail(
      "missing-abi-declaration",
      `private ABI has no implementation for ${declaration.id}`,
      { declaration: declaration.id },
    );
  }
  return entry;
};

const namedTypeId = typeRef => (typeRef.kind === "named" ? typeRef.id : undefined);

const compileLifecycle = (ir, type, abi) => {
  try {
    return compileResourceLifecycleV1(ir, type.id, abi);
  } catch (error) {
    if (!(error instanceof ResourceLifecycleGenerationError)) throw error;
    fail(error.code, error.message, error.details);
  }
};

const validateJavaScriptLifecycle = lifecycle => {
  const constructor = lifecycle.constructor;
  if (
    constructor.resultMode !== "value" ||
    constructor.result.transport !== "handle" ||
    constructor.result.ownership !== "lease" ||
    constructor.result.lifetime?.scope !== "explicit"
  ) {
    fail(
      "unsupported-constructor-lifecycle",
      `${constructor.declarationId} must return an explicit resource lease in the JavaScript POC`,
      { declaration: constructor.declarationId, result: constructor.result },
    );
  }
  if (!lifecycle.disposal.explicit) {
    fail(
      "unsupported-disposal-policy",
      `${lifecycle.typeId} does not expose deterministic disposal`,
      { resource: lifecycle.typeId, policy: lifecycle.disposal.policy },
    );
  }
  for (const method of lifecycle.methods) {
    if (
      method.resultMode !== "value" ||
      method.receiver?.ownership !== "borrow" ||
      method.receiver?.lifetime?.scope !== "call"
    ) {
      fail(
        "unsupported-method-lifecycle",
        `${method.declarationId} cannot preserve its receiver or result mode in the JavaScript POC`,
        { declaration: method.declarationId },
      );
    }
    if (
      method.result.transport === "handle" &&
      (method.result.ownership !== "borrow" ||
        method.result.lifetime?.scope !== "receiver")
    ) {
      fail(
        "unsupported-resource-result",
        `${method.declarationId} must return a resource borrowed from its receiver in the JavaScript POC`,
        { declaration: method.declarationId, result: method.result },
      );
    }
  }
};

export const compileJavaScriptProjection = (ir, abi) => {
  validateBindingIr(ir);
  const coverage = analyzeJavaScriptCoverage(ir);
  if (!coverage.supported) {
    const first = coverage.gaps[0];
    fail(first.code, first.message, first.details);
  }
  validatePrivateAbi(ir, abi);
  const typeMap = new Map(ir.types.map(type => [type.id, type]));
  const bindings = [];
  const consumedDeclarations = new Set();
  const publicNames = new Map();
  const addPublicName = (name, id) => {
    if (publicNames.has(name)) {
      fail(
        "duplicate-public-name",
        `${name} is projected by both ${publicNames.get(name)} and ${id}`,
        { name, declarations: [publicNames.get(name), id] },
      );
    }
    publicNames.set(name, id);
  };

  for (const type of ir.types) {
    if (type.kind !== "resource") continue;
    addPublicName(type.name, type.id);
    const lifecycle = compileLifecycle(ir, type, abi);
    validateJavaScriptLifecycle(lifecycle);
    const constructor = lifecycle.constructor;
    consumedDeclarations.add(constructor.declarationId);
    const methods = lifecycle.methods.map(call => {
      consumedDeclarations.add(call.declarationId);
      return Object.freeze({
        name: call.name,
        declarationId: call.declarationId,
        symbol: call.symbol,
        call,
      });
    });

    bindings.push(
      Object.freeze({
        kind: "class",
        name: type.name,
        typeId: type.id,
        lifecycle,
        methods: Object.freeze(methods),
      }),
    );
  }

  for (const declaration of ir.declarations) {
    if (consumedDeclarations.has(declaration.id)) continue;
    if (declaration.kind !== "function") {
      fail(
        "unsupported-declaration-kind",
        `${declaration.id} uses unsupported JavaScript POC kind ${declaration.kind}`,
        { declaration: declaration.id, kind: declaration.kind },
      );
    }
    if (declaration.typeParameters.length > 0) {
      fail("unsupported-generic", `${declaration.id} requires monomorphization metadata`, {
        declaration: declaration.id,
      });
    }
    addPublicName(declaration.name, declaration.id);
    if (!new Set(["value", "promise"]).has(declaration.resultMode)) {
      fail(
        "unsupported-result-mode",
        `${declaration.id} uses ${declaration.resultMode}; the POC projector supports value and Promise functions`,
        { declaration: declaration.id, resultMode: declaration.resultMode },
      );
    }
    if (namedTypeId(declaration.result.type)) {
      const resultType = typeMap.get(namedTypeId(declaration.result.type));
      if (resultType?.kind === "resource") {
        fail(
          "unsupported-resource-result",
          `${declaration.id} returns a resource outside its generated class constructor`,
          { declaration: declaration.id },
        );
      }
    }
    const entry = declarationAbi(abi, declaration);
    consumedDeclarations.add(declaration.id);
    const adapter = compileAdapter(ir, declaration, entry.adapter, abi);
    const resultType = typeMap.get(namedTypeId(declaration.result.type));
    if (
      resultType?.kind === "callback" &&
      adapter?.kind !== "callback-result-v1"
    ) {
      fail(
        "missing-callback-result-adapter",
        `${declaration.id} requires a callback-result-v1 adapter`,
        { declaration: declaration.id },
      );
    }
    if (declaration.resultMode === "promise") {
      if (adapter?.kind !== "pending-operation-v1") {
        fail(
          "missing-pending-adapter",
          `${declaration.id} requires a pending-operation-v1 adapter`,
          { declaration: declaration.id },
        );
      }
      const unsupportedCapture = adapter.captures.find(
        capture => capture.representation !== "copied",
      );
      if (unsupportedCapture || adapter.result.representation !== "copied") {
        fail(
          "unsupported-pending-resource",
          `${declaration.id} requires pending resource retention that the JavaScript POC has not connected`,
          {
            declaration: declaration.id,
            capture: unsupportedCapture?.name,
            resultRepresentation: adapter.result.representation,
          },
        );
      }
    }
    bindings.push(
      Object.freeze({
        kind: "function",
        name: declaration.name,
        declarationId: declaration.id,
        initialize: abi.initialize,
        symbol: entry.symbol,
        ...(adapter ? { adapter } : {}),
      }),
    );
  }

  for (const declaration of ir.declarations) {
    if (!consumedDeclarations.has(declaration.id)) {
      fail("unprojected-declaration", `${declaration.id} was not projected`, {
        declaration: declaration.id,
      });
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    bindingIrSha256: hashBindingIr(ir),
    bindings: Object.freeze(bindings),
  });
};
