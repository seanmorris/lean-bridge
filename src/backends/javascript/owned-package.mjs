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

/**
 * Admit only the signatures implemented by the checked wasm32 ownership ABI.
 *
 * @param document - Explicit compiler-derived or independently reviewed v4 IR.
 */
export const compileOwnedJavaScriptPackageModel = document => {
	const layout = compileOwnedJavaScriptWasmLayout(document), model = layout.native.model;
	const ir = model.bindingIr, names = new Set(reserved);
	const claim = name => {
		if(!/^[$\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*$/u.test(name) || name.startsWith("_") || names.has(name))
			fail(`JavaScript public name is invalid or conflicts with another declaration: ${name}`);
		names.add(name);
	};
	for(const type of ir.types)
	{
		claim(named(type, "output"));
		if(type.kind !== "resource") claim(named(type, "input"));
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
		if(declaration.owner || declaration.typeParameters.length || declaration.parameters.some(parameter => parameter.optional))
			fail("Owned JavaScript exports require concrete synchronous functions");
	}
	if(ir.errors.some(error => error.category !== "boundary" || error.payload !== null))
		fail("Owned JavaScript declarations cannot omit domain error translation");
	return Object.freeze({ kind: "owned-javascript-package", ir, bindingIrSha256: model.bindingIrSha256 });
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

const declarations = ir => {
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const value = (reference, direction) => typeText(reference, direction, definitions);
	const parameters = (items, direction) => items.map((item, index) => `arg${index}: ${value(item.type, direction)}`).join(", ");
	const lines = ["declare const leanResource: unique symbol;", ""
		, "export interface LeanLease {", "  readonly disposed: boolean;"
		, "  dispose(): boolean;", "  retain(): this;", "}", ""];
	for(const type of ir.types)
	{
		lines.push(description(type));
		if(type.kind === "resource")
		{
			lines.push(`export interface ${type.name} extends LeanLease {`, `  readonly [leanResource]: ${JSON.stringify(type.id)};`, "}", "");
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
				const signature = `(${parameters(type.callable.parameters, input)}): ${value(type.callable.result.type, direction)};`;
				lines.push(`export interface ${name}${direction === "output" ? " extends LeanLease" : ""} {`, `  ${signature}`, "}", "");
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
		, `export function ${declaration.name}(${parameters(declaration.parameters, "input")}): ${value(declaration.result.type, "output")};`, "");
	lines.push("/** Release this component and invalidate its outstanding leases. */", "export function close(): boolean;"
		, "/** Supply the typed fallback required by an uninhabited callback result. */"
		, "export function withRecovery<Args extends readonly unknown[], Result>(operation: (...args: Args) => Result, recovery: Result): (...args: Args) => Result;"
		, "", "declare const bindings: Readonly<{"
		, ...[...ir.declarations.map(item => item.name), "close", "withRecovery"].map(name => `  ${name}: typeof ${name};`)
		, "}>;", "export default bindings;", "");
	return lines.join("\n");
};

/**
 * Emit no resource constructors, public tokens, transport selectors or JSON calls.
 *
 * @param model - Validated public ownership projection model.
 */
export const renderOwnedJavaScriptPackageLayout = model => {
	const { ir, bindingIrSha256 } = model;
	const exports = [...ir.declarations.map(item => item.name), "close", "withRecovery"];
	const entry = [`// Generated from Binding IR SHA-256 ${bindingIrSha256}.`
		, 'import { runtime } from "./internal/runtime.mjs";', ""];
	for(const declaration of ir.declarations)
	{
		const args = declaration.parameters.map((_, index) => `arg${index}`).join(", ");
		entry.push(description(declaration), `export function ${declaration.name}(${args}) {`
			, `  return runtime.call(${JSON.stringify(declaration.id)}, Array.from(arguments));`, "}", "");
	}
	entry.push("export function close() { return runtime.close(); }"
		, "export function withRecovery(operation, recovery) { return runtime.withRecovery(operation, recovery); }"
		, `export default Object.freeze({ ${exports.join(", ")} });`, "");
	const paths = ["index.mjs", "index.d.ts", "README.md", "binding-manifest.json", "package.json"];
	return Object.freeze({
		"index.mjs": entry.join("\n"), "index.d.ts": declarations(ir)
		, "README.md": [`# ${ir.component.name}`, "", ir.documentation.summary, ""
			, "Call the named exports with JavaScript values. The package loads its shared runtime automatically."
			, "Records use source field names. Variants use kind and named payload fields. Arrays and lists use arrays."
			, 'Options use { tag: "none" } or { tag: "some", value }. Results use { ok } or { error }.'
			, "Nat, Int, UInt64 and Int64 use bigint. Unit uses undefined; bytes use Uint8Array."
			, "", "## Resource lifetime", ""
			, "Resource values and returned functions expose dispose(), retain() and disposed. Dispose each distinct lease when finished."
			, "retain() creates an independent lease. Repeated references within a result share one wrapper."
			, "Callback arguments expire when the callback returns. Retain a resource inside the callback to keep it."
			, "close() releases the component and invalidates its outstanding leases. It does not close other packages."
			, "A native trap retires the shared heap; all packages using that heap reject further calls."
			, "", "## Callbacks and types", ""
			, "Pass ordinary synchronous functions as callbacks. Return a value of the declared result type."
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
		, exports: Object.freeze([...ir.declarations.map(item => item.name), "close", "withRecovery"])
		, publicEntry: ".", privateSubpaths: Object.freeze([]) });
};
