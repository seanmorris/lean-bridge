import {
  canonicalizeJsonValue,
  hashBindingIr,
} from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { compileOverloadV1 } from "../../abi/overload.mjs";
import { JavaScriptProjectionError } from "./projection.mjs";
import { auditJavaScriptPackage } from "./package-audit.mjs";
import { analyzeJavaScriptCoverage } from "./coverage.mjs";

const fail = (code, message, details = {}) => {
  throw new JavaScriptProjectionError(code, message, details);
};

const quote = value => JSON.stringify(value);
const namedTypeId = typeRef => (typeRef.kind === "named" ? typeRef.id : undefined);

const typeScriptType = (typeRef, typeMap) => {
  if (typeRef.kind === "primitive") {
    if (typeRef.name === "unit") return "void";
    if (typeRef.name === "bool") return "boolean";
    if (new Set(["uint64", "int64", "nat", "int"]).has(typeRef.name)) return "bigint";
    if (typeRef.name === "string") return "string";
    if (typeRef.name === "bytes") return "Uint8Array";
    return "number";
  }
  if (typeRef.kind === "named") return typeMap.get(typeRef.id)?.name ?? "never";
  if (typeRef.kind === "parameter") return typeRef.id;
  if (typeRef.constructor === "array") {
    return `ReadonlyArray<${typeScriptType(typeRef.arguments[0], typeMap)}>`;
  }
  if (typeRef.constructor === "option") {
    return `${typeScriptType(typeRef.arguments[0], typeMap)} | null`;
  }
  if (typeRef.constructor === "result") {
    return `Readonly<{ ok: ${typeScriptType(typeRef.arguments[0], typeMap)} }> | Readonly<{ error: ${typeScriptType(typeRef.arguments[1], typeMap)} }>`;
  }
  return `readonly [${typeRef.arguments.map(argument => typeScriptType(argument, typeMap)).join(", ")}]`;
};

const deliveredType = (declaration, typeMap) => {
  const resultType =
    declaration.result.type.kind === "named"
      ? typeMap.get(declaration.result.type.id)
      : undefined;
  const projected = typeScriptType(declaration.result.type, typeMap);
  const result =
    resultType?.kind === "callback" && declaration.result.ownership === "lease"
      ? `${projected} & LeanOwnedCallable`
      : projected;
  if (declaration.resultMode === "promise") return `Promise<${result}>`;
  if (declaration.resultMode === "iterator") return `Iterable<${result}>`;
  if (declaration.resultMode === "async-iterator") return `AsyncIterable<${result}>`;
  return result;
};

const docComment = (documentation, extra = []) => {
  const lines = [documentation.summary, documentation.details, ...extra].filter(Boolean);
  return ["/**", ...lines.map(line => ` * ${line}`), " */"].join("\n");
};

const parameterType = (parameter, typeMap) =>
  `${parameter.name}${parameter.optional ? "?" : ""}: ${typeScriptType(parameter.type, typeMap)}`;

const projectedErrors = ir => ir.errors.filter(error => error.category !== "boundary");

const declarationErrors = (ir, declaration) => {
  const errors = new Map(ir.errors.map(error => [error.id, error]));
  return declaration.failure.errors
    .map(errorId => errors.get(errorId))
    .filter(error => error?.category !== "boundary");
};

const emitTypeDeclarations = (ir, typeMap) => {
  const output = [];
  for (const type of ir.types) {
    if (type.kind === "record") {
      output.push(docComment(type.documentation));
      const parameters = type.typeParameters.length
        ? `<${type.typeParameters.map(parameter => parameter.id).join(", ")}>`
        : "";
      output.push(`export interface ${type.name}${parameters} {`);
      for (const field of type.fields) {
        output.push(`  ${field.mutability === "write" ? "" : "readonly "}${field.name}: ${typeScriptType(field.type, typeMap)};`);
      }
      output.push("}", "");
    } else if (type.kind === "alias") {
      output.push(docComment(type.documentation));
      const parameters = type.typeParameters.length
        ? `<${type.typeParameters.map(parameter => parameter.id).join(", ")}>`
        : "";
      output.push(
        `export type ${type.name}${parameters} = ${typeScriptType(type.target, typeMap)};`,
        "",
      );
    } else if (type.kind === "callback") {
      output.push(docComment(type.documentation));
      const parameters = type.callable.parameters
        .map(parameter => parameterType(parameter, typeMap))
        .join(", ");
      const result = typeScriptType(type.callable.result.type, typeMap);
      const delivered =
        type.callable.resultMode === "promise" ? `Promise<${result}>` : result;
      output.push(
        `export type ${type.name} = (${parameters}) => ${delivered};`,
        "",
      );
    }
  }
  return output;
};

const declarationsForResource = (ir, typeId) => ({
  constructors: ir.declarations.filter(
    declaration =>
      declaration.kind === "constructor" && namedTypeId(declaration.result.type) === typeId,
  ),
  methods: ir.declarations.filter(
    declaration =>
      declaration.kind === "method" && namedTypeId(declaration.receiver?.type) === typeId,
  ),
  properties: ir.declarations.filter(
    declaration =>
      declaration.kind === "property" && namedTypeId(declaration.receiver?.type) === typeId,
  ),
});

const groupFunctions = declarations => {
  const groups = new Map();
  for (const declaration of declarations) {
    const group = groups.get(declaration.name) ?? [];
    group.push(declaration);
    groups.set(declaration.name, group);
  }
  return groups;
};

const propertyGroups = properties => {
  const groups = new Map();
  for (const property of properties) {
    const group = groups.get(property.name) ?? { name: property.name };
    const role = property.parameters.length === 0 ? "getter" : "setter";
    if (group[role]) {
      fail("duplicate-property-accessor", `${property.name} has two ${role}s`, {
        property: property.name,
        declarations: [group[role].id, property.id],
      });
    }
    group[role] = property;
    groups.set(property.name, group);
  }
  for (const group of groups.values()) {
    if (
      group.getter &&
      group.setter &&
      canonicalizeJsonValue(group.getter.result.type, "property.getter.type") !==
        canonicalizeJsonValue(group.setter.parameters[0].type, "property.setter.type")
    ) {
      fail("property-type-mismatch", `${group.name} getter and setter disagree`, {
        property: group.name,
      });
    }
  }
  return [...groups.values()];
};

const ensureSupportedGenerics = declaration => {
  if (declaration.typeParameters.length > 0) {
    fail("unsupported-generic", `${declaration.id} requires target monomorphization metadata`, {
      declaration: declaration.id,
    });
  }
};

const ensureUniqueSurface = ir => {
  const exports = new Map();
  const addExport = (name, id) => {
    if (exports.has(name)) {
      fail("duplicate-public-name", `${name} is exported by both ${exports.get(name)} and ${id}`, {
        name,
        declarations: [exports.get(name), id],
      });
    }
    exports.set(name, id);
  };
  for (const error of projectedErrors(ir)) addExport(error.name, error.id);
  for (const type of ir.types.filter(item => item.kind === "resource")) {
    addExport(type.name, type.id);
    const members = ir.declarations.filter(
      declaration =>
        new Set(["method", "property"]).has(declaration.kind) &&
        namedTypeId(declaration.receiver?.type) === type.id,
    );
    const methodNames = new Map([["dispose", "generated lifecycle method"]]);
    for (const member of members) {
      if (
        methodNames.has(member.name) &&
        !(member.kind === "property" && methodNames.get(member.name) === "property")
      ) {
        fail(
          "duplicate-public-name",
          `${type.name}.${member.name} conflicts with ${methodNames.get(member.name)}`,
          { name: member.name, declaration: member.id },
        );
      }
      methodNames.set(member.name, member.kind === "property" ? "property" : member.id);
    }
    propertyGroups(members.filter(member => member.kind === "property"));
  }
  for (const [name, declarations] of groupFunctions(
    ir.declarations.filter(item => item.kind === "function"),
  )) {
    if (declarations.length > 1) compileOverloadV1(ir, name);
    addExport(name, declarations.map(declaration => declaration.id).join(","));
  }
};

const emitDeclarations = (ir, typeMap) => {
  const output = [
    `// Generated from Binding IR SHA-256 ${hashBindingIr(ir)}.`,
    `import { runtime } from "./internal/runtime.mjs";`,
    `import * as validate from "./internal/validators.mjs";`,
    "",
  ];
  const exports = [];
  const consumed = new Set();
  const errors = projectedErrors(ir);

  if (errors.length > 0) {
    output.push(
      "const translateDeclaredError = error => {",
      '  if (error?.code !== "declared-error") throw error;',
      "  switch (error.details?.errorId) {",
    );
    for (const error of errors) {
      const construction =
        error.payload === null
          ? `new ${error.name}({ cause: error })`
          : `new ${error.name}(error.details.payload, { cause: error })`;
      output.push(`    case ${quote(error.id)}: return ${construction};`);
    }
    output.push("    default: throw error;", "  }", "};", "");
  }

  for (const error of errors) {
    output.push(docComment(error.documentation));
    output.push(`export class ${error.name} extends Error {`);
    if (error.payload === null) {
      output.push(`  constructor(options) {`, `    super(${quote(error.documentation.summary)}, options);`);
    } else {
      output.push(
        "  constructor(payload, options) {",
        `    super(${quote(error.documentation.summary)}, options);`,
        "    this.payload = payload;",
      );
    }
    output.push(
      `    this.name = ${quote(error.name)};`,
      `    this.code = ${quote(error.id)};`,
      "  }",
      "}",
      "",
    );
    exports.push(error.name);
  }

  for (const type of ir.types.filter(item => item.kind === "resource")) {
    const { constructors, methods, properties } = declarationsForResource(ir, type.id);
    if (constructors.length !== 1) {
      fail("resource-constructor-count", `${type.id} requires exactly one constructor`, {
        resource: type.id,
        actual: constructors.length,
      });
    }
    const constructor = constructors[0];
    ensureSupportedGenerics(constructor);
    methods.forEach(ensureSupportedGenerics);
    properties.forEach(ensureSupportedGenerics);
    consumed.add(constructor.id);
    methods.forEach(method => consumed.add(method.id));
    properties.forEach(property => consumed.add(property.id));
    output.push(docComment(type.documentation));
    output.push(`export class ${type.name} {`);
    output.push(`  constructor(${constructor.parameters.map(parameter => parameter.name).join(", ")}) {`);
    constructor.parameters.forEach(parameter => {
      output.push(
        `    validate.${validatorName(parameter.type, typeMap)}(${parameter.name}, ${quote(`${constructor.name}.${parameter.name}`)});`,
      );
    });
    output.push(
      `    runtime.construct(${quote(constructor.id)}, this, [${constructor.parameters.map(parameter => parameter.name).join(", ")}]);`,
      "  }",
      "",
    );
    for (const method of methods) {
      output.push(`  ${method.name}(${method.parameters.map(parameter => parameter.name).join(", ")}) {`);
      method.parameters.forEach(parameter => {
        output.push(
          `    validate.${validatorName(parameter.type, typeMap)}(${parameter.name}, ${quote(`${method.name}.${parameter.name}`)});`,
        );
      });
      output.push(
        `    const result = runtime.method(${quote(method.id)}, this, [${method.parameters.map(parameter => parameter.name).join(", ")}]);`,
      );
      if (method.result.type.kind === "named" && typeMap.get(method.result.type.id)?.kind === "resource") {
        output.push("    return result;");
      } else {
        output.push(
          `    validate.${validatorName(method.result.type, typeMap)}(result, ${quote(`${method.name}.result`)});`,
          "    return result;",
        );
      }
      output.push("  }", "");
    }
    for (const property of propertyGroups(properties)) {
      if (property.getter) {
        output.push(`  get ${property.name}() {`);
        output.push(
          `    const result = runtime.method(${quote(property.getter.id)}, this, []);`,
          `    validate.${validatorName(property.getter.result.type, typeMap)}(result, ${quote(`${property.name}.result`)});`,
          "    return result;",
          "  }",
          "",
        );
      }
      if (property.setter) {
        const parameter = property.setter.parameters[0];
        output.push(`  set ${property.name}(${parameter.name}) {`);
        output.push(
          `    validate.${validatorName(parameter.type, typeMap)}(${parameter.name}, ${quote(`${property.name}.${parameter.name}`)});`,
          `    runtime.method(${quote(property.setter.id)}, this, [${parameter.name}]);`,
          "  }",
          "",
        );
      }
    }
    output.push(
      "  dispose() {",
      "    return runtime.dispose(this);",
      "  }",
      "}",
      `if (Symbol.dispose) Object.defineProperty(${type.name}.prototype, Symbol.dispose, { value: ${type.name}.prototype.dispose });`,
      "",
    );
    exports.push(type.name);
  }

  const functionsByName = groupFunctions(
    ir.declarations.filter(declaration => declaration.kind === "function"),
  );
  for (const declaration of ir.declarations) {
    if (consumed.has(declaration.id)) continue;
    if (declaration.kind !== "function") {
      fail("unsupported-declaration-kind", `${declaration.id} uses ${declaration.kind}`, {
        declaration: declaration.id,
        kind: declaration.kind,
      });
    }
    const overloads = functionsByName.get(declaration.name);
    if (overloads.length > 1) {
      const dispatch = compileOverloadV1(ir, declaration.name);
      for (const branch of overloads) {
        ensureSupportedGenerics(branch);
        consumed.add(branch.id);
      }
      output.push(
        docComment(declaration.documentation, [
          `Generated overloads: ${dispatch.branches.map(branch => branch.overloadKey).join(", ")}.`,
        ]),
        `export function ${declaration.name}(...args) {`,
        "  switch (args.length) {",
      );
      for (const branch of dispatch.branches) {
        const target = overloads.find(item => item.id === branch.declarationId);
        output.push(`    case ${branch.arity}: {`);
        if (target.parameters.length > 0) {
          output.push(
            `      const [${target.parameters.map(parameter => parameter.name).join(", ")}] = args;`,
          );
        }
        for (const parameter of target.parameters) {
          output.push(
            `      validate.${validatorName(parameter.type, typeMap)}(${parameter.name}, ${quote(`${target.name}.${parameter.name}`)});`,
          );
        }
        const mappedErrors = declarationErrors(ir, target);
        const indent = mappedErrors.length > 0 ? "        " : "      ";
        if (mappedErrors.length > 0) output.push("      try {");
        output.push(
          `${indent}const result = runtime.call(${quote(target.id)}, [${target.parameters.map(parameter => parameter.name).join(", ")}]);`,
          `${indent}validate.${validatorName(target.result.type, typeMap)}(result, ${quote(`${target.name}.result`)});`,
          `${indent}return result;`,
        );
        if (mappedErrors.length > 0) {
          output.push(
            "      } catch (error) {",
            "        throw translateDeclaredError(error);",
            "      }",
          );
        }
        output.push("    }");
      }
      const accepted = dispatch.branches.map(branch => branch.arity).join(" or ");
      output.push(
        `    default: throw new TypeError(${quote(`${declaration.name} expects ${accepted} arguments`)});`,
        "  }",
        "}",
        "",
      );
      exports.push(declaration.name);
      continue;
    }
    ensureSupportedGenerics(declaration);
    const asyncPrefix = declaration.resultMode === "promise" ? "async " : "";
    output.push(docComment(declaration.documentation));
    output.push(
      `export ${asyncPrefix}function ${declaration.name}(${declaration.parameters.map(parameter => parameter.name).join(", ")}) {`,
    );
    declaration.parameters.forEach(parameter => {
      output.push(
        `  validate.${validatorName(parameter.type, typeMap)}(${parameter.name}, ${quote(`${declaration.name}.${parameter.name}`)});`,
      );
    });
    const operation =
      declaration.resultMode === "iterator"
        ? "iterate"
        : declaration.resultMode === "async-iterator"
          ? "iterateAsync"
          : "call";
    const awaitPrefix = declaration.resultMode === "promise" ? "await " : "";
    const mappedErrors = declarationErrors(ir, declaration);
    const indent = mappedErrors.length > 0 ? "    " : "  ";
    if (mappedErrors.length > 0) output.push("  try {");
    output.push(
      `${indent}const result = ${awaitPrefix}runtime.${operation}(${quote(declaration.id)}, [${declaration.parameters.map(parameter => parameter.name).join(", ")}]);`,
    );
    if (new Set(["value", "promise"]).has(declaration.resultMode)) {
      output.push(
        `${indent}validate.${validatorName(declaration.result.type, typeMap)}(result, ${quote(`${declaration.name}.result`)});`,
      );
    }
    output.push(`${indent}return result;`);
    if (mappedErrors.length > 0) {
      output.push(
        "  } catch (error) {",
        "    throw translateDeclaredError(error);",
        "  }",
      );
    }
    output.push("}", "");
    exports.push(declaration.name);
  }

  output.push(`export default Object.freeze({ ${exports.join(", ")} });`, "");
  return { source: output.join("\n"), exports };
};

const validatorName = (typeRef, typeMap) => {
  if (typeRef.kind === "named") return `assert${typeMap.get(typeRef.id)?.name}`;
  if (typeRef.kind === "primitive") {
    return `assert${typeRef.name[0].toUpperCase()}${typeRef.name.slice(1)}`;
  }
  if (typeRef.kind === "apply" && typeRef.constructor === "array") {
    return `assertArrayOf${validatorName(typeRef.arguments[0], typeMap).slice("assert".length)}`;
  }
  fail("unsupported-validator", "The JavaScript POC cannot emit this validator", { typeRef });
};

const emitValidators = (ir, typeMap) => {
  const lines = [
    "// Generated copied-value validators. This file is package-internal.",
    "const invalid = (path, expected) => { throw new TypeError(`${path} must be ${expected}`); };",
    "export const assertUnit = (value, path) => { if (value !== undefined) invalid(path, \"undefined\"); return value; };",
    "export const assertBool = (value, path) => { if (typeof value !== \"boolean\") invalid(path, \"boolean\"); return value; };",
    "export const assertUint8 = (value, path) => { if (!Number.isInteger(value) || value < 0 || value > 0xff) invalid(path, \"uint8\"); return value; };",
    "export const assertUint16 = (value, path) => { if (!Number.isInteger(value) || value < 0 || value > 0xffff) invalid(path, \"uint16\"); return value; };",
    "export const assertUint32 = (value, path) => { if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) invalid(path, \"uint32\"); return value; };",
    "export const assertInt8 = (value, path) => { if (!Number.isInteger(value) || value < -0x80 || value > 0x7f) invalid(path, \"int8\"); return value; };",
    "export const assertInt16 = (value, path) => { if (!Number.isInteger(value) || value < -0x8000 || value > 0x7fff) invalid(path, \"int16\"); return value; };",
    "export const assertInt32 = (value, path) => { if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff) invalid(path, \"int32\"); return value; };",
    "const assertBigInt = (value, path) => { if (typeof value !== \"bigint\") invalid(path, \"bigint\"); return value; };",
    "export const assertUint64 = assertBigInt;",
    "export const assertInt64 = assertBigInt;",
    "export const assertInt = assertBigInt;",
    "export const assertNat = (value, path) => { assertBigInt(value, path); if (value < 0n) invalid(path, \"non-negative bigint\"); return value; };",
    "const assertNumber = (value, path) => { if (typeof value !== \"number\" || !Number.isFinite(value)) invalid(path, \"finite number\"); return value; };",
    "export const assertFloat32 = assertNumber;",
    "export const assertFloat64 = assertNumber;",
    "export const assertString = (value, path) => { if (typeof value !== \"string\") invalid(path, \"string\"); return value; };",
    "export const assertBytes = (value, path) => { if (!(value instanceof Uint8Array)) invalid(path, \"Uint8Array\"); return value; };",
    "",
  ];
  const emittedArrays = new Set();
  const emitArray = typeRef => {
    if (typeRef.kind !== "apply" || typeRef.constructor !== "array") return;
    emitArray(typeRef.arguments[0]);
    const name = validatorName(typeRef, typeMap);
    if (emittedArrays.has(name)) return;
    emittedArrays.add(name);
    const itemValidator = validatorName(typeRef.arguments[0], typeMap);
    lines.push(
      `export const ${name} = (value, path) => {`,
      "  if (!Array.isArray(value) && !(value instanceof Uint32Array)) invalid(path, \"array\");",
      `  for (let index = 0; index < value.length; index += 1) ${itemValidator}(value[index], \`\${path}[\${index}]\`);`,
      "  return value;",
      "};",
      "",
    );
  };
  for (const type of ir.types) {
    if (type.kind === "record") type.fields.forEach(field => emitArray(field.type));
    if (type.kind === "alias") emitArray(type.target);
  }
  for (const declaration of ir.declarations) {
    declaration.parameters.forEach(parameter => emitArray(parameter.type));
    emitArray(declaration.result.type);
  }
  for (const type of ir.types.filter(item => item.kind === "record")) {
    lines.push(`export const assert${type.name} = (value, path) => {`);
    lines.push(
      "  if (value === null || typeof value !== \"object\" || Array.isArray(value)) invalid(path, \"record\");",
      `  const expected = new Set(${JSON.stringify(type.fields.map(field => field.name))});`,
      "  const unknown = Object.keys(value).filter(key => !expected.has(key));",
      "  const missing = [...expected].filter(key => !(key in value));",
      `  if (unknown.length || missing.length) throw new TypeError(\`\${path} does not match ${type.name}: missing=\${missing.join(\",\")} unknown=\${unknown.join(\",\")}\`);`,
    );
    for (const field of type.fields) {
      lines.push(
        `  ${validatorName(field.type, typeMap)}(value.${field.name}, \`\${path}.${field.name}\`);`,
      );
    }
    lines.push("  return value;", "};", "");
  }
  for (const type of ir.types.filter(item => item.kind === "alias")) {
    lines.push(
      `export const assert${type.name} = (value, path) => ${validatorName(type.target, typeMap)}(value, path);`,
      "",
    );
  }
  for (const type of ir.types.filter(item => item.kind === "callback")) {
    lines.push(
      `export const assert${type.name} = (value, path) => {`,
      '  if (typeof value !== "function") invalid(path, "function");',
      "  return value;",
      "};",
      "",
    );
  }
  return lines.join("\n");
};

const emitTypeScript = (ir, typeMap) => {
  const lines = [
    `// Generated from Binding IR SHA-256 ${hashBindingIr(ir)}.`,
    ...emitTypeDeclarations(ir, typeMap),
  ];
  if (
    ir.declarations.some(
      declaration =>
        declaration.result.type.kind === "named" &&
        typeMap.get(declaration.result.type.id)?.kind === "callback" &&
        declaration.result.ownership === "lease",
    )
  ) {
    lines.push(
      "export interface LeanOwnedCallable {",
      "  readonly disposed: boolean;",
      "  dispose(): boolean;",
      "  [Symbol.dispose](): void;",
      "}",
      "",
    );
  }
  const exports = [];
  const consumed = new Set();
  for (const error of projectedErrors(ir)) {
    lines.push(docComment(error.documentation), `export declare class ${error.name} extends Error {`);
    lines.push(`  readonly code: ${quote(error.id)};`);
    if (error.payload !== null) {
      lines.push(`  readonly payload: ${typeScriptType(error.payload, typeMap)};`);
      lines.push(
        `  constructor(payload: ${typeScriptType(error.payload, typeMap)}, options?: ErrorOptions);`,
      );
    } else {
      lines.push("  constructor(options?: ErrorOptions);");
    }
    lines.push("}", "");
    exports.push(error.name);
  }
  for (const type of ir.types.filter(item => item.kind === "resource")) {
    const { constructors, methods, properties } = declarationsForResource(ir, type.id);
    const constructor = constructors[0];
    lines.push(docComment(type.documentation), `export declare class ${type.name} {`);
    lines.push(`  constructor(${constructor.parameters.map(parameter => parameterType(parameter, typeMap)).join(", ")});`);
    consumed.add(constructor.id);
    for (const method of methods) {
      consumed.add(method.id);
      lines.push(
        `  ${method.name}(${method.parameters.map(parameter => parameterType(parameter, typeMap)).join(", ")}): ${deliveredType(method, typeMap)};`,
      );
    }
    for (const property of propertyGroups(properties)) {
      if (property.getter) consumed.add(property.getter.id);
      if (property.setter) consumed.add(property.setter.id);
      const propertyType = property.getter
        ? property.getter.result.type
        : property.setter.parameters[0].type;
      lines.push(
        `  ${property.setter ? "" : "readonly "}${property.name}: ${typeScriptType(propertyType, typeMap)};`,
      );
    }
    lines.push("  dispose(): void;", "  [Symbol.dispose](): void;", "}", "");
    exports.push(type.name);
  }
  for (const declaration of ir.declarations) {
    if (consumed.has(declaration.id)) continue;
    lines.push(docComment(declaration.documentation));
    lines.push(
      `export declare function ${declaration.name}(${declaration.parameters.map(parameter => parameterType(parameter, typeMap)).join(", ")}): ${deliveredType(declaration, typeMap)};`,
      "",
    );
    exports.push(declaration.name);
  }
  const uniqueExports = [...new Set(exports)];
  lines.push("declare const bindings: Readonly<{", ...uniqueExports.map(name => `  readonly ${name}: typeof ${name};`), "}>;", "export default bindings;", "");
  return lines.join("\n");
};

const emitDocumentation = ir => {
  const lines = [
    `# ${ir.component.name}`,
    "",
    ir.documentation.summary,
    "",
    `Binding IR SHA-256: \`${hashBindingIr(ir)}\``,
    "",
    "## Exports",
    "",
  ];
  for (const type of ir.types.filter(item => item.kind === "resource")) {
    lines.push(`### ${type.name}`, "", type.documentation.summary, "");
  }
  for (const declaration of ir.declarations.filter(item => item.kind === "function")) {
    lines.push(`### ${declaration.name}`, "", declaration.documentation.summary, "");
  }
  for (const error of projectedErrors(ir)) {
    lines.push(`### ${error.name}`, "", error.documentation.summary, "");
  }
  lines.push("## Assurance", "");
  for (const claim of ir.assurance) {
    lines.push(`- \`${claim.state}\` ${claim.claim}`);
  }
  lines.push("");
  return lines.join("\n");
};

export const generateJavaScriptPackage = ir => {
  validateBindingIr(ir);
  const coverage = analyzeJavaScriptCoverage(ir);
  if (!coverage.supported) {
    const first = coverage.gaps[0];
    fail(first.code, first.message, first.details);
  }
  ensureUniqueSurface(ir);
  const typeMap = new Map(ir.types.map(type => [type.id, type]));
  const generated = emitDeclarations(ir, typeMap);
  const packageManifest = {
    version: ir.component.version,
    type: "module",
    sideEffects: false,
    types: "./index.d.ts",
    exports: {
      ".": {
        types: "./index.d.ts",
        import: "./index.mjs",
        default: "./index.mjs",
      },
    },
    files: [
      "index.mjs",
      "index.d.ts",
      "README.md",
      "binding-manifest.json",
      "internal",
    ],
  };
  const generatedFiles = [
    "index.mjs",
    "index.d.ts",
    "internal/validators.mjs",
    "README.md",
    "binding-manifest.json",
    "package.json",
  ];
  const manifest = {
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    generator: {
      id: "lean-wasm/javascript",
      version: 1,
    },
    exports: generated.exports,
    files: generatedFiles,
    requiredInternalFiles: ["internal/runtime.mjs"],
  };
  const files = {
    "index.mjs": generated.source,
    "index.d.ts": emitTypeScript(ir, typeMap),
    "internal/validators.mjs": emitValidators(ir, typeMap),
    "README.md": emitDocumentation(ir),
    "binding-manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "package.json": `${JSON.stringify(packageManifest, null, 2)}\n`,
  };
  auditJavaScriptPackage(ir, files);
  return Object.freeze(files);
};
