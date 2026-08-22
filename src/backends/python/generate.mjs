/**
 * Implements the generate module in the Python backend.
 *
 * @file
 */

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import {
	GenericSpecializationError,
	compileFiniteGenericSpecializations,
} from "../../abi/generic-specialization.mjs";
import { auditPythonPackage } from "./package-audit.mjs";

/**
 * Reports Python binding generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class PythonBindingGenerationError extends Error
{
	/**
   * Initializes the error used to report Python binding generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PythonBindingGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PythonBindingGenerationError(code, message, details);
};

const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const packageName = ir => snake(ir.component.id.slice(0, ir.component.id.lastIndexOf("@")).split("/").at(-1));
const namedType = (ir, id) => ir.types.find(type => type.id === id);

const resolveAlias = (ir, ref, seen = new Set()) => {
	if(ref.kind !== "named") return ref;
	const type = namedType(ir, ref.id);
	if(type?.kind !== "alias") return ref;
	if(seen.has(type.id)) fail("alias-cycle", `Python projection found an alias cycle at ${type.id}`);
	seen.add(type.id);
	return resolveAlias(ir, type.target, seen);
};

const pythonType = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	if(resolved.kind === "primitive")
	{
		if(resolved.name === "unit") return "None";
		if(resolved.name === "bool") return "bool";
		if(resolved.name === "string") return "str";
		if(resolved.name === "bytes") return "bytes";
		if(new Set(["float32", "float64"]).has(resolved.name)) return "float";
		return "int";
	}
	if(resolved.kind === "named") return namedType(ir, resolved.id).name;
	if(resolved.kind === "parameter") return resolved.id;
	const args = resolved.arguments.map(argument => pythonType(ir, argument));
	if(resolved.constructor === "array") return `tuple[${args[0]}, ...]`;
	if(resolved.constructor === "option") return `${args[0]} | None`;
	if(resolved.constructor === "result") return `Ok[${args[0]}] | Err[${args[1]}]`;
	return `tuple[${args.join(", ")}${args.length === 1 ? "," : ""}]`;
};

const substitute = (ref, parameter, replacement) => {
	if(ref.kind === "parameter" && ref.id === parameter) return replacement;
	if(ref.kind !== "apply") return ref;
	return { ...ref, arguments: ref.arguments.map(item => substitute(item, parameter, replacement)) };
};

const specializations = declaration => {
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

const variants = declaration => {
	const branches = specializations(declaration);
	if(branches === null) return [{ declaration, suffix: "", specialization: null }];
	const parameter = declaration.typeParameters[0].id;
	return branches.map(branch => ({
		declaration: {
			...declaration,
			typeParameters: []
			, parameters: declaration.parameters.map(site => ({ ...site, type: substitute(site.type, parameter, branch.type) }))
			, result: { ...declaration.result, type: substitute(declaration.result.type, parameter, branch.type) }
		}
		, suffix: `_${snake(branch.id)}`
		, specialization: branch
	}));
};

const resourceFor = (ir, declaration) => {
	if(declaration.owner)
	{
		const owner = namedType(ir, declaration.owner);
		if(owner?.kind === "resource") return owner;
	}
	const ref = declaration.receiver?.type ?? declaration.result.type;
	if(ref.kind !== "named") return null;
	const type = namedType(ir, ref.id);
	return type?.kind === "resource" ? type : null;
};

const runtimeName = (ir, declaration, suffix = "") => {
	const resource = resourceFor(ir, declaration);
	const role = declaration.kind === "constructor" ? "new"
		: declaration.kind === "property" ? `${declaration.parameters.length === 0 ? "get" : "set"}_${snake(declaration.name)}`
			: snake(declaration.name);
	return `${resource ? `${snake(resource.name)}_` : ""}${role}${suffix}`;
};

const isIdentity = (ir, ref) => {
	const resolved = resolveAlias(ir, ref);
	return resolved.kind === "named" && namedType(ir, resolved.id).representation === "identity";
};

const validateCoverage = ir => {
	for(const error of ir.errors)
	{
		if(error.payload !== null)
		{
			fail("unsupported-error-payload", `${error.id} has a payload that the Python POC cannot preserve`, {
				error: error.id
			});
		}
	}
	for(const type of ir.types)
	{
		if(type.typeParameters.length > 0)
		{
			fail("unsupported-generic-type", `${type.id} requires a generic Python class`, { type: type.id });
		}
		if(type.kind === "callback" && (
			type.callable.parameters.some(site => isIdentity(ir, site.type))
      || isIdentity(ir, type.callable.result.type)
		)) {
			fail("unsupported-callback-identity", `${type.id} carries an identity-bearing value`, { type: type.id });
		}
		if(type.kind === "resource" && type.resource.disposal === "runtime")
		{
			fail("unsupported-disposal-policy", `${type.id} has no host-visible disposal`, { type: type.id });
		}
	}
	const names = new Map();
	for(const declaration of ir.declarations)
	{
		if(declaration.parameters.some(parameter => parameter.optional))
		{
			fail("unsupported-optional-parameter", `${declaration.id} has an optional parameter`, {
				declaration: declaration.id
			});
		}
		if(declaration.receiver && (
			declaration.receiver.ownership !== "borrow"
      || declaration.receiver.lifetime?.scope !== "call"
		)) {
			fail("unsupported-receiver-lifetime", `${declaration.id} does not borrow its receiver for one call`);
		}
		for(const parameter of declaration.parameters)
		{
			if(isIdentity(ir, parameter.type) && (
				parameter.ownership !== "borrow" || parameter.lifetime?.scope !== "call"
			)) {
				fail("unsupported-identity-parameter", `${declaration.id}.${parameter.name} is not a call-scoped borrow`);
			}
		}
		const resultRef = resolveAlias(ir, declaration.result.type);
		const result = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
		if(result?.kind === "resource")
		{
			const borrowed = declaration.result.ownership === "borrow" && declaration.result.lifetime?.scope === "receiver";
			const owned = declaration.kind === "constructor" && declaration.result.ownership === "lease" && declaration.result.lifetime?.scope === "explicit";
			if(!borrowed && !owned) fail("unsupported-resource-result", `${declaration.id} has an unsupported resource result`);
		}
		if(result?.kind === "callback" && (
			declaration.result.ownership !== "lease" || declaration.result.lifetime?.scope !== "explicit"
		)) {
			fail("unsupported-callback-result", `${declaration.id} does not return an explicit callable lease`);
		}
		if(declaration.kind === "function" && declaration.typeParameters.length === 0)
		{
			const existing = names.get(declaration.name);
			if(existing) fail("unsupported-overload", `${declaration.id} overloads ${existing} in Python POC`);
			names.set(declaration.name, declaration.id);
		}
		variants(declaration);
	}
	for(const type of ir.types.filter(item => item.kind === "resource"))
	{
		const groups = new Map();
		for(const property of ir.declarations.filter(item => item.kind === "property" && resourceFor(ir, item)?.id === type.id))
		{
			const group = groups.get(property.name) ?? {};
			const role = property.parameters.length === 0 ? "getter" : "setter";
			if(group[role]) fail("duplicate-property-accessor", `${type.id}.${property.name} has two ${role}s`);
			group[role] = property;
			groups.set(property.name, group);
		}
		for(const [name, group] of groups)
		{
			if(!group.getter && group.setter)
			{
				fail("write-only-property", `${type.id}.${name} cannot project as a Python property without a getter`);
			}
		}
	}
};

const typeKey = ref => {
	if(ref.kind === "primitive") return ref.name;
	if(ref.kind === "named") return snake(ref.id.replace(":", "_"));
	if(ref.kind === "parameter") return snake(ref.id);
	return `${ref.constructor}_${ref.arguments.map(typeKey).join("_")}`;
};

const collectRefs = ir => {
	const refs = new Map();
	const add = ref => {
		const resolved = resolveAlias(ir, ref);
		const key = JSON.stringify(resolved);
		if(!refs.has(key)) refs.set(key, resolved);
		if(resolved.kind === "apply") resolved.arguments.forEach(add);
	};
	for(const type of ir.types)
	{
		if(type.kind === "record") type.fields.forEach(field => add(field.type));
		if(type.kind === "variant")
		{
			type.cases.forEach(variantCase => variantCase.fields.forEach(field => add(field.type)));
		}
		if(type.kind === "alias") add(type.target);
		if(type.kind === "callback")
		{
			type.callable.parameters.forEach(site => add(site.type));
			add(type.callable.result.type);
		}
	}
	for(const declaration of ir.declarations)
	{
		for(const variant of variants(declaration))
		{
			variant.declaration.parameters.forEach(site => add(site.type));
			add(variant.declaration.result.type);
		}
	}
	return [...refs.values()];
};

const validatorName = ref => `_validate_${typeKey(ref)}`;

const emitValidators = ir => {
	const lines = [];
	for(const ref of collectRefs(ir))
	{
		const name = validatorName(ref);
		if(ref.kind === "primitive")
		{
			const n = ref.name;
			lines.push(`def ${name}(value: object, path: str) -> None:`);
			if(n === "unit") lines.push("    if value is not None: raise TypeError(f\"{path} must be None\")");
			else if(n === "bool") lines.push("    if type(value) is not bool: raise TypeError(f\"{path} must be bool\")");
      else if(n === "string") lines.push("    if not isinstance(value, str): raise TypeError(f\"{path} must be str\")");
      else if(n === "bytes") lines.push("    if not isinstance(value, bytes): raise TypeError(f\"{path} must be bytes\")");
        else if(n.startsWith("uint")) lines.push(`    if type(value) is not int or value < 0 or value > ${(2n ** BigInt(Number(n.slice(4))) - 1n).toString()}: raise ValueError(f\"{path} must be ${n}\")`);
        else if(n.startsWith("int") && n !== "int") lines.push(`    if type(value) is not int or value < ${(-(2n ** BigInt(Number(n.slice(3)) - 1))).toString()} or value > ${(2n ** BigInt(Number(n.slice(3)) - 1) - 1n).toString()}: raise ValueError(f\"{path} must be ${n}\")`);
        else if(n === "nat") lines.push("    if type(value) is not int or value < 0: raise ValueError(f\"{path} must be nat\")");
      else if(n === "int") lines.push("    if type(value) is not int: raise TypeError(f\"{path} must be int\")");
      else lines.push("    if isinstance(value, bool) or not isinstance(value, (int, float)): raise TypeError(f\"{path} must be float\")");
			lines.push("");
		} else if(ref.kind === "named")
		{
			const type = namedType(ir, ref.id);
			const condition = type.kind === "callback"
				? "callable(value)"
				: `isinstance(value, ${type.name})`;
			lines.push(
				`def ${name}(value: object, path: str) -> None:`,
				`    if not ${condition}: raise TypeError(f\"{path} must be ${type.kind === "callback" ? "callable" : type.name}\")`,
				"",
			);
		} else if(ref.kind === "apply")
		{
			lines.push(`def ${name}(value: object, path: str) -> None:`);
			if(ref.constructor === "array")
			{
				lines.push(
					"    if not isinstance(value, tuple): raise TypeError(f\"{path} must be tuple\")",
					"    for index, item in enumerate(value):",
					`        ${validatorName(resolveAlias(ir, ref.arguments[0]))}(item, f\"{path}[{index}]\")`,
				);
			} else if(ref.constructor === "option")
			{
				lines.push("    if value is not None:", `        ${validatorName(resolveAlias(ir, ref.arguments[0]))}(value, path)`);
			} else if(ref.constructor === "tuple")
			{
				lines.push(`    if not isinstance(value, tuple) or len(value) != ${ref.arguments.length}: raise TypeError(f\"{path} must be a ${ref.arguments.length}-tuple\")`);
				ref.arguments.forEach((argument, index) => lines.push(`    ${validatorName(resolveAlias(ir, argument))}(value[${index}], f\"{path}[${index}]\")`));
			} else
			{
				lines.push(
					"    if isinstance(value, Ok):",
					`        ${validatorName(resolveAlias(ir, ref.arguments[0]))}(value.value, f\"{path}.value\")`,
					"    elif isinstance(value, Err):",
					`        ${validatorName(resolveAlias(ir, ref.arguments[1]))}(value.error, f\"{path}.error\")`,
					"    else:",
					"        raise TypeError(f\"{path} must be Ok or Err\")",
				);
			}
			lines.push("");
		}
	}
	return lines;
};

const docstring = documentation => JSON.stringify([documentation.summary, documentation.details].filter(Boolean).join("\n\n"));

const deliveredType = (ir, declaration) => {
	const type = pythonType(ir, declaration.result.type);
	if(declaration.resultMode === "promise") return type;
	if(declaration.resultMode === "iterator") return `Iterator[${type}]`;
	if(declaration.resultMode === "async-iterator") return `AsyncIterator[${type}]`;
	return type;
};

const callbackDeliveredType = (ir, callable) => callable.resultMode === "promise"
	? `Awaitable[${pythonType(ir, callable.result.type)}]`
	: pythonType(ir, callable.result.type);

const emitRecord = (ir, type) => {
	const frozen = type.mutability === "immutable" ? "True" : "False";
	const lines = [
		`@dataclass(frozen=${frozen}, slots=True)`
		, `class ${type.name}:`
		, `    ${docstring(type.documentation)}`
	];
	for(const field of type.fields) lines.push(`    ${snake(field.name)}: ${pythonType(ir, field.type)}`);
	lines.push("", "    def __post_init__(self) -> None:");
	for(const field of type.fields)
	{
		const ref = resolveAlias(ir, field.type);
		const name = snake(field.name);
		if(ref.kind === "primitive" && ref.name === "bytes") lines.push(`        object.__setattr__(self, ${JSON.stringify(name)}, bytes(self.${name}))`);
		if(ref.kind === "apply" && ref.constructor === "array") lines.push(`        object.__setattr__(self, ${JSON.stringify(name)}, tuple(self.${name}))`);
		lines.push(`        ${validatorName(ref)}(self.${name}, ${JSON.stringify(`${type.name}.${name}`)})`);
	}
	if(type.fields.length === 0) lines.push("        pass");
	lines.push("");
	return lines;
};

const variantClassName = (type, variantCase) => `${type.name}${variantCase.name}`;

const emitVariant = (ir, type) => {
	const lines = [];
	for(const variantCase of type.cases)
	{
		lines.push(
			"@dataclass(frozen=True, slots=True)",
			`class ${variantClassName(type, variantCase)}:`,
			`    ${docstring(variantCase.documentation)}`,
			`    kind: ClassVar[Literal[${JSON.stringify(variantCase.name)}]] = ${JSON.stringify(variantCase.name)}`,
		);
		for(const field of variantCase.fields)
		{
			lines.push(`    ${snake(field.name)}: ${pythonType(ir, field.type)}`);
		}
		if(variantCase.fields.length === 0) lines.push("    pass");
		lines.push("", "    def __post_init__(self) -> None:");
		for(const field of variantCase.fields)
		{
			const ref = resolveAlias(ir, field.type);
			const name = snake(field.name);
			if(ref.kind === "primitive" && ref.name === "bytes")
			{
				lines.push(`        object.__setattr__(self, ${JSON.stringify(name)}, bytes(self.${name}))`);
			}
			if(ref.kind === "apply" && ref.constructor === "array")
			{
				lines.push(`        object.__setattr__(self, ${JSON.stringify(name)}, tuple(self.${name}))`);
			}
			lines.push(`        ${validatorName(ref)}(self.${name}, ${JSON.stringify(`${type.name}.${variantCase.name}.${name}`)})`);
		}
		if(variantCase.fields.length === 0) lines.push("        pass");
		lines.push("");
	}
	lines.push(
		`${type.name} = ${type.cases.map(variantCase => variantClassName(type, variantCase)).join(" | ")}`,
		"",
	);
	return lines;
};

const callResultLines = (ir, declaration, expression, indent = "        ") => {
	const resultRef = resolveAlias(ir, declaration.result.type);
	const resultNamed = resultRef.kind === "named" ? namedType(ir, resultRef.id) : null;
	if(resultNamed?.kind === "resource" && declaration.result.ownership === "borrow")
	{
		return [
			`${indent}identity = ${expression}`
			, `${indent}if identity != self._identity:`
			, `${indent}    raise UnexpectedError(\"the runtime broke receiver identity\")`
			, `${indent}return self`
		];
	}
	if(resultNamed?.kind === "callback")
	{
		return [`${indent}identity = ${expression}`, `${indent}return ${resultNamed.name}(_runtime=runtime, _identity=identity)`];
	}
	if(declaration.resultMode === "promise")
	{
		return [`${indent}result = await ${expression}`, `${indent}${validatorName(resultRef)}(result, \"${declaration.name}.result\")`, `${indent}return result`];
	}
	if(declaration.resultMode === "iterator") return [`${indent}return iter(${expression})`];
	if(declaration.resultMode === "async-iterator") return [`${indent}return ${expression}`];
	return [`${indent}result = ${expression}`, `${indent}${validatorName(resultRef)}(result, \"${declaration.name}.result\")`, `${indent}return result`];
};

const emitResource = (ir, type) => {
	const declarations = ir.declarations.filter(item => resourceFor(ir, item)?.id === type.id);
	const lines = [
		`class ${type.name}:`
		, `    ${docstring(type.documentation)}`
		, "    __slots__ = (\"_runtime\", \"_identity\", \"_closed\")"
		, ""
	];
	for(const declaration of declarations)
	{
		if(declaration.kind !== "constructor") continue;
		const params = declaration.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`);
		lines.push(`    def __init__(self, ${params.join(", ")}) -> None:`);
		declaration.parameters.forEach(site => lines.push(`        ${validatorName(resolveAlias(ir, site.type))}(${snake(site.name)}, ${JSON.stringify(`${declaration.name}.${site.name}`)})`));
		lines.push(
			"        runtime = _runtime.get_runtime()",
			`        identity = runtime.${runtimeName(ir, declaration)}(${declaration.parameters.map(site => snake(site.name)).join(", ")})`,
			"        self._runtime = runtime",
			"        self._identity = identity",
			"        self._closed = False",
			"",
		);
	}
	lines.push(
		"    @property",
		"    def closed(self) -> bool:",
		"        return self._closed",
		"",
		"    def _require_open(self) -> None:",
		"        if self._closed:",
		`            raise DisposedResourceError(${JSON.stringify(`${type.name} is closed`)})`,
		"",
	);
	const properties = new Map();
	for(const declaration of declarations.filter(item => item.kind === "property"))
	{
		const group = properties.get(declaration.name) ?? {};
		group[declaration.parameters.length === 0 ? "getter" : "setter"] = declaration;
		properties.set(declaration.name, group);
	}
	for(const declaration of declarations.filter(item => item.kind === "method"))
	{
		const params = declaration.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`);
		const asyncPrefix = declaration.resultMode === "promise" ? "async " : "";
		lines.push(`    ${asyncPrefix}def ${snake(declaration.name)}(self${params.length ? ", " : ""}${params.join(", ")}) -> ${deliveredType(ir, declaration)}:`);
		lines.push("        self._require_open()");
		declaration.parameters.forEach(site => lines.push(`        ${validatorName(resolveAlias(ir, site.type))}(${snake(site.name)}, ${JSON.stringify(`${declaration.name}.${site.name}`)})`));
		const args = ["self._identity", ...declaration.parameters.map(site => snake(site.name))];
		lines.push(...callResultLines(ir, declaration, `self._runtime.${runtimeName(ir, declaration)}(${args.join(", ")})`));
		lines.push("");
	}
	for(const declaration of declarations.filter(item => item.kind === "static-method"))
	{
		const params = declaration.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`);
		const asyncPrefix = declaration.resultMode === "promise" ? "async " : "";
		lines.push(
			"    @staticmethod",
			`    ${asyncPrefix}def ${snake(declaration.name)}(${params.join(", ")}) -> ${deliveredType(ir, declaration)}:`,
			"        runtime = _runtime.get_runtime()",
		);
		declaration.parameters.forEach(site => lines.push(`        ${validatorName(resolveAlias(ir, site.type))}(${snake(site.name)}, ${JSON.stringify(`${declaration.name}.${site.name}`)})`));
		lines.push(...callResultLines(ir, declaration, `runtime.${runtimeName(ir, declaration)}(${declaration.parameters.map(site => snake(site.name)).join(", ")})`));
		lines.push("");
	}
	for(const [name, group] of properties)
	{
		if(group.getter)
		{
			const declaration = group.getter;
			lines.push(
				"    @property",
				`    def ${snake(name)}(self) -> ${pythonType(ir, declaration.result.type)}:`,
				"        self._require_open()",
				`        result = self._runtime.${runtimeName(ir, declaration)}(self._identity)`,
				`        ${validatorName(resolveAlias(ir, declaration.result.type))}(result, ${JSON.stringify(`${name}.result`)})`,
				"        return result",
				"",
			);
		}
		if(group.setter)
		{
			const declaration = group.setter;
			const parameter = declaration.parameters[0];
			lines.push(
				`    @${snake(name)}.setter`,
				`    def ${snake(name)}(self, value: ${pythonType(ir, parameter.type)}) -> None:`,
				"        self._require_open()",
				`        ${validatorName(resolveAlias(ir, parameter.type))}(value, ${JSON.stringify(`${name}.value`)})`,
				`        self._runtime.${runtimeName(ir, declaration)}(self._identity, value)`,
				"",
			);
		}
	}
	lines.push(
		"    def close(self) -> None:",
		"        if self._closed:",
		"            return",
		"        self._closed = True",
		`        self._runtime.dispose_${snake(type.name)}(self._identity)`,
		"",
		`    def __enter__(self) -> "${type.name}":`,
		"        self._require_open()",
		"        return self",
		"",
		"    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:",
		"        self.close()",
		"",
		"    def __del__(self) -> None:",
		"        try:",
		"            self.close()",
		"        except Exception:",
		"            pass",
		"",
	);
	return lines;
};

const emitCallback = (ir, type) => {
	const callable = type.callable;
	const params = callable.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`);
	const args = callable.parameters.map(site => snake(site.name));
	const asyncPrefix = callable.resultMode === "promise" ? "async " : "";
	const resultExpression = `${callable.resultMode === "promise" ? "await " : ""}self._runtime.call_${snake(type.name)}(self._identity${args.length ? ", " : ""}${args.join(", ")})`;
	return [
		`class ${type.name}:`
		, `    ${docstring(type.documentation)}`
		, "    __slots__ = (\"_runtime\", \"_identity\", \"_closed\")"
		, ""
		, "    def __init__(self, *, _runtime: _runtime.Runtime, _identity: int) -> None:"
		, "        self._runtime = _runtime"
		, "        self._identity = _identity"
		, "        self._closed = False"
		, ""
		, `    ${asyncPrefix}def __call__(self, ${params.join(", ")}) -> ${pythonType(ir, callable.result.type)}:`
		, `        if self._closed: raise DisposedResourceError(${JSON.stringify(`${type.name} is closed`)})`
		, ...callable.parameters.map(site => `        ${validatorName(resolveAlias(ir, site.type))}(${snake(site.name)}, ${JSON.stringify(`${type.name}.${site.name}`)})`)
		, `        result = ${resultExpression}`
		, `        ${validatorName(resolveAlias(ir, callable.result.type))}(result, ${JSON.stringify(`${type.name}.result`)})`
		, "        return result"
		, ""
		, "    def close(self) -> None:"
		, "        if self._closed: return"
		, "        self._closed = True"
		, `        self._runtime.dispose_${snake(type.name)}(self._identity)`
		, ""
		, `    def __enter__(self) -> "${type.name}":`
		, `        if self._closed: raise DisposedResourceError(${JSON.stringify(`${type.name} is closed`)})`
		, "        return self"
		, "    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None: self.close()"
		, "    def __del__(self) -> None:"
		, "        try: self.close()"
		, "        except Exception: pass"
		, ""
	];
};

const genericGuard = type => {
	const name = type.name;
	if(name === "bool") return "type(value) is bool";
	if(name === "string") return "isinstance(value, str)";
	if(name === "bytes") return "isinstance(value, bytes)";
	if(new Set(["float32", "float64"]).has(name)) return "isinstance(value, float)";
	return "type(value) is int";
};

const emitFunction = (ir, declaration) => {
	const branches = specializations(declaration);
	if(branches)
	{
		const parameter = snake(declaration.parameters[0].name);
		const lines = [`def ${snake(declaration.name)}(${parameter}: object) -> object:`, `    ${docstring(declaration.documentation)}`, "    runtime = _runtime.get_runtime()"];
		branches.forEach((branch, index) => {
      lines.push(
        `    ${index === 0 ? "if" : "elif"} ${genericGuard(branch.type)}:`,
        `        ${validatorName(branch.type)}(${parameter}, ${JSON.stringify(`${declaration.name}.${parameter}`)})`,
        `        result = runtime.${runtimeName(ir, declaration, `_${snake(branch.id)}`)}(${parameter})`,
        `        ${validatorName(branch.type)}(result, ${JSON.stringify(`${declaration.name}.result`)})`,
        "        return result",
      );
		});
		lines.push(`    raise TypeError(${JSON.stringify(`${declaration.name} does not support this value type`)})`, "");
		return lines;
	}
	const params = declaration.parameters.map(site => {
    const ref = resolveAlias(ir, site.type);
    const type = ref.kind === "named" ? namedType(ir, ref.id) : null;
    if(type?.kind === "callback")
{
      const callable = type.callable;
      return `${snake(site.name)}: Callable[[${callable.parameters.map(item => pythonType(ir, item.type)).join(", ")}], ${callbackDeliveredType(ir, callable)}]`;
}
    return `${snake(site.name)}: ${pythonType(ir, site.type)}`;
	});
	const asyncPrefix = declaration.resultMode === "promise" ? "async " : "";
	const lines = [
		`${asyncPrefix}def ${snake(declaration.name)}(${params.join(", ")}) -> ${deliveredType(ir, declaration)}:`
		, `    ${docstring(declaration.documentation)}`
	];
	declaration.parameters.forEach(site => lines.push(`    ${validatorName(resolveAlias(ir, site.type))}(${snake(site.name)}, ${JSON.stringify(`${declaration.name}.${site.name}`)})`));
	lines.push("    runtime = _runtime.get_runtime()");
	const args = declaration.parameters.map(site => snake(site.name));
	lines.push(...callResultLines(ir, declaration, `runtime.${runtimeName(ir, declaration)}(${args.join(", ")})`, "    "));
	lines.push("");
	return lines;
};

const emitPublic = ir => {
	const errorBase = `${namedTypeBase(ir)}Error`;
	const variantClasses = ir.types
    .filter(type => type.kind === "variant")
    .flatMap(type => type.cases.map(variantCase => variantClassName(type, variantCase)));
	const exports = [errorBase, "RuntimeUnavailableError", "UnexpectedError", ...ir.errors.map(error => `${error.name}Error`), "Ok", "Err", ...ir.types.map(type => type.name), ...variantClasses, ...ir.declarations.filter(item => item.kind === "function").map(item => snake(item.name))];
	const lines = [
		"from __future__ import annotations"
		, ""
		, "from dataclasses import dataclass"
		, "from typing import AsyncIterator, Awaitable, Callable, ClassVar, Generic, Iterator, Literal, TypeVar"
		, ""
		, `__all__ = (`
		, ...exports.map(name => `    ${JSON.stringify(name)},`)
		, ")"
		, ""
		, `BINDING_IR_SHA256 = ${JSON.stringify(hashBindingIr(ir))}`
		, ""
		, `class ${errorBase}(Exception):`
		, "    code = \"bridge-error\""
		, ""
		, `class RuntimeUnavailableError(${errorBase}):`
		, "    code = \"runtime-unavailable\""
		, ""
		, `class UnexpectedError(${errorBase}):`
		, "    code = \"unexpected\""
		, ""
	];
	for(const error of ir.errors)
	{
		lines.push(
			`class ${error.name}Error(${errorBase}):`,
			`    ${docstring(error.documentation)}`,
			`    code = ${JSON.stringify(error.id)}`,
			"",
		);
	}
	lines.push(
		"T = TypeVar(\"T\")",
		"E = TypeVar(\"E\")",
		"",
		"@dataclass(frozen=True, slots=True)",
		"class Ok(Generic[T]):",
		"    value: T",
		"",
		"@dataclass(frozen=True, slots=True)",
		"class Err(Generic[E]):",
		"    error: E",
		"",
	);
	lines.push(...emitValidators(ir));
	for(const type of ir.types.filter(item => item.kind === "record")) lines.push(...emitRecord(ir, type));
	for(const type of ir.types.filter(item => item.kind === "variant")) lines.push(...emitVariant(ir, type));
	for(const type of ir.types.filter(item => item.kind === "alias"))
	{
		lines.push(`${type.name} = ${pythonType(ir, type.target)}`, "");
	}
	lines.push("from . import _runtime", "");
	for(const type of ir.types.filter(item => item.kind === "resource")) lines.push(...emitResource(ir, type));
	for(const type of ir.types.filter(item => item.kind === "callback")) lines.push(...emitCallback(ir, type));
	for(const declaration of ir.declarations.filter(item => item.kind === "function")) lines.push(...emitFunction(ir, declaration));
	return { source: lines.join("\n"), exports };
};

const namedTypeBase = ir => ir.component.name.replace(/[^A-Za-z0-9]+/g, "") || "LeanBridge";

const runtimeResultType = (ir, declaration) => {
	const ref = resolveAlias(ir, declaration.result.type);
	if(ref.kind === "named" && new Set(["resource", "callback"]).has(namedType(ir, ref.id).kind)) return "int";
	if(declaration.resultMode === "promise") return `Awaitable[${pythonType(ir, ref)}]`;
	if(declaration.resultMode === "iterator") return `Iterator[${pythonType(ir, ref)}]`;
	if(declaration.resultMode === "async-iterator") return `AsyncIterator[${pythonType(ir, ref)}]`;
	return pythonType(ir, ref);
};

const runtimeParameters = (ir, declaration) => declaration.parameters.map(site => {
  const ref = resolveAlias(ir, site.type);
  const type = ref.kind === "named" ? namedType(ir, ref.id) : null;
  if(type?.kind === "resource") return `${snake(site.name)}: int`;
  if(type?.kind === "callback")
{
    const args = type.callable.parameters.map(parameter => pythonType(ir, parameter.type)).join(", ");
    return `${snake(site.name)}: Callable[[${args}], ${callbackDeliveredType(ir, type.callable)}]`;
}
  return `${snake(site.name)}: ${pythonType(ir, site.type)}`;
});

const emitRuntime = ir => {
	const typeNames = ir.types.filter(type => new Set(["record", "alias", "variant"]).has(type.kind)).map(type => type.name);
	const lines = [
		"from __future__ import annotations"
		, ""
		, "from threading import RLock"
		, "from typing import AsyncIterator, Awaitable, Callable, Iterator, Protocol, TYPE_CHECKING"
		, ""
		, "if TYPE_CHECKING:"
		, `    from . import ${typeNames.length ? typeNames.join(", ") : "Error"}`
		, ""
		, "class Runtime(Protocol):"
		, "    def initialize(self) -> None: ..."
	];
	for(const declaration of ir.declarations)
	{
		for(const variant of variants(declaration))
		{
			const current = variant.declaration;
			const params = runtimeParameters(ir, current);
			if(current.receiver) params.unshift("identity: int");
			lines.push(`    def ${runtimeName(ir, current, variant.suffix)}(self${params.length ? ", " : ""}${params.join(", ")}) -> ${runtimeResultType(ir, current)}: ...`);
		}
	}
	for(const type of ir.types.filter(type => type.kind === "resource")) lines.push(`    def dispose_${snake(type.name)}(self, identity: int) -> None: ...`);
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		const callable = type.callable;
		const params = callable.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`);
		lines.push(
			`    def call_${snake(type.name)}(self, identity: int${params.length ? ", " : ""}${params.join(", ")}) -> ${callbackDeliveredType(ir, callable)}: ...`,
			`    def dispose_${snake(type.name)}(self, identity: int) -> None: ...`,
		);
	}
	lines.push(
		"",
		"_lock = RLock()",
		"_state = \"empty\"",
		"_runtime: Runtime | None = None",
		"_failure: BaseException | None = None",
		"",
		"def install_runtime(runtime: Runtime) -> None:",
		"    global _state, _runtime, _failure",
		"    with _lock:",
		"        if _state == \"ready\":",
		"            if _runtime is runtime: return",
		"            raise RuntimeError(\"a different shared runtime is already installed\")",
		"        if _state == \"failed\":",
		"            raise RuntimeError(\"shared runtime initialization failed and will not be retried\") from _failure",
		"        try:",
		"            runtime.initialize()",
		"        except BaseException as error:",
		"            _state = \"failed\"",
		"            _failure = error",
		"            raise",
		"        _runtime = runtime",
		"        _state = \"ready\"",
		"",
		"def get_runtime() -> Runtime:",
		"    with _lock:",
		"        if _state == \"ready\" and _runtime is not None: return _runtime",
		"        if _state == \"failed\":",
		"            raise RuntimeError(\"shared runtime initialization failed and will not be retried\") from _failure",
		"        from ._native import NativeRuntime",
		"        install_runtime(NativeRuntime())",
		"        assert _runtime is not None",
		"        return _runtime",
		"",
	);
	return lines.join("\n");
};

const emitNativeRuntime = () => `from __future__ import annotations

import ctypes
from pathlib import Path
from typing import Callable


class _Error(ctypes.Structure):
    _fields_ = [("code", ctypes.c_int), ("message", ctypes.c_void_p), ("message_length", ctypes.c_size_t)]


class _String(ctypes.Structure):
    _fields_ = [("data", ctypes.c_void_p), ("length", ctypes.c_size_t), ("owner", ctypes.c_void_p), ("release", ctypes.c_void_p)]


class _Bytes(ctypes.Structure):
    _fields_ = _String._fields_


class _Values(ctypes.Structure):
    _fields_ = _String._fields_


class _Payload(ctypes.Structure):
    _fields_ = [("enabled", ctypes.c_bool), ("count", ctypes.c_uint32), ("label", _String), ("bytes", _Bytes), ("values", _Values)]


_Callback = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint32), ctypes.POINTER(_Error))


class _Transform(ctypes.Structure):
    _fields_ = [("call", _Callback), ("context", ctypes.c_void_p)]


def _library_path() -> Path:
    return Path(__file__).parent / "lean_bridge" / "artifacts" / "artifacts" / "native" / "lib" / "liblean_alpha_component.so"


class NativeRuntime:
    def __init__(self) -> None:
        self._library = ctypes.CDLL(str(_library_path()))
        pointer = ctypes.c_void_p
        error = ctypes.POINTER(_Error)
        self._library.lean_alpha_box_create.argtypes = [ctypes.c_uint32, ctypes.POINTER(pointer), error]
        self._library.lean_alpha_box_create.restype = ctypes.c_int
        self._library.lean_alpha_box_read.argtypes = [pointer, ctypes.POINTER(ctypes.c_uint32), error]
        self._library.lean_alpha_box_read.restype = ctypes.c_int
        self._library.lean_alpha_box_identity.argtypes = [pointer, ctypes.POINTER(pointer), error]
        self._library.lean_alpha_box_identity.restype = ctypes.c_int
        self._library.lean_alpha_box_dispose.argtypes = [ctypes.POINTER(pointer)]
        self._library.lean_alpha_round_trip.argtypes = [ctypes.POINTER(_Payload), ctypes.POINTER(_Payload), error]
        self._library.lean_alpha_round_trip.restype = ctypes.c_int
        self._library.lean_alpha_payload_clear.argtypes = [ctypes.POINTER(_Payload)]
        self._library.lean_alpha_with_callback.argtypes = [ctypes.c_uint32, ctypes.POINTER(_Transform), ctypes.POINTER(ctypes.c_uint32), error]
        self._library.lean_alpha_with_callback.restype = ctypes.c_int
        self._library.lean_alpha_make_adder.argtypes = [ctypes.c_uint32, ctypes.POINTER(pointer), error]
        self._library.lean_alpha_make_adder.restype = ctypes.c_int
        self._library.lean_alpha_owned_transform_call.argtypes = [pointer, ctypes.c_uint32, ctypes.POINTER(ctypes.c_uint32), error]
        self._library.lean_alpha_owned_transform_call.restype = ctypes.c_int
        self._library.lean_alpha_owned_transform_dispose.argtypes = [ctypes.POINTER(pointer)]

    def initialize(self) -> None:
        pass

    @staticmethod
    def _check(status: int, error: _Error) -> None:
        if status == 0:
            return
        from . import CallbackThrewError, DisposedResourceError, UnexpectedError
        message = ctypes.string_at(error.message, error.message_length).decode("utf-8") if error.message else "Lean call failed"
        if error.code == 100:
            raise DisposedResourceError(message)
        if error.code == 101:
            raise CallbackThrewError(message)
        raise UnexpectedError(message)

    def box_new(self, value: int) -> int:
        result = ctypes.c_void_p()
        error = _Error()
        self._check(self._library.lean_alpha_box_create(value, ctypes.byref(result), ctypes.byref(error)), error)
        return int(result.value or 0)

    def box_read(self, identity: int) -> int:
        result = ctypes.c_uint32()
        error = _Error()
        self._check(self._library.lean_alpha_box_read(identity, ctypes.byref(result), ctypes.byref(error)), error)
        return result.value

    def box_identity(self, identity: int) -> int:
        result = ctypes.c_void_p()
        error = _Error()
        self._check(self._library.lean_alpha_box_identity(identity, ctypes.byref(result), ctypes.byref(error)), error)
        return int(result.value or 0)

    def dispose_box(self, identity: int) -> None:
        value = ctypes.c_void_p(identity)
        self._library.lean_alpha_box_dispose(ctypes.byref(value))

    def round_trip(self, payload: object) -> object:
        from . import Payload
        label_bytes = payload.label.encode("utf-8")
        label = ctypes.create_string_buffer(label_bytes)
        byte_values = (ctypes.c_uint8 * len(payload.bytes))(*payload.bytes)
        values = (ctypes.c_uint32 * len(payload.values))(*payload.values)
        input_value = _Payload(
            payload.enabled,
            payload.count,
            _String(ctypes.cast(label, ctypes.c_void_p), len(label_bytes), None, None),
            _Bytes(ctypes.cast(byte_values, ctypes.c_void_p), len(payload.bytes), None, None),
            _Values(ctypes.cast(values, ctypes.c_void_p), len(payload.values), None, None),
        )
        output = _Payload()
        error = _Error()
        self._check(self._library.lean_alpha_round_trip(ctypes.byref(input_value), ctypes.byref(output), ctypes.byref(error)), error)
        try:
            return Payload(
                bool(output.enabled),
                int(output.count),
                ctypes.string_at(output.label.data, output.label.length).decode("utf-8"),
                ctypes.string_at(output.bytes.data, output.bytes.length),
                tuple(ctypes.cast(output.values.data, ctypes.POINTER(ctypes.c_uint32))[index] for index in range(output.values.length)),
            )
        finally:
            self._library.lean_alpha_payload_clear(ctypes.byref(output))

    def with_callback(self, value: int, transform: Callable[[int], int]) -> int:
        callback_error: list[BaseException] = []
        @_Callback
        def invoke(_context: int, current: int, output: object, _error: object) -> int:
            try:
                output[0] = transform(current)
                return 0
            except BaseException as exception:
                callback_error.append(exception)
                return 4
        native = _Transform(invoke, None)
        result = ctypes.c_uint32()
        error = _Error()
        status = self._library.lean_alpha_with_callback(value, ctypes.byref(native), ctypes.byref(result), ctypes.byref(error))
        if callback_error:
            raise callback_error[0]
        self._check(status, error)
        return result.value

    def make_adder(self, base: int) -> int:
        result = ctypes.c_void_p()
        error = _Error()
        self._check(self._library.lean_alpha_make_adder(base, ctypes.byref(result), ctypes.byref(error)), error)
        return int(result.value or 0)

    def call_transform(self, identity: int, value: int) -> int:
        result = ctypes.c_uint32()
        error = _Error()
        self._check(self._library.lean_alpha_owned_transform_call(identity, value, ctypes.byref(result), ctypes.byref(error)), error)
        return result.value

    def dispose_transform(self, identity: int) -> None:
        value = ctypes.c_void_p(identity)
        self._library.lean_alpha_owned_transform_dispose(ctypes.byref(value))
`;

const emitStub = ir => {
	const errorBase = `${namedTypeBase(ir)}Error`;
	const lines = [
		"from collections.abc import AsyncIterator, Awaitable, Callable, Iterator"
		, "from dataclasses import dataclass"
		, "from typing import ClassVar, Generic, Literal, TypeVar, overload"
		, ""
		, `class ${errorBase}(Exception): code: str`
		, `class RuntimeUnavailableError(${errorBase}): ...`
		, `class UnexpectedError(${errorBase}): ...`
		, ...ir.errors.map(error => `class ${error.name}Error(${errorBase}): ...`)
		, ""
		, "T = TypeVar(\"T\")"
		, "E = TypeVar(\"E\")"
		, "@dataclass(frozen=True)"
		, "class Ok(Generic[T]): value: T"
		, "@dataclass(frozen=True)"
		, "class Err(Generic[E]): error: E"
		, ""
	];
	for(const type of ir.types.filter(type => type.kind === "record"))
	{
		lines.push("@dataclass(frozen=True)", `class ${type.name}:`);
		type.fields.forEach(field => lines.push(`    ${snake(field.name)}: ${pythonType(ir, field.type)}`));
		lines.push("");
	}
	for(const type of ir.types.filter(type => type.kind === "variant"))
	{
		for(const variantCase of type.cases)
		{
			lines.push("@dataclass(frozen=True)", `class ${variantClassName(type, variantCase)}:`);
			lines.push(`    kind: ClassVar[Literal[${JSON.stringify(variantCase.name)}]]`);
			variantCase.fields.forEach(field => lines.push(`    ${snake(field.name)}: ${pythonType(ir, field.type)}`));
			if(variantCase.fields.length === 0) lines.push("    ...");
			lines.push("");
		}
		lines.push(`${type.name} = ${type.cases.map(variantCase => variantClassName(type, variantCase)).join(" | ")}`, "");
	}
	for(const type of ir.types.filter(type => type.kind === "resource"))
	{
		const declarations = ir.declarations.filter(item => resourceFor(ir, item)?.id === type.id);
		lines.push(`class ${type.name}:`);
		const constructor = declarations.find(item => item.kind === "constructor");
		lines.push(`    def __init__(self${constructor.parameters.length ? ", " : ""}${constructor.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`).join(", ")}) -> None: ...`);
		lines.push("    @property", "    def closed(self) -> bool: ...");
		for(const method of declarations.filter(item => item.kind === "method"))
		{
			const asyncPrefix = method.resultMode === "promise" ? "async " : "";
			lines.push(`    ${asyncPrefix}def ${snake(method.name)}(self${method.parameters.length ? ", " : ""}${method.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`).join(", ")}) -> ${deliveredType(ir, method)}: ...`);
		}
		for(const method of declarations.filter(item => item.kind === "static-method"))
		{
			const asyncPrefix = method.resultMode === "promise" ? "async " : "";
			lines.push("    @staticmethod", `    ${asyncPrefix}def ${snake(method.name)}(${method.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`).join(", ")}) -> ${deliveredType(ir, method)}: ...`);
		}
		const properties = new Map();
		for(const property of declarations.filter(item => item.kind === "property"))
		{
			const group = properties.get(property.name) ?? {};
			group[property.parameters.length === 0 ? "getter" : "setter"] = property;
			properties.set(property.name, group);
		}
		for(const [name, group] of properties)
		{
			if(group.getter) lines.push("    @property", `    def ${snake(name)}(self) -> ${pythonType(ir, group.getter.result.type)}: ...`);
			if(group.setter) lines.push(`    @${snake(name)}.setter`, `    def ${snake(name)}(self, value: ${pythonType(ir, group.setter.parameters[0].type)}) -> None: ...`);
		}
		lines.push("    def close(self) -> None: ...", `    def __enter__(self) -> ${type.name}: ...`, "    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None: ...", "");
	}
	for(const type of ir.types.filter(type => type.kind === "callback"))
	{
		lines.push(`class ${type.name}:`, `    ${type.callable.resultMode === "promise" ? "async " : ""}def __call__(self${type.callable.parameters.length ? ", " : ""}${type.callable.parameters.map(site => `${snake(site.name)}: ${pythonType(ir, site.type)}`).join(", ")}) -> ${pythonType(ir, type.callable.result.type)}: ...`, "    def close(self) -> None: ...", `    def __enter__(self) -> ${type.name}: ...`, "    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None: ...", "");
	}
	for(const declaration of ir.declarations.filter(item => item.kind === "function"))
	{
		const branches = specializations(declaration);
		if(branches)
		{
			for(const branch of branches)
			{
				lines.push("@overload", `def ${snake(declaration.name)}(${snake(declaration.parameters[0].name)}: ${pythonType(ir, branch.type)}) -> ${pythonType(ir, branch.type)}: ...`);
			}
			lines.push("");
			continue;
		}
		const callback = declaration.parameters.find(site => {
      const ref = resolveAlias(ir, site.type);
      return ref.kind === "named" && namedType(ir, ref.id).kind === "callback";
		});
		const params = declaration.parameters.map(site => {
      if(site === callback)
{
        const type = namedType(ir, site.type.id).callable;
        return `${snake(site.name)}: Callable[[${type.parameters.map(item => pythonType(ir, item.type)).join(", ")}], ${callbackDeliveredType(ir, type)}]`;
}
      return `${snake(site.name)}: ${pythonType(ir, site.type)}`;
		});
		lines.push(`${declaration.resultMode === "promise" ? "async " : ""}def ${snake(declaration.name)}(${params.join(", ")}) -> ${deliveredType(ir, declaration)}: ...`);
	}
	lines.push("");
	return lines.join("\n");
};

const emitReadme = ir => `# ${ir.component.name} Python binding

${ir.documentation.summary}

The generated package exposes normal Python functions, frozen dataclasses, exceptions, context-managed resources, callables, iterators, async iterators, and awaitables for the supported Binding IR slice.

Binding IR SHA-256: \`${hashBindingIr(ir)}\`
`;

/**
 * Compiles Binding IR into the validated Python package projection model.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const compilePythonPackageModel = ir => {
	validateBindingIr(ir);
	validateCoverage(ir);
	const packageDir = packageName(ir);
	return Object.freeze({ ir, packageDir });
};

/**
 * Renders and lays out deterministic Python package files from one model.
 *
 * @param model - Validated Python package projection model.
 */
export const renderPythonPackageLayout = model => {
	const { ir, packageDir } = model;
	const publicModule = `${packageDir}/__init__.py`;
	const typeStub = `${packageDir}/__init__.pyi`;
	const publicOutput = emitPublic(ir);
	const files = {
		"pyproject.toml": `[build-system]\nrequires = [\"setuptools>=65\"]\nbuild-backend = \"setuptools.build_meta\"\n\n[project]\nname = \"${packageDir.replaceAll("_", "-")}\"\nversion = \"${ir.component.version}\"\nrequires-python = \">=3.11\"\n\n[tool.setuptools.package-data]\n\"${packageDir}\" = [\"py.typed\", \"*.pyi\"]\n`
		, [publicModule]: publicOutput.source
		, [`${packageDir}/_runtime.py`]: emitRuntime(ir)
		, [`${packageDir}/_native.py`]: emitNativeRuntime(ir)
		, [typeStub]: emitStub(ir)
		, [`${packageDir}/py.typed`]: ""
		, "README.md": emitReadme(ir)
	};
	const manifest = {
		schemaVersion: 1
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, generator: { id: "lean-wasm/python", version: 1 }
		, publicModule
		, internalModule: `${packageDir}/_runtime.py`
		, typeStub
		, exports: publicOutput.exports
		, capabilityGaps: []
		, files: ["pyproject.toml", publicModule, `${packageDir}/_runtime.py`, `${packageDir}/_native.py`, typeStub, `${packageDir}/py.typed`, "README.md", "binding-manifest.json"]
	};
	files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generates and audits a Python package through explicit model and rendering stages.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generatePythonBindingPackage = ir => {
	const model = compilePythonPackageModel(ir);
	const files = renderPythonPackageLayout(model);
	auditPythonPackage(ir, files);
	return files;
};
