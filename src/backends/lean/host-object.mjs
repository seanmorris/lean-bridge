/**
 * Implements the host object module in the Lean backend.
 *
 * @file
 */

import { canonicalizeJsonValue, hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

/**
 * Reports Lean host object generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class LeanHostObjectGenerationError extends Error
{
	/**
   * Initializes the error used to report Lean host object generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "LeanHostObjectGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new LeanHostObjectGenerationError(code, message, details);
};

const pascal = value => value.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, letter) => letter.toUpperCase());
/** Generated modules accepted by the native host-object compiler (not a package support list). */
export const compiledHostModules = Object.freeze({ python: "LeanBridge.Host.Python", ruby: "LeanBridge.Host.Ruby", jvm: "LeanBridge.Host.Jvm" });
/** Package coordinates select their own checked host namespace. */
export const compiledHostTargets = Object.freeze({ pypi: "python", rubygems: "ruby", maven: "jvm" });
const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const primitive = Object.freeze({
	unit: "Unit", bool: "Bool", char: "Char", bytes: "ByteArray", string: "String"
	, nat: "Nat", int: "Int", usize: "USize", isize: "ISize"
	, float32: "Float32", float64: "Float"
	, uint8: "UInt8", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64"
	, int8: "Int8", int16: "Int16", int32: "Int32", int64: "Int64"
});
const leanType = (types, ref) => {
	if(ref.kind === "primitive" && Object.hasOwn(primitive, ref.name)) return `_root_.${primitive[ref.name]}`;
	if(ref.kind === "named" && types.has(ref.id)) return types.get(ref.id);
	if(ref.kind === "apply")
	{
		const args = ref.arguments.map(argument => leanType(types, argument));
		const constructor = { array: "Array", list: "List", option: "Option", result: "Except" }[ref.constructor];
		if(constructor) return `(_root_.${constructor} ${(ref.constructor === "result" ? args.reverse() : args).join(" ")})`;
		if(ref.constructor === "tuple" && args.length >= 2) return `(${args.join(" × ")})`;
	}
	// An unknown nominal or an unauthenticated HostNull must not become Unit,
	// a product, or an implicit type variable in an external declaration.
	return fail("unsupported-host-member-type", "Host member requires a concrete type declared on this target", { ref });
};

const deliveredType = (types, declaration) => {
	const value = leanType(types, declaration.result.type);
	if(declaration.resultMode === "promise") return `_root_.Task ${value}`;
	if(declaration.resultMode === "iterator") return `HostIterator ${value}`;
	if(declaration.resultMode === "async-iterator") return `HostAsyncIterator ${value}`;
	return value;
};

const ownershipNote = site => {
	const lifetime = site.lifetime === null
		? "none"
		: `${site.lifetime.scope}${site.lifetime.anchor === null ? "" : `:${site.lifetime.anchor}`}`;
	return `${site.ownership}, lifetime ${lifetime}`;
};

/**
 * Resolve an imported member's Lean name, including the two sides of a property.
 *
 * @param declaration - Validated host member.
 */
export const hostDeclarationName = declaration => declaration.kind === "property"
	? `${declaration.parameters.length === 0 ? "get" : "set"}${pascal(declaration.name)}`
	: declaration.name;

/**
 * Resolve the same external name on the Lean importer and native provider.
 *
 * @param target - Host language.
 * @param type - Nominal resource declaration.
 * @param declaration - Operation whose kind distinguishes reads and writes of the same property.
 */
export const hostMemberSymbol = (target, type, declaration) =>
	`lean_bridge_host_${snake(target)}_${snake(type.name)}_${snake(hostDeclarationName(declaration))}`;

const emitTarget = (ir, target, resources) => {
	const namespace = `LeanBridge.Host.${pascal(target)}`;
	const types = new Map(resources.map(resource => [resource.id, resource.name]));
	const names = new Set(["HostIterator", "HostAsyncIterator"]), symbols = new Set();
	const doc = text => text.replaceAll("/-", "/ -").replaceAll("-/", "- /");
	const lines = [
		`/- Generated from Binding IR SHA-256 ${hashBindingIr(ir)}. -/`
		, "set_option autoImplicit false"
		, `namespace ${namespace}`
		, ""
		, "opaque HostIterator (α : Type) : Type"
		, "opaque HostAsyncIterator (α : Type) : Type"
		, ""
	];
	for(const type of resources)
	{
		if(names.has(type.name) || type.typeParameters.length)
			fail("unsupported-host-resource", "Host resource names must be distinct and concrete", { resource: type.id });
		names.add(type.name);
		lines.push(`/-- ${doc(type.documentation.summary)} Identity uses ${type.host.identity}. -/`, `opaque ${type.name} : Type`, "");
	}
	// Nominal types must all exist before any member can return or borrow a peer.
	for(const type of resources)
	{
		lines.push(`namespace ${type.name}`, "");
		const declarations = ir.declarations.filter(declaration => declaration.owner === type.id);
		for(const declaration of declarations)
		{
			if(declaration.typeParameters.length) fail("unsupported-host-member-type", "Specialize host members before generation", { declaration: declaration.id });
			const parameters = declaration.parameters.map(parameter =>
				`(${parameter.name} : ${parameter.ownership === "borrow" ? "@& " : ""}${leanType(types, parameter.type)})`,
			);
			if(declaration.receiver !== null) parameters.unshift(`(self : ${declaration.receiver.ownership === "borrow" ? "@& " : ""}${type.name})`);
			const name = hostDeclarationName(declaration);
			const symbol = hostMemberSymbol(target, type, declaration);
			if(symbols.has(symbol)) fail("host-member-collision", "Host members resolve to the same external symbol", { symbol });
			symbols.add(symbol);
			const sites = [
				...(declaration.receiver === null
					? []
					: [`receiver ${ownershipNote(declaration.receiver)}`])
				, ...declaration.parameters.map(parameter =>
					`${parameter.name} ${ownershipNote(parameter)}`,
				)
				, `result ${ownershipNote(declaration.result)}`
			];
			lines.push(
				`/-- ${doc(declaration.documentation.summary)} ${sites.join("; ")}. -/`,
				`@[extern ${JSON.stringify(symbol)}] opaque ${name} ${parameters.join(" ")} : _root_.IO (${deliveredType(types, declaration)})`,
				"",
			);
		}
		lines.push(`end ${type.name}`, "");
	}
	lines.push(`end ${namespace}`, "");
	return lines.join("\n");
};

/**
 * Generates lean host object adapters from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 */
export const generateLeanHostObjectAdapters = ir => {
	validateBindingIr(ir);
	const resources = ir.types.filter(type => type.kind === "resource" && type.host !== null);
	for(const resource of resources)
	{
		const declarations = ir.declarations.filter(declaration => declaration.owner === resource.id);
		if(declarations.length === 0)
		{
			fail("empty-host-object", `${resource.id} has no owned declarations`, { resource: resource.id });
		}
		if(declarations.some(declaration => !declaration.effects.includes("host-call")))
		{
			fail("missing-host-effect", `${resource.id} contains a declaration without host-call`, {
				resource: resource.id
			});
		}
	}
	const files = {};
	const targets = [...new Set(resources.flatMap(resource => resource.host.targets))].sort();
	for(const target of targets)
	{
		const selected = resources.filter(resource => resource.host.targets.includes(target));
		files[`LeanBridge/Host/${pascal(target)}.lean`] = emitTarget(ir, target, selected);
	}
	const manifest = {
		schemaVersion: 1
		, bindingIrSha256: hashBindingIr(ir)
		, handleTransport: {
			public: false
			, generationSafe: true
			, staleHandle: "reject"
		}
		, resources: resources.map(resource => ({
			id: resource.id
			, targets: [...resource.host.targets]
			, identity: resource.host.identity
			, dynamic: resource.host.dynamic
			, declarations: ir.declarations
        .filter(declaration => declaration.owner === resource.id)
        .map(declaration => ({
					id: declaration.id
					, kind: declaration.kind
					, resultMode: declaration.resultMode
					, receiver: declaration.receiver === null ? null : ownershipNote(declaration.receiver)
					, parameters: declaration.parameters.map(parameter => ({
						name: parameter.name
						, ownership: ownershipNote(parameter)
					}))
					, result: ownershipNote(declaration.result)
        }))
		}))
	};
	files["host-object-manifest.json"] = `${canonicalizeJsonValue(manifest)}\n`;
	return Object.freeze(files);
};
