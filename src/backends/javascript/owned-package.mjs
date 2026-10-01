/**
 * Named JavaScript functions and directional TypeScript values for owned APIs.
 * The private runtime validates and transports values in the shared Lean heap.
 *
 * @file
 */
import { compileOwnedJavaScriptWasmLayout } from "./owned-wasm-layout.mjs";
import { canonicalizeJsonValue } from "../../binding-ir/canonical.mjs";

const fail = message => { throw Object.assign(new TypeError(message), { code: "owned-javascript-projection" }); };
const reserved = new Set(("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval then runtime bindings close withRecovery LeanLease leanResource "
	+ "Array ReadonlyArray Readonly Uint8Array Symbol Promise Object Function Boolean Number String BigInt Map Set WeakMap WeakSet undefined never unknown any boolean number string bigint symbol object").split(" "));
const json = value => JSON.stringify(value, null, 2) + "\n";
const named = (type, direction) => type.name + (type.kind === "resource" ? "" : type.kind === "callback" ? direction === "output" ? "Lease" : "" : direction === "input" ? "Input" : "");
const description = value => `/** ${value.documentation.summary.replaceAll("*/", "* /").replaceAll(/\r?\n/gu, " ")} */`;
const inputs = declaration => [...declaration.receiver ? [{ ...declaration.receiver, name: "receiver" }] : [], ...declaration.parameters];
const memberReserved = new Set(["constructor", "prototype", "__proto__", "then", "get", "share", "retain", "dispose", "disposed", "equals", "apply", "bind", "call", "arguments", "caller", "length", "name"]);

/**
 * Admit only the signatures implemented by the checked wasm32 ownership ABI.
 *
 * @param document - Explicit compiler-derived or independently reviewed v4 IR.
 */
export const compileOwnedJavaScriptPackageModel = document => {
	const layout = compileOwnedJavaScriptWasmLayout(document, { transferredInputs: true, anchoredResults: true, receiverExports: true }), model = layout.native.model;
	const ir = model.bindingIr, names = new Set(reserved);
	const receivers = layout.native.functions.some(fn => fn.receiver === 0);
	const anchored = receivers || layout.native.functions.some(fn => fn.anchor !== undefined);
	const ownerTypes = receivers ? ir.types.filter(type => type.kind !== "alias" && layout.types.find(node => node.id === type.id)?.representation !== "copied").map(type => type.id) : [];
	if(anchored) for(const name of ["LeanValue", "leanValue", "copyValue"]) names.add(name);
	if(receivers) names.add("LeanOwner");
	const claim = name => {
		if(!/^[$\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*$/u.test(name) || name.startsWith("_") || names.has(name))
			fail(`JavaScript public name is invalid or conflicts with another declaration: ${name}`);
		names.add(name);
	};
	for(const type of ir.types)
	{
		claim(named(type, "output"));
		if(type.kind !== "resource") claim(named(type, "input"));
		if(ownerTypes.includes(type.id)) claim(type.name + "Value");
		if(type.kind === "callback" && (type.callable.resultMode !== "value"
			|| type.callable.invocation !== "many" || type.callable.reentry !== "same-agent"
			|| type.callable.selfDisposal !== "defer"))
			fail("Owned JavaScript callbacks require synchronous repeated calls, same-agent reentry and deferred self-disposal");
		if(type.kind === "variant" && type.cases.some(branch => branch.fields.some(field => field.name === "kind")))
			fail("Variant payload fields cannot shadow the kind discriminator");
	}
	for(const declaration of ir.declarations)
	{
		claim(declaration.name);
		if((declaration.owner && !declaration.receiver) || declaration.typeParameters.length || declaration.parameters.some(parameter => parameter.optional))
			fail("Owned JavaScript exports require concrete synchronous functions");
		if(declaration.receiver && (memberReserved.has(declaration.name) || (declaration.kind === "property" && declaration.parameters.length)))
			fail(`Reserved or invalid JavaScript receiver member: ${declaration.name}`);
	}
	if(ir.errors.some(error => error.category !== "boundary" || error.payload !== null))
		fail("Owned JavaScript declarations cannot omit domain error translation");
	return Object.freeze({ kind: "owned-javascript-package", ir
		, bindingIrSha256: model.bindingIrSha256
		, ...anchored ? { anchored: true } : {}
		, ...receivers ? { receivers: true, ownerTypes } : {} });
};

const typeText = (reference, direction, definitions) => {
	if(reference.kind === "primitive")
	{
		const name = reference.name;
		if(name === "unit") return "undefined";
		if(name === "bool") return "boolean";
		if(["nat", "int", "uint64", "int64"].includes(name)) return "bigint";
		if(["string", "char"].includes(name)) return "string";
		if(name === "bytes") return "Uint8Array";
		return "number";
	}
	if(reference.kind === "named") return named(definitions.get(reference.id), direction);
	const values = reference.arguments.map(child => typeText(child, direction, definitions));
	if(["array", "list"].includes(reference.constructor)) return `ReadonlyArray<${values[0]}>`;
	if(reference.constructor === "tuple") return `readonly [${values.join(", ")}]`;
	if(reference.constructor === "option") return `(Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: ${values[0]} }>)`;
	return `(Readonly<{ ok: ${values[0]} }> | Readonly<{ error: ${values[1]} }>)`;
};

const declarations = (ir, anchored = false, ownerTypes = []) => {
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const value = (reference, direction) => typeText(reference, direction, definitions);
	const owner = reference => {
		let resolved = reference;
		while(resolved.kind === "named" && definitions.get(resolved.id).kind === "alias") resolved = definitions.get(resolved.id).target;
		return resolved.kind === "named" && ownerTypes.includes(resolved.id)
			? definitions.get(resolved.id).name + "Value" : `LeanValue<${value(reference, "output")}>`;
	};
	const delivered = result => anchored && result.ownership !== "copy"
		? owner(result.type) : value(result.type, "output");
	const parameters = (items, direction, result = null) => items.map((item, index) => {
		let type = value(item.type, item.ownership === "transfer" ? "output" : direction);
		if(anchored && direction === "input" && item.ownership !== "copy")
		{
			const root = owner(item.type);
			type = item.ownership === "transfer" || result?.lifetime?.anchor === item.name ? root : `(${type} | ${root})`;
		}
		return `arg${index}: ${type}`;
	}).join(", ");
	const lines = ["declare const leanResource: unique symbol;", ""
		, "export interface LeanLease {", "  readonly disposed: boolean;"
		, "  dispose(): boolean;"
		, ownerTypes.length ? "  retain(): LeanOwner<this>;" : anchored ? "  retain(): LeanValue<this>;" : "  retain(): this;"
		, ...anchored ? ["  equals(other: unknown): boolean;"] : [], "}", ""];
	if(anchored) lines.push("declare const leanValue: unique symbol;", ""
		, "export interface LeanValue<T> {", "  readonly [leanValue]: T;"
		, "  readonly disposed: boolean;", "  get(): T;", "  dispose(): boolean;"
		, "  share(): LeanValue<T>;", "  retain(): LeanValue<T>;", "}", "");
	const members = (type, raw = false) => ir.declarations.filter(fn => fn.owner === type.id && (!raw || (fn.receiver.ownership !== "transfer" && fn.result.lifetime?.scope !== "receiver"))).map(fn => fn.kind === "property"
		? `  readonly ${JSON.stringify(fn.name)}: ${delivered(fn.result)};`
		: `  ${JSON.stringify(fn.name)}(${parameters(fn.parameters, "input", fn.result)}): ${delivered(fn.result)};`);
	if(ownerTypes.length) lines.push("export type LeanOwner<T> = " + ownerTypes.map(id => {
		const type = definitions.get(id); return `T extends ${named(type, "output")} ? ${type.name}Value : `;
	}).join("") + "LeanValue<T>;", "");
	for(const type of ir.types)
	{
		lines.push(description(type));
		if(ownerTypes.includes(type.id)) lines.push(`export interface ${type.name}Value extends LeanValue<${named(type, "output")}> {`
			, `  share(): ${type.name}Value;`, `  retain(): ${type.name}Value;`, ...members(type), "}", "");
		if(type.kind === "resource")
		{
			lines.push(`export interface ${type.name} extends LeanLease {`, `  readonly [leanResource]: ${JSON.stringify(type.id)};`, ...members(type, true), "}", "");
			continue;
		}
		for(const direction of ["input", "output"])
		{
			const name = named(type, direction);
			if(type.kind === "callback")
			{
				// Host callbacks receive borrowed native values. Native callbacks
				// accept host inputs and return explicitly disposable native values.
				const input = direction === "input" ? "output" : "input";
				const signature = `(${parameters(type.callable.parameters, input)}): ${anchored && direction === "output" ? delivered(type.callable.result) : value(type.callable.result.type, direction)};`;
				lines.push(`export interface ${name}${direction === "output" ? " extends LeanLease" : ""} {`, `  ${signature}`, ...direction === "output" ? members(type, true) : [], "}", "");
			}
			else if(type.kind === "alias") lines.push(`export type ${name} = ${value(type.target, direction)};`, "");
			else if(type.kind === "record") lines.push(`export interface ${name} {`
				, ...type.fields.map(field => `  readonly ${JSON.stringify(field.name)}: ${value(field.type, direction)};`), "}", "");
			else
			{
				const branches = type.cases.map(branch => `Readonly<{ kind: ${JSON.stringify(branch.name)}; ${branch.fields.map(field => `readonly ${JSON.stringify(field.name)}: ${value(field.type, direction)};`).join(" ")} }>`);
				lines.push(`export type ${name} = ${branches.join(" | ")};`, "");
			}
		}
	}
	for(const declaration of ir.declarations) lines.push(description(declaration)
		, `export function ${declaration.name}(${parameters(inputs(declaration), "input", declaration.result)}): ${delivered(declaration.result)};`, "");
	if(anchored) for(const declaration of ir.declarations)
	{
		if(declaration.result.ownership !== "copy") lines.push(
			`export function copyValue(value: ${value(declaration.result.type, "output")}, selector: Readonly<{ resultOf: ${JSON.stringify(declaration.name)} }>): ${delivered(declaration.result)};`);
		for(const [index, parameter] of declaration.parameters.entries()) if(parameter.ownership !== "copy")
			lines.push(`export function copyValue(value: ${value(parameter.type, "output")}, selector: Readonly<{ parameterOf: readonly [${JSON.stringify(declaration.name)}, ${index} | ${JSON.stringify(parameter.name)}] }>): ${owner(parameter.type)};`);
		if(declaration.receiver) lines.push(`export function copyValue(value: ${value(declaration.receiver.type, "output")}, selector: Readonly<{ receiverOf: ${JSON.stringify(declaration.name)} }>): ${owner(declaration.receiver.type)};`);
	}
	lines.push("/** Release this component and invalidate its outstanding leases. */", "export function close(): boolean;"
		, "/** Supply the typed fallback required by an uninhabited callback result. */"
		, "export function withRecovery<Args extends readonly unknown[], Result>(operation: (...args: Args) => Result, recovery: Result): (...args: Args) => Result;"
		, "", "declare const bindings: Readonly<{"
		, ...[...ir.declarations.map(item => item.name), "close", "withRecovery", ...anchored ? ["copyValue"] : []].map(name => `  ${name}: typeof ${name};`)
		, "}>;", "export default bindings;", "");
	return lines.join("\n");
};

const copyEntry = (ir, receiverExports = false) => {
	const layout = compileOwnedJavaScriptWasmLayout(ir, { transferredInputs: true, anchoredResults: true, receiverExports });
	const owned = new Set(layout.types.filter(type => type.representation !== "copied").map(type => type.id));
	const results = {}, parameters = {}, receivers = {};
	for(const fn of layout.native.functions)
	{
		const declaration = ir.declarations.find(item => item.id === fn.id);
		if(owned.has(fn.result)) results[fn.name] = fn.result;
		const names = {};
		for(const [index, id] of fn.parameters.entries()) if(owned.has(id))
		{
			if(fn.receiver === index)
			{ receivers[fn.name] = id; continue; }
			const parameter = index - Number(fn.receiver === 0);
			names[parameter] = id; names[declaration.parameters[parameter].name] = id;
		}
		parameters[fn.name] = names;
	}
	return `const _copyResults = Object.freeze(${JSON.stringify(results)});
const _copyParameters = Object.freeze(${JSON.stringify(parameters)});
${receiverExports ? `const _copyReceivers = Object.freeze(${JSON.stringify(receivers)});\n` : ""}\
export function copyValue(value, selector) {
  if (arguments.length !== 2 || !selector || typeof selector !== "object" || Array.isArray(selector))
    throw new TypeError("copyValue expects a payload and a resultOf or parameterOf selector");
  const fields = Object.getOwnPropertyDescriptors(selector), keys = Reflect.ownKeys(fields);
  if (keys.length !== 1 || !["resultOf", "parameterOf"${receiverExports ? ', "receiverOf"' : ""}].includes(keys[0]) || !Object.hasOwn(fields[keys[0]], "value"))
    throw new TypeError("copyValue requires exactly one data selector");
  const selected = fields[keys[0]].value;
  let type;
  if (keys[0] === "resultOf") {
    if (typeof selected === "string" && Object.hasOwn(_copyResults, selected)) type = _copyResults[selected];
  } ${receiverExports ? `else if (keys[0] === "receiverOf") {
    if (typeof selected === "string" && Object.hasOwn(_copyReceivers, selected)) type = _copyReceivers[selected];
  } ` : ""}else if (Array.isArray(selected) && selected.length === 2 && typeof selected[0] === "string") {
    const row = Object.hasOwn(_copyParameters, selected[0]) ? _copyParameters[selected[0]] : null;
    if (row && (typeof selected[1] === "string" || Number.isSafeInteger(selected[1])) && Object.hasOwn(row, selected[1])) type = row[selected[1]];
  }
  if (!type) throw new TypeError("copyValue selector must name an owned exported result or parameter");
  return runtime.copyValue(type, value);
}
`;
};

/**
 * Emit no resource constructors, public tokens, transport selectors or JSON calls.
 *
 * @param model - Validated public ownership projection model.
 */
export const renderOwnedJavaScriptPackageLayout = model => {
	const { ir, bindingIrSha256, anchored = false, receivers = false, ownerTypes = [] } = model;
	const transfers = ir.declarations.filter(item => inputs(item).some(parameter => parameter.ownership === "transfer"));
	const exports = [...ir.declarations.map(item => item.name), "close", "withRecovery", ...anchored ? ["copyValue"] : []];
	const entry = [`// Generated from Binding IR SHA-256 ${bindingIrSha256}.`
		, 'import { runtime } from "./internal/runtime.mjs";', ""];
	for(const declaration of ir.declarations)
	{
		const args = inputs(declaration).map((_, index) => `arg${index}`).join(", ");
		entry.push(description(declaration), `export function ${declaration.name}(${args}) {`
			, `  return runtime.call(${JSON.stringify(declaration.id)}, Array.from(arguments));`, "}", "");
	}
	if(anchored) entry.push(copyEntry(ir, receivers));
	entry.push("export function close() { return runtime.close(); }"
		, "export function withRecovery(operation, recovery) { return runtime.withRecovery(operation, recovery); }"
		, `export default Object.freeze({ ${exports.join(", ")} });`, "");
	const paths = ["index.mjs", "index.d.ts", "README.md", "binding-manifest.json", "package.json"];
	return Object.freeze({
		"index.mjs": entry.join("\n")
		, "index.d.ts": declarations(ir, anchored, ownerTypes)
		, "README.md": [`# ${ir.component.name}`, "", ir.documentation.summary, ""
			, "Call the named exports with JavaScript values. The package loads its shared runtime automatically."
			, "Records use source field names. Variants use kind and named payload fields. Arrays and lists use arrays."
			, 'Options use { tag: "none" } or { tag: "some", value }. Results use { ok } or { error }.'
			, "Nat, Int, UInt64 and Int64 use bigint. Unit uses undefined; bytes use Uint8Array."
			, "", "## Resource lifetime", ""
			, ...receivers ? [
				"Named whole-value owners expose the declared methods and read-only properties. share() and retain() preserve those members."
				, "Methods borrowing from the receiver use its original owner. Methods borrowing from another parameter follow that parameter's owner."
				, "A consuming method invalidates the receiver's shared roots and borrowed descendants at handoff."
				, "Resource views expose members that do not consume or borrow from their receiver. Use the whole owner for other members."
				, 'copyValue(payload, { receiverOf: "methodName" }) creates an independent receiver owner. parameterOf indexes only the remaining parameters.'
			] : []
			, ...anchored ? [
				"Owned results are LeanValue objects. get() reads the payload; dispose() closes that root."
				, "share() adds a root to the same owner. retain() copies the payload into an independent owner."
				, "Closing the last root or consuming an owner expires all borrowed descendants, including empty values."
				, "Pass whole owners to anchored and consuming parameters. Other inputs also accept their plain payloads."
				, 'Create a typed owner with copyValue(payload, { resultOf: "exportName" }) or copyValue(payload, { parameterOf: ["exportName", 0] }).'
				, "Nested resources and returned functions are non-owning views. Their retain() method creates an independent LeanValue."
				, "Resource views compare canonical identity with equals(other); independent owners can refer to the same resource."
			] : ["Resource values and returned functions expose dispose(), retain() and disposed. Dispose each distinct lease when finished."
				, "retain() creates an independent lease. Repeated references within a result share one wrapper."]
			, "Callback arguments expire when the callback returns. Retain a resource inside the callback to keep it."
			, "close() releases the component and invalidates its outstanding leases. It does not close other packages."
			, "A native trap retires the shared heap; all packages using that heap reject further calls."
			, ...transfers.length ? ["", "## Consuming arguments", ""
				, "Arguments declared transfer consume the whole shared result owner, including aliases and sibling handles."
				, "Validation failures leave inputs usable. Handoff invalidates inputs before Lean runs; they stay consumed if the call or a callback later fails."
				, "Call retain() first to keep an independent lease. Borrowed callback arguments must be retained before transfer."
				, "A result owner may appear repeatedly in one consuming argument, but cannot supply two consuming arguments or concurrent reentrant transfers."
				, "Consuming function arguments require returned Lean function leases, not ordinary JavaScript callbacks."
				, ...transfers.map(item => `- ${item.name}: consumes ${inputs(item).flatMap((parameter, index) => parameter.ownership === "transfer" ? [`arg${index}`] : []).join(", ")}.`)] : []
			, "", "## Callbacks and types", ""
			, transfers.length ? "Pass ordinary synchronous functions for borrowed callback arguments. Return a value of the declared result type." : "Pass ordinary synchronous functions as callbacks. Return a value of the declared result type."
			, "For a callback whose result has no default value, use withRecovery(callback, recoveryValue). The original thrown error reaches the caller."
			, "The TypeScript declarations distinguish host inputs from native results. Input types accept ordinary callbacks; returned functions include explicit lifetime methods."
			, "Conversions reject cycles, invalid fields, invalid tags and out-of-range values. Limits: 128 levels, 262144 visits, 16 MiB and 4096 retained references per call."
			, "", "## Exports", ""
			, ...ir.declarations.map(item => `- ${item.name}: ${item.documentation.summary}`)
			, ""].join("\n")
		, "binding-manifest.json": json({ schemaVersion: 1
			, component: ir.component.id, bindingIrSha256
			, generator: { id: "lean-wasm/javascript-owned", version: 1 }, exports
			, files: paths, requiredInternalFiles: ["internal/runtime.mjs"] })
		, "package.json": json({ version: ir.component.version
			, type: "module", sideEffects: false, types: "./index.d.ts"
			, exports: { ".": { types: "./index.d.ts", import: "./index.mjs", default: "./index.mjs" } }
			, files: [...paths.filter(path => path !== "package.json"), "internal"] })
	});
};

/**
 * Reject altered entry points, weakened types and additional public files.
 *
 * @param ir - Independently validated owned contract.
 * @param files - Complete generated file map, before attaching private artifacts.
 */
export const auditOwnedJavaScriptPackage = (ir, files) => {
	const model = compileOwnedJavaScriptPackageModel(ir), expected = renderOwnedJavaScriptPackageLayout(model);
	if(canonicalizeJsonValue(files) !== canonicalizeJsonValue(expected)) fail("Owned JavaScript package differs from its checked public projection");
	return Object.freeze({ schemaVersion: 1, bindingIrSha256: model.bindingIrSha256
		, exports: Object.freeze([...ir.declarations.map(item => item.name), "close", "withRecovery", ...model.anchored ? ["copyValue"] : []])
		, publicEntry: ".", privateSubpaths: Object.freeze([]) });
};
