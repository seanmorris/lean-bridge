import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

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

const deepFreeze = value => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const validateAdapter = (adapter, path) => {
  if (adapter === null) return;
  exactKeys(
    adapter,
    ["kind", "abiVersion", "byteSize", "maxCopyBytes", "maxArrayLength"],
    path,
  );
  if (adapter.kind !== "value-frame-v1" || adapter.abiVersion !== 1) {
    fail("unsupported-private-adapter", `${path} requests an unsupported adapter`, {
      path,
      kind: adapter.kind,
      abiVersion: adapter.abiVersion,
    });
  }
  for (const key of ["byteSize", "maxCopyBytes", "maxArrayLength"]) {
    if (!Number.isSafeInteger(adapter[key]) || adapter[key] < 1) {
      fail("invalid-private-abi", `${path}.${key} must be a positive integer`, {
        path: `${path}.${key}`,
      });
    }
  }
};

const validatePrivateAbi = (ir, abi) => {
  exactKeys(abi, ["schemaVersion", "initialize", "declarations", "resources"], "abi");
  if (abi.schemaVersion !== 1) {
    fail("unsupported-private-abi", "abi.schemaVersion must be 1", {
      expected: 1,
      actual: abi.schemaVersion,
    });
  }
  if (abi.initialize !== null) nonemptyString(abi.initialize, "abi.initialize");
  object(abi.declarations, "abi.declarations");
  object(abi.resources, "abi.resources");

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

const resourceResult = (declaration, typeMap) => {
  const typeId = namedTypeId(declaration.result.type);
  const type = typeMap.get(typeId);
  if (type?.kind !== "resource") return undefined;
  if (declaration.result.ownership !== "borrow") {
    fail(
      "unsupported-resource-result",
      `${declaration.id} returns ${declaration.result.ownership}; the POC projector supports borrowed method resources`,
      { declaration: declaration.id, ownership: declaration.result.ownership },
    );
  }
  return Object.freeze({
    kind: "resource",
    name: type.name,
    ownership: "borrowed",
  });
};

export const compileJavaScriptProjection = (ir, abi) => {
  validateBindingIr(ir);
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
    const resourceAbi = abi.resources[type.id];
    if (!resourceAbi) {
      fail("missing-abi-resource", `private ABI has no resource entry for ${type.id}`, {
        resource: type.id,
      });
    }
    const constructors = ir.declarations.filter(
      declaration =>
        declaration.kind === "constructor" && namedTypeId(declaration.result.type) === type.id,
    );
    if (constructors.length !== 1) {
      fail(
        "resource-constructor-count",
        `${type.id} requires exactly one constructor in JavaScript POC bindings`,
        { resource: type.id, actual: constructors.length },
      );
    }
    const constructor = constructors[0];
    if (constructor.typeParameters.length > 0) {
      fail("unsupported-generic", `${constructor.id} requires monomorphization metadata`, {
        declaration: constructor.id,
      });
    }
    const constructorAbi = declarationAbi(abi, constructor);
    if (constructorAbi.adapter !== null) {
      fail(
        "unsupported-private-adapter",
        `${constructor.id} constructor adapters are not implemented by the POC projector`,
        { declaration: constructor.id },
      );
    }
    consumedDeclarations.add(constructor.id);

    const methods = ir.declarations
      .filter(
        declaration =>
          declaration.kind === "method" &&
          namedTypeId(declaration.receiver?.type) === type.id,
      )
      .map(declaration => {
        if (declaration.typeParameters.length > 0) {
          fail("unsupported-generic", `${declaration.id} requires monomorphization metadata`, {
            declaration: declaration.id,
          });
        }
        const entry = declarationAbi(abi, declaration);
        if (entry.adapter !== null) {
          fail(
            "unsupported-private-adapter",
            `${declaration.id} method adapters are not implemented by the POC projector`,
            { declaration: declaration.id },
          );
        }
        if (declaration.resultMode !== "value") {
          fail(
            "unsupported-result-mode",
            `${declaration.id} uses ${declaration.resultMode}; the POC projector supports value methods`,
            { declaration: declaration.id, resultMode: declaration.resultMode },
          );
        }
        consumedDeclarations.add(declaration.id);
        const result = resourceResult(declaration, typeMap);
        return Object.freeze({
          name: declaration.name,
          declarationId: declaration.id,
          symbol: entry.symbol,
          ...(result ? { result } : {}),
        });
      });

    bindings.push(
      Object.freeze({
        kind: "class",
        name: type.name,
        typeId: type.id,
        constructorId: constructor.id,
        initialize: abi.initialize,
        constructor: constructorAbi.symbol,
        dispose: resourceAbi.dispose,
        handle: Object.freeze({ side: resourceAbi.side, kind: resourceAbi.kind }),
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
    if (declaration.resultMode !== "value") {
      fail(
        "unsupported-result-mode",
        `${declaration.id} uses ${declaration.resultMode}; the POC projector supports value functions`,
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
    bindings.push(
      Object.freeze({
        kind: "function",
        name: declaration.name,
        declarationId: declaration.id,
        initialize: abi.initialize,
        symbol: entry.symbol,
        ...(entry.adapter ? { adapter: deepFreeze(structuredClone(entry.adapter)) } : {}),
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
