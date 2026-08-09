import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

export class WitBindingGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "WitBindingGenerationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new WitBindingGenerationError(code, message, details);
};

const kebab = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/[^A-Za-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

const snake = value => kebab(value).replaceAll("-", "_");

const witPackageIdentity = component => {
  const separator = component.id.lastIndexOf("@");
  const path = (separator === -1 ? component.id : component.id.slice(0, separator)).split("/");
  if (path.length < 2) {
    fail("invalid-component-id", `${component.id} cannot become a namespaced WIT package`);
  }
  return `${kebab(path[0])}:${kebab(path.at(-1))}@${component.version}`;
};

const typeMap = ir => new Map(ir.types.map(type => [type.id, type]));

const resolveAlias = (types, reference, seen = new Set()) => {
  if (reference.kind !== "named") return reference;
  const type = types.get(reference.id);
  if (type?.kind !== "alias") return reference;
  if (seen.has(type.id)) fail("alias-cycle", `WIT projection found an alias cycle at ${type.id}`);
  seen.add(type.id);
  return resolveAlias(types, type.target, seen);
};

const witType = (types, reference, site = null) => {
  const resolved = resolveAlias(types, reference);
  if (resolved.kind === "primitive") {
    const primitives = {
      bool: "bool",
      uint8: "u8",
      uint16: "u16",
      uint32: "u32",
      uint64: "u64",
      int8: "s8",
      int16: "s16",
      int32: "s32",
      int64: "s64",
      float32: "f32",
      float64: "f64",
      string: "string",
      bytes: "list<u8>",
    };
    if (!primitives[resolved.name]) {
      fail(
        "unsupported-wit-primitive",
        `WIT has no lossless built-in projection for ${resolved.name}`,
        { type: resolved.name },
      );
    }
    return primitives[resolved.name];
  }
  if (resolved.kind === "parameter") {
    fail("unsupported-open-generic", `WIT projection cannot emit open type parameter ${resolved.id}`);
  }
  if (resolved.kind === "apply") {
    const arguments_ = resolved.arguments.map(argument => witType(types, argument));
    if (resolved.constructor === "array") return `list<${arguments_[0]}>`;
    if (resolved.constructor === "option") return `option<${arguments_[0]}>`;
    if (resolved.constructor === "result") return `result<${arguments_[0]}, ${arguments_[1]}>`;
    if (resolved.constructor === "tuple") return `tuple<${arguments_.join(", ")}>`;
    fail("unsupported-wit-application", `WIT projection cannot preserve ${resolved.constructor}`);
  }
  const type = types.get(resolved.id);
  if (!type) fail("unknown-type", `WIT projection cannot resolve ${resolved.id}`);
  if (type.kind === "callback") {
    fail(
      "unsupported-first-class-callback",
      `${type.id} is a first-class callable, which WIT does not model as a value type`,
      { type: type.id },
    );
  }
  if (type.kind === "resource") {
    if (site?.role === "parameter" && site.ownership === "borrow") {
      return `borrow<${kebab(type.name)}>`;
    }
    if (site?.role === "result" && site.ownership === "borrow") {
      fail(
        "unsupported-borrowed-result",
        `${site.declaration} returns a receiver-anchored borrow that WIT cannot return safely`,
        { declaration: site.declaration, type: type.id },
      );
    }
    if (site?.ownership === "copy") {
      fail("invalid-resource-copy", `${type.id} cannot cross WIT as a copied value`);
    }
  }
  return kebab(type.name);
};

const declarationReason = (ir, types, declaration) => {
  try {
    if (declaration.typeParameters.length !== 0) {
      fail("unsupported-open-generic", `${declaration.id} requires monomorphization before WIT emission`);
    }
    if (declaration.kind === "property") {
      fail("unsupported-property", `${declaration.id} needs an explicit WIT method contract`);
    }
    if (declaration.resultMode !== "value") {
      fail(
        "unsupported-delivery-mode",
        `${declaration.id} uses ${declaration.resultMode}; async WIT remains outside this MVP profile`,
      );
    }
    if (declaration.effects.includes("host-call")) {
      fail(
        "unsupported-host-call",
        `${declaration.id} accepts a host callback that cannot become a WIT value`,
      );
    }
    for (const capability of declaration.capabilities) {
      if (capability !== "capability:shared-runtime") {
        fail(
          "unsupported-host-capability",
          `${declaration.id} requires host capability ${capability}`,
          { declaration: declaration.id, capability },
        );
      }
    }
    for (const parameter of declaration.parameters) {
      if (parameter.optional || parameter.default !== null) {
        fail("unsupported-default-argument", `${declaration.id}.${parameter.name} has host call defaults`);
      }
      witType(types, parameter.type, {
        role: "parameter",
        ownership: parameter.ownership,
        declaration: declaration.id,
      });
    }
    witType(types, declaration.result.type, {
      role: "result",
      ownership: declaration.result.ownership,
      declaration: declaration.id,
    });
    return null;
  } catch (error) {
    if (!(error instanceof WitBindingGenerationError)) throw error;
    return Object.freeze({
      id: declaration.id,
      name: declaration.name,
      code: error.code,
      reason: error.message,
    });
  }
};

const docs = documentation => {
  const lines = [documentation.summary, documentation.details].filter(Boolean);
  return lines.map(line => `  /// ${line}`).join("\n");
};

const resultType = (types, declaration, errorsUsed) => {
  const result = witType(types, declaration.result.type, {
    role: "result",
    ownership: declaration.result.ownership,
    declaration: declaration.id,
  });
  if (declaration.failure.mode !== "declared") return result;
  declaration.failure.errors.forEach(error => errorsUsed.add(error));
  return `result<${result}, bridge-error>`;
};

const parameters = (types, declaration) => declaration.parameters.map(parameter => {
  const type = witType(types, parameter.type, {
    role: "parameter",
    ownership: parameter.ownership,
    declaration: declaration.id,
  });
  return `${kebab(parameter.name)}: ${type}`;
}).join(", ");

const emitCopiedType = (types, type) => {
  const documentation = docs(type.documentation);
  if (type.kind === "record") {
    const fields = type.fields.map(field => {
      if (field.mutability !== "immutable") {
        fail("unsupported-mutable-record", `${type.id}.${field.name} is mutable`);
      }
      return `    ${kebab(field.name)}: ${witType(types, field.type)},`;
    });
    return `${documentation}\n  record ${kebab(type.name)} {\n${fields.join("\n")}\n  }`;
  }
  if (type.kind === "variant") {
    const cases = type.cases.map(case_ => {
      if (case_.fields.length === 0) return `    ${kebab(case_.name)},`;
      if (case_.fields.length === 1) {
        return `    ${kebab(case_.name)}(${witType(types, case_.fields[0].type)}),`;
      }
      fail(
        "unsupported-multi-field-variant-case",
        `${type.id}.${case_.name} needs a named payload record before WIT emission`,
      );
    });
    return `${documentation}\n  variant ${kebab(type.name)} {\n${cases.join("\n")}\n  }`;
  }
  if (type.kind === "alias") {
    return `${documentation}\n  type ${kebab(type.name)} = ${witType(types, type.target)};`;
  }
  fail("unsupported-wit-type", `${type.id} cannot be emitted as a WIT copied type`);
};

const assuranceFor = (ir, subjects) => ir.assurance.filter(item => subjects.has(item.subject));

export const generateWitPackage = irValue => {
  const ir = validateBindingIr(irValue);
  const types = typeMap(ir);
  const deferred = [];
  const included = [];
  for (const declaration of ir.declarations) {
    const reason = declarationReason(ir, types, declaration);
    if (reason) deferred.push(reason);
    else included.push(declaration);
  }
  if (included.length === 0) fail("empty-portable-surface", `${ir.component.id} has no WIT-compatible declarations`);

  const errorsUsed = new Set();
  const resourceDeclarations = new Map();
  const functions = [];
  for (const declaration of included) {
    if (declaration.owner) {
      const group = resourceDeclarations.get(declaration.owner) ?? [];
      group.push(declaration);
      resourceDeclarations.set(declaration.owner, group);
    } else {
      functions.push(declaration);
    }
  }

  const copiedTypes = ir.types
    .filter(type => type.representation === "copied")
    .filter(type => type.kind !== "callback")
    .map(type => emitCopiedType(types, type));

  const resources = [];
  for (const type of ir.types.filter(candidate => candidate.kind === "resource")) {
    const members = resourceDeclarations.get(type.id) ?? [];
    if (members.length === 0) continue;
    const lines = [];
    for (const declaration of members) {
      const documentation = docs(declaration.documentation);
      if (documentation) lines.push(documentation);
      const params = parameters(types, declaration);
      if (declaration.kind === "constructor") {
        if (declaration.failure.mode === "declared") {
          declaration.failure.errors.forEach(error => errorsUsed.add(error));
          lines.push(`    constructor(${params}) -> result<${kebab(type.name)}, bridge-error>;`);
        } else {
          lines.push(`    constructor(${params});`);
        }
      } else if (declaration.kind === "method") {
        lines.push(`    ${kebab(declaration.name)}: func(${params}) -> ${resultType(types, declaration, errorsUsed)};`);
      } else if (declaration.kind === "static") {
        lines.push(`    ${kebab(declaration.name)}: static func(${params}) -> ${resultType(types, declaration, errorsUsed)};`);
      } else {
        fail("unsupported-resource-member", `${declaration.id} cannot become a WIT resource member`);
      }
    }
    resources.push(`${docs(type.documentation)}\n  resource ${kebab(type.name)} {\n${lines.join("\n")}\n  }`);
  }

  const freeFunctions = functions.map(declaration => {
    const documentation = docs(declaration.documentation);
    const signature = `  ${kebab(declaration.name)}: func(${parameters(types, declaration)}) -> ${resultType(types, declaration, errorsUsed)};`;
    return `${documentation ? `${documentation}\n` : ""}${signature}`;
  });

  const errorCases = ir.errors
    .filter(error => errorsUsed.has(error.id))
    .map(error => `    ${kebab(error.name)},`);
  const errorType = errorCases.length === 0
    ? []
    : [`  enum bridge-error {\n${errorCases.join("\n")}\n  }`];

  const packageName = witPackageIdentity(ir.component);
  const worldName = kebab(ir.component.id.slice(0, ir.component.id.lastIndexOf("@")).split("/").at(-1));
  const typeItems = [...copiedTypes, ...errorType, ...resources].filter(Boolean).join("\n\n");
  const apiUses = new Set();
  for (const declaration of functions) {
    const collect = reference => {
      const resolved = resolveAlias(types, reference);
      if (resolved.kind === "named") apiUses.add(kebab(types.get(resolved.id).name));
      if (resolved.kind === "apply") resolved.arguments.forEach(collect);
    };
    declaration.parameters.forEach(parameter => collect(parameter.type));
    collect(declaration.result.type);
  }
  if (errorCases.length > 0 && functions.some(item => item.failure.mode === "declared")) {
    apiUses.add("bridge-error");
  }
  const useLine = apiUses.size > 0
    ? `  use types.{${[...apiUses].sort().join(", ")}};\n\n`
    : "";
  const wit = `package ${packageName};\n\ninterface types {\n${typeItems}\n}\n\ninterface api {\n${useLine}${freeFunctions.join("\n\n")}\n}\n\nworld ${worldName} {\n  export types;\n  export api;\n}\n`;

  const subjects = new Set([
    ...included.map(item => item.id),
    ...ir.types.filter(type => type.representation !== "identity" || resourceDeclarations.has(type.id)).map(type => type.id),
  ]);
  const manifest = Object.freeze({
    schemaVersion: 1,
    backend: "wit-v1",
    component: Object.freeze({ ...ir.component }),
    bindingIrSha256: hashBindingIr(ir),
    wit: Object.freeze({ package: packageName, world: worldName, typesInterface: "types", apiInterface: "api" }),
    declarations: Object.freeze(included.map(item => Object.freeze({
      id: item.id,
      witName: kebab(item.name),
      pythonName: item.owner
        ? `${types.get(item.owner).name}.${item.kind === "constructor" ? "__init__" : snake(item.name)}`
        : snake(item.name),
    }))),
    types: Object.freeze(ir.types
      .filter(type => subjects.has(type.id) && type.kind !== "callback")
      .map(type => Object.freeze({ id: type.id, witName: kebab(type.name), pythonName: type.name }))),
    deferred: Object.freeze(deferred),
    assurance: Object.freeze(assuranceFor(ir, subjects)),
  });
  const files = Object.freeze({
    [`wit/${worldName}.wit`]: wit,
    "binding-manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "python-consumer.json": `${JSON.stringify({
      schemaVersion: 1,
      module: snake(worldName),
      declarations: manifest.declarations.map(item => ({ id: item.id, name: item.pythonName })),
      types: manifest.types.map(item => ({ id: item.id, name: item.pythonName })),
      bindingIrSha256: manifest.bindingIrSha256,
    }, null, 2)}\n`,
  });
  return Object.freeze({ wit, manifest, files });
};

export const generateWitConsumerProbe = (provider, { operation = "inspect" } = {}) => {
  const box = provider.manifest.types.find(type => type.id === "lean:Alpha.Box");
  if (!box) fail("missing-provider-resource", "provider does not expose lean:Alpha.Box");
  const error = provider.wit.includes("enum bridge-error") ? ", bridge-error" : "";
  const packageWithoutVersion = provider.manifest.wit.package.slice(
    0,
    provider.manifest.wit.package.lastIndexOf("@"),
  );
  const version = provider.manifest.component.version;
  const useNames = `${box.witName}${error}`;
  const wit = `package poc:lean-alpha-consumer@${version};\n\ninterface consume {\n  use ${packageWithoutVersion}/${provider.manifest.wit.typesInterface}@${version}.{${useNames}};\n  ${kebab(operation)}: func(value: borrow<${box.witName}>) -> result<u32, bridge-error>;\n}\n\nworld consumer {\n  export consume;\n}\n`;
  return Object.freeze({
    wit,
    requirement: Object.freeze({
      schemaVersion: 1,
      providerComponent: provider.manifest.component.id,
      providerBindingIrSha256: provider.manifest.bindingIrSha256,
      providerPackage: provider.manifest.wit.package,
      interface: provider.manifest.wit.typesInterface,
      resource: Object.freeze({ id: box.id, witName: box.witName, ownership: "borrow" }),
    }),
  });
};

export const verifyWitComposition = (provider, consumer) => {
  const expected = {
    component: provider.manifest.component.id,
    bindingIrSha256: provider.manifest.bindingIrSha256,
    package: provider.manifest.wit.package,
    interface: provider.manifest.wit.typesInterface,
  };
  const requirement = consumer.requirement;
  if (
    requirement.providerComponent !== expected.component ||
    requirement.providerBindingIrSha256 !== expected.bindingIrSha256 ||
    requirement.providerPackage !== expected.package ||
    requirement.interface !== expected.interface ||
    requirement.resource.id !== "lean:Alpha.Box" ||
    requirement.resource.ownership !== "borrow"
  ) {
    fail("wit-composition-drift", "consumer WIT requirement does not match the provider contract", {
      expected,
      actual: requirement,
    });
  }
  return Object.freeze({
    provider: expected,
    consumer: "poc:lean-alpha-consumer",
    resourceIdentity: `${expected.package}/${expected.interface}#${requirement.resource.witName}`,
  });
};
