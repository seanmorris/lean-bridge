import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import {
	GenericSpecializationError,
	compileFiniteGenericSpecializations,
} from "../../abi/generic-specialization.mjs";
import { auditCPackage } from "./package-audit.mjs";

/**
 * Reports C binding generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class CBindingGenerationError extends Error
{
	/**
   * Initializes the error used to report C binding generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CBindingGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new CBindingGenerationError(code, message, details);
};

const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const upper = value => snake(value).toUpperCase();
const packageName = ir => ir.component.id.slice(0, ir.component.id.lastIndexOf("@"));
const packageStem = ir => snake(packageName(ir).split("/").at(-1));
const prefix = ir => packageStem(ir);
const guard = ir => `${upper(prefix(ir))}_H`;
const internalGuard = ir => `${upper(prefix(ir))}_RUNTIME_H`;
const publicHeaderPath = ir => `include/${prefix(ir)}.h`;
const internalHeaderPath = ir => `internal/${prefix(ir)}_runtime.h`;
const implementationPath = ir => `src/${prefix(ir)}.c`;

const primitiveCType = name => {
	const types = {
		unit: "void"
		, bool: "bool"
		, uint8: "uint8_t"
		, uint16: "uint16_t"
		, uint32: "uint32_t"
		, uint64: "uint64_t"
		, int8: "int8_t"
		, int16: "int16_t"
		, int32: "int32_t"
		, int64: "int64_t"
		, float32: "float"
		, float64: "double"
	};
	return types[name] ?? null;
};

const isDynamicPrimitive = name => new Set(["string", "bytes", "nat", "int"]).has(name);
const namedType = (ir, id) => ir.types.find(type => type.id === id);

const resolveAlias = (ir, ref, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	const type = namedType(ir, ref.id);
	if(type?.kind !== "alias") return ref;
	if(seen.has(type.id)) fail("alias-cycle", `C projection found an alias cycle at ${type.id}`);
	seen.add(type.id);
	return resolveAlias(ir, type.target, seen);
};

const typeKey = ref => {
	if(ref.kind === "primitive") return ref.name;
	if(ref.kind === "named") return snake(ref.id.replace(":", "_"));
	if(ref.kind === "parameter") return snake(ref.id);
	return `${ref.constructor}_${ref.arguments.map(typeKey).join("_")}`;
};

const substitute = (ref, parameter, replacement) => {
	if(ref.kind === "parameter" && ref.id === parameter) return replacement;
	if(ref.kind !== "apply") return ref;
	return {
		...ref,
		arguments: ref.arguments.map(argument => substitute(argument, parameter, replacement))
	};
};

const finiteSpecializations = declaration => {
	if(declaration.typeParameters.length === 0) return null;
	try
	{
		return compileFiniteGenericSpecializations(declaration);
	} catch(error)
	{
		if(error instanceof GenericSpecializationError)
		{
			fail(error.code, error.message, error.details);
		}
		throw error;
	}
};

const declarationVariants = declaration => {
	const branches = finiteSpecializations(declaration);
	if(branches === null) return [{ declaration, suffix: "", specialization: null }];
	const parameter = declaration.typeParameters[0].id;
	return branches.map(branch => ({
		declaration: {
			...declaration,
			typeParameters: []
			, parameters: declaration.parameters.map(site => ({
				...site,
				type: substitute(site.type, parameter, branch.type)
			}))
			, result: {
				...declaration.result,
				type: substitute(declaration.result.type, parameter, branch.type)
			}
		}
		, suffix: `_${snake(branch.id)}`
		, specialization: branch
	}));
};

const walkType = (ref, visit) => {
	visit(ref);
	if(ref.kind === "apply") ref.arguments.forEach(argument => walkType(argument, visit));
};

const collectUsedTypes = ir => {
	const used = [];
	const push = ref => {
		const key = JSON.stringify(ref);
		if(!used.some(item => JSON.stringify(item) === key)) used.push(ref);
	};
	for(const type of ir.types)
	{
		if(type.kind === "record") type.fields.forEach(field => walkType(field.type, push));
		if(type.kind === "alias") walkType(type.target, push);
		if(type.kind === "callback")
		{
			type.callable.parameters.forEach(site => walkType(site.type, push));
			walkType(type.callable.result.type, push);
		}
	}
	for(const declaration of ir.declarations)
	{
		for(const variant of declarationVariants(declaration))
		{
			variant.declaration.parameters.forEach(site => walkType(site.type, push));
			walkType(variant.declaration.result.type, push);
			if(variant.declaration.receiver) walkType(variant.declaration.receiver.type, push);
		}
	}
	ir.errors.forEach(error => { if(error.payload) walkType(error.payload, push); });
	return used;
};

const validateCoverage = ir => {
	const names = new Map();
	const addName = (name, id) => {
		if(names.has(name))
		{
			fail("public-name-collision", `${id} and ${names.get(name)} both project as ${name}`, {
				name
				, declarations: [names.get(name), id]
			});
		}
		names.set(name, id);
	};
	for(const type of ir.types)
	{
		if(type.typeParameters.length > 0)
		{
			fail("unsupported-generic-type", `${type.id} requires a generic C type projection`, {
				type: type.id
			});
		}
		if(type.kind === "callback" && type.callable.resultMode !== "value")
		{
			fail("unsupported-async-callback", `${type.id} is asynchronous`, { type: type.id });
		}
		if(type.kind === "resource" && type.resource.disposal !== "required")
		{
			fail("unsupported-disposal-policy", `${type.id} does not require explicit disposal`, {
				type: type.id
				, disposal: type.resource.disposal
			});
		}
	}
	for(const error of ir.errors)
	{
		if(error.payload !== null)
		{
			fail("unsupported-error-payload", `${error.id} has a payload that the C POC cannot preserve`, {
				error: error.id
			});
		}
	}
	for(const ref of collectUsedTypes(ir))
	{
		const resolved = resolveAlias(ir, ref);
		if(resolved.kind === "parameter")
		{
			fail("unresolved-generic", `C projection left ${resolved.id} unresolved`);
		}
		if(resolved.kind === "apply")
		{
			if(resolved.constructor !== "array" || resolved.arguments.length !== 1)
			{
				fail("unsupported-type-application", `C projection does not support ${resolved.constructor}`, {
					constructor: resolved.constructor
				});
			}
			const element = resolveAlias(ir, resolved.arguments[0]);
			if(element.kind !== "primitive" || primitiveCType(element.name) === null)
			{
				fail("unsupported-array-element", "the C POC supports arrays of fixed-width primitives", {
					element
				});
			}
		}
	}
	for(const declaration of ir.declarations)
	{
		if(declaration.resultMode !== "value")
		{
			fail("unsupported-result-mode", `${declaration.id} uses ${declaration.resultMode}`, {
				declaration: declaration.id
				, resultMode: declaration.resultMode
			});
		}
		if(declaration.parameters.some(parameter => parameter.optional))
		{
			fail("unsupported-optional-parameter", `${declaration.id} has an optional parameter`, {
				declaration: declaration.id
			});
		}
		if(declaration.kind === "static-method")
		{
			fail("unsupported-static-method", `${declaration.id} is not implemented by the C backend`, {
				declaration: declaration.id
			});
		}
		if(declaration.receiver)
		{
			if(
				declaration.receiver.ownership !== "borrow"
        || declaration.receiver.lifetime?.scope !== "call"
			) {
				fail("unsupported-receiver-lifetime", `${declaration.id} does not borrow its receiver for one call`, {
					declaration: declaration.id
				});
			}
		}
		for(const parameter of declaration.parameters)
		{
			const resolved = resolveAlias(ir, parameter.type);
			const type = resolved.kind === "named" ? namedType(ir, resolved.id) : null;
			if(
				type
        && new Set(["resource", "callback"]).has(type.kind)
        && (parameter.ownership !== "borrow" || parameter.lifetime?.scope !== "call")
			) {
				fail("unsupported-identity-parameter", `${declaration.id}.${parameter.name} is not a call-scoped borrow`, {
					declaration: declaration.id
					, parameter: parameter.name
				});
			}
		}
		const resultRef = resolveAlias(ir, declaration.result.type);
		const resultType = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
		if(resultType?.kind === "resource")
		{
			const borrowedFromReceiver
        = declaration.result.ownership === "borrow"
        && declaration.result.lifetime?.scope === "receiver"
        && declaration.result.lifetime.anchor === "receiver";
			const explicitlyOwned
        = new Set(["lease", "transfer"]).has(declaration.result.ownership)
        && declaration.result.lifetime?.scope === "explicit";
			if(!borrowedFromReceiver && !explicitlyOwned)
			{
				fail("unsupported-resource-result", `${declaration.id} has an unsupported resource result lifetime`, {
					declaration: declaration.id
				});
			}
		}
		if(
			resultType?.kind === "callback"
      && (declaration.result.ownership !== "lease" || declaration.result.lifetime?.scope !== "explicit")
		) {
			fail("unsupported-callback-result", `${declaration.id} does not return an explicit callable lease`, {
				declaration: declaration.id
			});
		}
		for(const variant of declarationVariants(declaration))
		{
			addName(publicFunctionName(ir, variant), declaration.id);
		}
	}
	const records = ir.types.filter(type => type.kind === "record");
	const dependencies = new Map(records.map(type => [type.id, new Set()]));
	for(const type of records)
	{
		for(const field of type.fields)
		{
			const resolved = resolveAlias(ir, field.type);
			if(resolved.kind === "named" && dependencies.has(resolved.id))
			{
				dependencies.get(type.id).add(resolved.id);
			}
		}
	}
	const visiting = new Set();
	const visited = new Set();
	const visit = id => {
		if(visiting.has(id)) fail("record-cycle", `C projection found a copied record cycle at ${id}`);
		if(visited.has(id)) return;
		visiting.add(id);
		dependencies.get(id).forEach(visit);
		visiting.delete(id);
		visited.add(id);
	};
	dependencies.forEach((_, id) => visit(id));
};

const cType = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	if(resolved.kind === "primitive")
	{
		const scalar = primitiveCType(resolved.name);
		if(scalar) return scalar;
		return `${prefix(ir)}_${snake(resolved.name)}`;
	}
	if(resolved.kind === "named")
	{
		const type = namedType(ir, resolved.id);
		return `${prefix(ir)}_${snake(type.name)}`;
	}
	if(resolved.kind === "apply")
	{
		return `${prefix(ir)}_${typeKey(resolved)}_span`;
	}
	fail("unresolved-generic", `C projection cannot name ${resolved.id}`);
};

const isAggregate = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	if(resolved.kind === "primitive") return isDynamicPrimitive(resolved.name);
	if(resolved.kind === "apply") return true;
	if(resolved.kind === "named") return namedType(ir, resolved.id)?.kind === "record";
	return false;
};

const isUnit = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	return resolved.kind === "primitive" && resolved.name === "unit";
};

const siteInput = (ir, site, name, { runtime = false } = {}) => {
	const resolved = resolveAlias(ir, site.type);
	if(resolved.kind === "named")
	{
		const type = namedType(ir, resolved.id);
		if(type.kind === "resource")
		{
			return runtime ? `uintptr_t ${name}` : `const ${cType(ir, resolved)} *${name}`;
		}
		if(type.kind === "callback")
		{
			return `const ${cType(ir, resolved)} *${name}`;
		}
	}
	const type = cType(ir, resolved);
	return isAggregate(ir, resolved) ? `const ${type} *${name}` : `${type} ${name}`;
};

const siteOutput = (ir, site, { runtime = false } = {}) => {
	if(isUnit(ir, site.type)) return null;
	const resolved = resolveAlias(ir, site.type);
	if(resolved.kind === "named")
	{
		const type = namedType(ir, resolved.id);
		if(type.kind === "resource" || type.kind === "callback")
		{
			if(runtime) return "uintptr_t *out";
			if(type.kind === "resource" && site.ownership === "borrow")
			{
				return `const ${ownedType(ir, type)} **out`;
			}
			return `${ownedType(ir, type)} **out`;
		}
	}
	return `${cType(ir, resolved)} *out`;
};

const ownedType = (ir, type) => type.kind === "callback"
	? `${prefix(ir)}_owned_${snake(type.name)}`
	: `${prefix(ir)}_${snake(type.name)}`;

const resourceForDeclaration = (ir, declaration) => {
	const site = declaration.receiver ?? declaration.result;
	const ref = site?.type;
	if(ref?.kind !== "named") return null;
	const type = namedType(ir, ref.id);
	return type?.kind === "resource" ? type : null;
};

const publicFunctionName = (ir, variant) => {
	const declaration = variant.declaration;
	if(declaration.kind === "constructor")
	{
		const resource = resourceForDeclaration(ir, declaration);
		return `${prefix(ir)}_${snake(resource.name)}_create${variant.suffix}`;
	}
	if(new Set(["method", "property"]).has(declaration.kind))
	{
		const resource = resourceForDeclaration(ir, declaration);
		const propertyRole = declaration.kind === "property"
			? declaration.parameters.length === 0 ? "get_" : "set_"
			: "";
		return `${prefix(ir)}_${snake(resource.name)}_${propertyRole}${snake(declaration.name)}${variant.suffix}`;
	}
	return `${prefix(ir)}_${snake(declaration.name)}${variant.suffix}`;
};

const runtimeFieldName = (ir, variant) => publicFunctionName(ir, variant).slice(prefix(ir).length + 1);

const publicParameters = (ir, variant) => {
	const declaration = variant.declaration;
	const parts = [];
	if(declaration.receiver) parts.push(siteInput(ir, declaration.receiver, "self"));
	declaration.parameters.forEach(site => parts.push(siteInput(ir, site, snake(site.name))));
	const output = siteOutput(ir, declaration.result);
	if(output) parts.push(output);
	parts.push(`${prefix(ir)}_error *error`);
	return parts;
};

const runtimeParameters = (ir, variant) => {
	const declaration = variant.declaration;
	const parts = ["void *context"];
	if(declaration.receiver) parts.push(siteInput(ir, declaration.receiver, "self", { runtime: true }));
	declaration.parameters.forEach(site => parts.push(siteInput(ir, site, snake(site.name), { runtime: true })));
	const output = siteOutput(ir, declaration.result, { runtime: true });
	if(output) parts.push(output);
	parts.push(`${prefix(ir)}_error *error`);
	return parts;
};

const dynamicTypes = ir => collectUsedTypes(ir).filter(ref => {
  const resolved = resolveAlias(ir, ref);
  return (resolved.kind === "primitive" && isDynamicPrimitive(resolved.name)) || resolved.kind === "apply";
});

const uniqueBy = (items, key) => {
	const seen = new Set();
	return items.filter(item => {
    const value = key(item);
    if(seen.has(value)) return false;
    seen.add(value);
    return true;
	});
};

const emitPublicHeader = ir => {
	const p = prefix(ir);
	const macro = upper(p);
	const hash = hashBindingIr(ir);
	const lines = [
		`#ifndef ${guard(ir)}`
		, `#define ${guard(ir)}`
		, ""
		, "#include <stdbool.h>"
		, "#include <stddef.h>"
		, "#include <stdint.h>"
		, ""
		, "#ifdef __cplusplus"
		, 'extern "C" {'
		, "#endif"
		, ""
		, `#define ${macro}_BINDING_ABI_VERSION 1u`
		, `#define ${macro}_BINDING_IR_SHA256 \"${hash}\"`
		, ""
		, `typedef enum ${p}_status {`
		, `  ${macro}_STATUS_OK = 0,`
		, `  ${macro}_STATUS_INVALID_ARGUMENT = 1,`
		, `  ${macro}_STATUS_RUNTIME_UNAVAILABLE = 2,`
		, `  ${macro}_STATUS_RUNTIME_REJECTED = 3,`
		, `  ${macro}_STATUS_DECLARED_ERROR = 4,`
		, `  ${macro}_STATUS_UNEXPECTED_ERROR = 5`
		, `} ${p}_status;`
		, ""
		, `typedef enum ${p}_error_code {`
		, `  ${macro}_ERROR_NONE = 0,`
		, `  ${macro}_ERROR_INVALID_ARGUMENT = 1,`
		, `  ${macro}_ERROR_RUNTIME_UNAVAILABLE = 2,`
		, ...ir.errors.map((error, index) => `  ${macro}_ERROR_${upper(error.name)} = ${100 + index},`)
		, `  ${macro}_ERROR_UNEXPECTED = 65535`
		, `} ${p}_error_code;`
		, ""
		, `typedef struct ${p}_error {`
		, `  ${p}_error_code code;`
		, "  const char *message;"
		, "  size_t message_length;"
		, "} " + `${p}_error;`
		, ""
	];

	for(const ref of uniqueBy(dynamicTypes(ir), ref => cType(ir, ref)))
	{
		const resolved = resolveAlias(ir, ref);
		const type = cType(ir, resolved);
		const element = resolved.kind === "apply"
			? primitiveCType(resolveAlias(ir, resolved.arguments[0]).name)
			: resolved.name === "string" ? "char" : resolved.name === "bytes" ? "uint8_t" : "uint32_t";
		lines.push(
			`typedef struct ${type} {`,
			`  const ${element} *data;`,
			"  size_t length;",
			"  void *owner;",
			"  void (*release)(void *owner);",
			...(resolved.kind === "primitive" && resolved.name === "int" ? ["  bool negative;"] : []),
			`} ${type};`,
			"",
			`void ${type}_clear(${type} *value);`,
			"",
		);
	}

	const records = ir.types.filter(type => type.kind === "record");
	for(const type of records)
	{
		const name = cType(ir, { kind: "named", id: type.id });
		lines.push(`typedef struct ${name} {`);
		for(const field of type.fields)
		{
			lines.push(`  ${cType(ir, field.type)} ${snake(field.name)};`);
		}
		lines.push(`} ${name};`, "", `void ${name}_clear(${name} *value);`, "");
	}

	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		lines.push(`typedef struct ${cType(ir, { kind: "named", id: type.id })} ${cType(ir, { kind: "named", id: type.id })};`);
	}
	if(ir.types.some(type => type.kind === "resource")) lines.push("");

	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const callback = cType(ir, { kind: "named", id: type.id });
		const callable = type.callable;
		const callbackParts = ["void *context"];
		callable.parameters.forEach(site => callbackParts.push(siteInput(ir, site, snake(site.name))));
		const callbackOutput = siteOutput(ir, callable.result);
		if(callbackOutput) callbackParts.push(callbackOutput);
		callbackParts.push(`${p}_error *error`);
		lines.push(
			`typedef ${p}_status (*${callback}_fn)(${callbackParts.join(", ")});`,
			`typedef struct ${callback} {`,
			`  ${callback}_fn call;`,
			"  void *context;",
			`} ${callback};`,
			`typedef struct ${ownedType(ir, type)} ${ownedType(ir, type)};`,
			"",
			`${p}_status ${ownedType(ir, type)}_call(const ${ownedType(ir, type)} *self${callable.parameters.length ? ", " : ""}${callable.parameters.map(site => siteInput(ir, site, snake(site.name))).concat(callbackOutput ? [callbackOutput] : []).concat([`${p}_error *error`]).join(", ")});`,
			`void ${ownedType(ir, type)}_dispose(${ownedType(ir, type)} **self);`,
			"",
		);
	}

	const exports = [];
	for(const declaration of ir.declarations)
	{
		for(const variant of declarationVariants(declaration))
		{
			const name = publicFunctionName(ir, variant);
			exports.push(name);
			lines.push(`${p}_status ${name}(${publicParameters(ir, variant).join(", ")});`);
		}
	}
	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		const name = cType(ir, { kind: "named", id: type.id });
		exports.push(`${name}_dispose`);
		lines.push(`void ${name}_dispose(${name} **self);`);
	}
	lines.push(
		"",
		"#ifdef __cplusplus",
		"}",
		"#endif",
		"",
		`#endif /* ${guard(ir)} */`,
		"",
	);
	return { source: lines.join("\n"), exports };
};

const emitInternalHeader = ir => {
	const p = prefix(ir);
	const lines = [
		`#ifndef ${internalGuard(ir)}`
		, `#define ${internalGuard(ir)}`
		, ""
		, `#include \"${p}.h\"`
		, ""
		, "#ifdef __cplusplus"
		, 'extern "C" {'
		, "#endif"
		, ""
		, `typedef struct ${p}_runtime_v1 {`
		, "  uint32_t abi_version;"
		, "  void *context;"
		, `  ${p}_status (*initialize)(void *context, ${p}_error *error);`
	];
	for(const declaration of ir.declarations)
	{
		for(const variant of declarationVariants(declaration))
		{
			lines.push(`  ${p}_status (*${runtimeFieldName(ir, variant)})(${runtimeParameters(ir, variant).join(", ")});`);
		}
	}
	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		lines.push(`  void (*${snake(type.name)}_dispose)(void *context, uintptr_t value);`);
	}
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const callable = type.callable;
		const parts = ["void *context", "uintptr_t self"];
		callable.parameters.forEach(site => parts.push(siteInput(ir, site, snake(site.name), { runtime: true })));
		const output = siteOutput(ir, callable.result, { runtime: true });
		if(output) parts.push(output);
		parts.push(`${p}_error *error`);
		lines.push(
			`  ${p}_status (*${snake(type.name)}_call)(${parts.join(", ")});`,
			`  void (*${snake(type.name)}_dispose)(void *context, uintptr_t value);`,
		);
	}
	lines.push(
		`} ${p}_runtime_v1;`,
		"",
		`${p}_status ${p}_runtime_install_v1(const ${p}_runtime_v1 *runtime, ${p}_error *error);`,
		"",
		"#ifdef __cplusplus",
		"}",
		"#endif",
		"",
		`#endif /* ${internalGuard(ir)} */`,
		"",
	);
	return lines.join("\n");
};

const inputExpression = (ir, site, name) => {
	const resolved = resolveAlias(ir, site.type);
	if(resolved.kind === "named" && namedType(ir, resolved.id)?.kind === "resource")
	{
		return `${name}->value`;
	}
	return name;
};

const emitImplementation = ir => {
	const p = prefix(ir);
	const macro = upper(p);
	const lines = [
		`#include \"${p}.h\"`
		, `#include \"${p}_runtime.h\"`
		, ""
		, "#include <stdlib.h>"
		, "#include <string.h>"
		, ""
	];
	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		const name = cType(ir, { kind: "named", id: type.id });
		lines.push(`struct ${name} { uintptr_t value; };`);
	}
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		lines.push(`struct ${ownedType(ir, type)} { uintptr_t value; };`);
	}
	lines.push(
		"",
		`static const ${p}_runtime_v1 *${p}_runtime = NULL;`,
		`static const ${p}_runtime_v1 *${p}_attempted_runtime = NULL;`,
		`static ${p}_status ${p}_initialization_failure = ${macro}_STATUS_RUNTIME_UNAVAILABLE;`,
		"",
		`static ${p}_status ${p}_fail(${p}_status status, ${p}_error_code code, const char *message, ${p}_error *error) {`,
		"  if (error != NULL) {",
		"    error->code = code;",
		"    error->message = message;",
		"    error->message_length = strlen(message);",
		"  }",
		"  return status;",
		"}",
		"",
		`static ${p}_status ${p}_ready(${p}_error *error) {`,
		`  if (${p}_runtime != NULL) return ${macro}_STATUS_OK;`,
		`  if (${p}_attempted_runtime != NULL) return ${p}_fail(${p}_initialization_failure, ${macro}_ERROR_UNEXPECTED, \"shared runtime initialization failed and will not be retried\", error);`,
		`  return ${p}_fail(${macro}_STATUS_RUNTIME_UNAVAILABLE, ${macro}_ERROR_RUNTIME_UNAVAILABLE, \"the shared runtime is not installed\", error);`,
		"}",
		"",
		`${p}_status ${p}_runtime_install_v1(const ${p}_runtime_v1 *runtime, ${p}_error *error) {`,
		`  if (runtime == NULL || runtime->abi_version != ${macro}_BINDING_ABI_VERSION) {`,
		`    return ${p}_fail(${macro}_STATUS_RUNTIME_REJECTED, ${macro}_ERROR_INVALID_ARGUMENT, \"the runtime ABI is incompatible\", error);`,
		"  }",
		`  if (${p}_attempted_runtime != NULL) {`,
		`    if (${p}_attempted_runtime != runtime) return ${p}_fail(${macro}_STATUS_RUNTIME_REJECTED, ${macro}_ERROR_INVALID_ARGUMENT, \"a different shared runtime is already installed\", error);`,
		`    if (${p}_runtime != NULL) return ${macro}_STATUS_OK;`,
		`    return ${p}_fail(${p}_initialization_failure, ${macro}_ERROR_UNEXPECTED, \"shared runtime initialization failed and will not be retried\", error);`,
		"  }",
		`  ${p}_attempted_runtime = runtime;`,
		`  ${p}_runtime = runtime;`,
		"  if (runtime->initialize == NULL) return " + `${macro}_STATUS_OK;`,
		`  ${p}_status status = runtime->initialize(runtime->context, error);`,
		`  if (status != ${macro}_STATUS_OK) {`,
		`    ${p}_initialization_failure = status;`,
		`    ${p}_runtime = NULL;`,
		"  }",
		"  return status;",
		"}",
		"",
	);

	for(const ref of uniqueBy(dynamicTypes(ir), ref => cType(ir, ref)))
	{
		const type = cType(ir, ref);
		lines.push(
			`void ${type}_clear(${type} *value) {`,
			"  if (value == NULL) return;",
			"  if (value->release != NULL && value->owner != NULL) value->release(value->owner);",
			"  memset(value, 0, sizeof(*value));",
			"}",
			"",
		);
	}

	for(const type of ir.types.filter(type => type.kind === "record"))
	{
		const name = cType(ir, { kind: "named", id: type.id });
		const clearable = type.fields.filter(field => {
      const resolved = resolveAlias(ir, field.type);
      if((resolved.kind === "primitive" && isDynamicPrimitive(resolved.name)) || resolved.kind === "apply") return true;
      return resolved.kind === "named" && namedType(ir, resolved.id)?.kind === "record";
		});
		lines.push(`void ${name}_clear(${name} *value) {`, "  if (value == NULL) return;");
		for(const field of clearable)
		{
			lines.push(`  ${cType(ir, field.type)}_clear(&value->${snake(field.name)});`);
		}
		lines.push("  memset(value, 0, sizeof(*value));", "}", "");
	}

	for(const declaration of ir.declarations)
	{
		for(const variant of declarationVariants(declaration))
		{
			const current = variant.declaration;
			const name = publicFunctionName(ir, variant);
			const field = runtimeFieldName(ir, variant);
			lines.push(`${p}_status ${name}(${publicParameters(ir, variant).join(", ")}) {`);
			lines.push(`  ${p}_status ready = ${p}_ready(error);`, `  if (ready != ${macro}_STATUS_OK) return ready;`);
			const pointerInputs = [];
			if(current.receiver) pointerInputs.push("self");
			for(const site of current.parameters) if(isAggregate(ir, site.type) || (site.type.kind === "named" && new Set(["resource", "callback"]).has(namedType(ir, site.type.id)?.kind))) pointerInputs.push(snake(site.name));
			if(!isUnit(ir, current.result.type)) pointerInputs.push("out");
			if(pointerInputs.length > 0)
			{
				lines.push(`  if (${pointerInputs.map(item => `${item} == NULL`).join(" || ")}) {`);
				lines.push(`    return ${p}_fail(${macro}_STATUS_INVALID_ARGUMENT, ${macro}_ERROR_INVALID_ARGUMENT, \"a required C argument is null\", error);`, "  }");
			}
			lines.push(`  if (${p}_runtime->${field} == NULL) return ${p}_fail(${macro}_STATUS_RUNTIME_REJECTED, ${macro}_ERROR_RUNTIME_UNAVAILABLE, \"the runtime does not implement ${name}\", error);`);
			const resultRef = resolveAlias(ir, current.result.type);
			const resultNamed = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
			const args = [`${p}_runtime->context`];
			if(current.receiver) args.push(inputExpression(ir, current.receiver, "self"));
			current.parameters.forEach(site => args.push(inputExpression(ir, site, snake(site.name))));
			if(resultNamed && new Set(["resource", "callback"]).has(resultNamed.kind))
			{
				lines.push("  uintptr_t result_identity = 0;");
				args.push("&result_identity");
			} else if(!isUnit(ir, current.result.type))
			{
				args.push("out");
			}
			args.push("error");
			lines.push(`  ${p}_status status = ${p}_runtime->${field}(${args.join(", ")});`);
			if(resultNamed?.kind === "resource")
			{
				const resultType = cType(ir, resultRef);
				if(current.result.ownership === "borrow" && current.result.lifetime?.scope === "receiver")
				{
					lines.push(
						`  if (status == ${macro}_STATUS_OK && result_identity != self->value) return ${p}_fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, \"the runtime broke receiver identity\", error);`,
						`  if (status == ${macro}_STATUS_OK) *out = self;`,
					);
				} else
				{
					lines.push(
						`  if (status == ${macro}_STATUS_OK) {`,
						`    ${resultType} *owned = (${resultType} *)malloc(sizeof(*owned));`,
						`    if (owned == NULL) return ${p}_fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, \"resource wrapper allocation failed\", error);`,
						"    owned->value = result_identity;",
						"    *out = owned;",
						"  }",
					);
				}
			} else if(resultNamed?.kind === "callback")
			{
				const resultType = ownedType(ir, resultNamed);
				lines.push(
					`  if (status == ${macro}_STATUS_OK) {`,
					`    ${resultType} *owned = (${resultType} *)malloc(sizeof(*owned));`,
					`    if (owned == NULL) return ${p}_fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, \"callable wrapper allocation failed\", error);`,
					"    owned->value = result_identity;",
					"    *out = owned;",
					"  }",
				);
			}
			lines.push("  return status;", "}", "");
		}
	}

	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		const name = cType(ir, { kind: "named", id: type.id });
		lines.push(
			`void ${name}_dispose(${name} **self) {`,
			"  if (self == NULL || *self == NULL) return;",
			`  if (${p}_runtime != NULL && ${p}_runtime->${snake(type.name)}_dispose != NULL) ${p}_runtime->${snake(type.name)}_dispose(${p}_runtime->context, (*self)->value);`,
			"  free(*self);",
			"  *self = NULL;",
			"}",
			"",
		);
	}

	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const callable = type.callable;
		const owned = ownedType(ir, type);
		const args = [`${p}_runtime->context`, "self->value", ...callable.parameters.map(site => snake(site.name))];
		const output = siteOutput(ir, callable.result);
		if(output) args.push("out");
		args.push("error");
		const publicArgs = [`const ${owned} *self`, ...callable.parameters.map(site => siteInput(ir, site, snake(site.name)))];
		if(output) publicArgs.push(output);
		publicArgs.push(`${p}_error *error`);
		lines.push(
			`${p}_status ${owned}_call(${publicArgs.join(", ")}) {`,
			`  ${p}_status ready = ${p}_ready(error);`,
			`  if (ready != ${macro}_STATUS_OK) return ready;`,
			`  if (self == NULL${output ? " || out == NULL" : ""}) return ${p}_fail(${macro}_STATUS_INVALID_ARGUMENT, ${macro}_ERROR_INVALID_ARGUMENT, \"a required C argument is null\", error);`,
			`  if (${p}_runtime->${snake(type.name)}_call == NULL) return ${p}_fail(${macro}_STATUS_RUNTIME_REJECTED, ${macro}_ERROR_RUNTIME_UNAVAILABLE, \"the runtime does not implement callable invocation\", error);`,
			`  return ${p}_runtime->${snake(type.name)}_call(${args.join(", ")});`,
			"}",
			"",
			`void ${owned}_dispose(${owned} **self) {`,
			"  if (self == NULL || *self == NULL) return;",
			`  if (${p}_runtime != NULL && ${p}_runtime->${snake(type.name)}_dispose != NULL) ${p}_runtime->${snake(type.name)}_dispose(${p}_runtime->context, (*self)->value);`,
			"  free(*self);",
			"  *self = NULL;",
			"}",
			"",
		);
	}
	return lines.join("\n");
};

const emitDocumentation = ir => {
	const p = prefix(ir);
	const lines = [
		`# ${ir.component.name} C binding`
		, ""
		, ir.documentation.summary
		, ""
		, "Include the generated public header and call its named functions. The package runtime installs the component adapter before application code starts."
		, ""
		, "Copied records preserve booleans, fixed-width integers, strings, bytes, and typed spans as C fields. Dynamic fields carry an optional release callback. Call the generated clear function for values returned by the runtime."
		, ""
		, "Identity-bearing values use opaque C types. Constructors return owned pointers. Pass the address of an owned pointer to its generated dispose function. Borrowed results remain owned by their declared anchor."
		, ""
		, "Every operation returns a status. The optional error output identifies declared and boundary failures without changing the function signature."
		, ""
		, "```c"
		, `#include <${p}.h>`
		, ""
	];
	const resource = ir.types.find(type => type.kind === "resource");
	const constructor = ir.declarations.find(declaration => declaration.kind === "constructor");
	if(resource && constructor)
	{
		const type = cType(ir, { kind: "named", id: resource.id });
		lines.push(
			`${p}_error error = {0};`,
			`${type} *box = NULL;`,
			`${publicFunctionName(ir, declarationVariants(constructor)[0])}(41, &box, &error);`,
			`${type}_dispose(&box);`,
		);
	}
	lines.push("```", "", `Binding IR SHA-256: \`${hashBindingIr(ir)}\``, "");
	return lines.join("\n");
};

/**
 * Generates C binding package from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generateCBindingPackage = ir => {
	validateBindingIr(ir);
	validateCoverage(ir);
	const publicHeader = emitPublicHeader(ir);
	const files = {
		[publicHeaderPath(ir)]: publicHeader.source
		, [internalHeaderPath(ir)]: emitInternalHeader(ir)
		, [implementationPath(ir)]: emitImplementation(ir)
		, "README.md": emitDocumentation(ir)
	};
	const manifest = {
		schemaVersion: 1
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, generator: { id: "lean-wasm/c", version: 1 }
		, publicHeader: publicHeaderPath(ir)
		, internalHeader: internalHeaderPath(ir)
		, implementation: implementationPath(ir)
		, exports: publicHeader.exports
		, files: [
			publicHeaderPath(ir)
			, internalHeaderPath(ir)
			, implementationPath(ir)
			, "README.md"
			, "binding-manifest.json"
		]
	};
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	auditCPackage(ir, files);
	return Object.freeze(files);
};
