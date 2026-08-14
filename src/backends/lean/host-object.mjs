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

const namedType = (ir, id) => ir.types.find(type => type.id === id);
const pascal = value => value.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, letter) => letter.toUpperCase());
const snake = value => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const leanType = (ir, ref) => {
	if(ref.kind === "primitive")
	{
		if(ref.name === "unit") return "Unit";
		if(ref.name === "bool") return "Bool";
		if(ref.name === "string") return "String";
		if(ref.name === "bytes") return "ByteArray";
		if(ref.name === "nat") return "Nat";
		if(ref.name === "int") return "Int";
		if(ref.name === "float32" || ref.name === "float64") return "Float";
		const fixed = {
			uint8: "UInt8", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64"
			, int8: "Int8", int16: "Int16", int32: "Int32", int64: "Int64"
		};
		return fixed[ref.name];
	}
	if(ref.kind === "named") return namedType(ir, ref.id)?.name ?? "Unit";
	if(ref.kind === "parameter") return ref.id;
	const args = ref.arguments.map(argument => leanType(ir, argument));
	if(ref.constructor === "array") return `Array ${args[0]}`;
	if(ref.constructor === "option") return `Option ${args[0]}`;
	if(ref.constructor === "result") return `Except ${args[1]} ${args[0]}`;
	return `(${args.join(" × ")})`;
};

const deliveredType = (ir, declaration) => {
	const value = leanType(ir, declaration.result.type);
	if(declaration.resultMode === "promise") return `Task ${value}`;
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

const declarationName = declaration => declaration.kind === "property"
	? `${declaration.parameters.length === 0 ? "get" : "set"}${pascal(declaration.name)}`
	: declaration.name;

const emitTarget = (ir, target, resources) => {
	const namespace = `LeanBridge.Host.${pascal(target)}`;
	const lines = [
		`/- Generated from Binding IR SHA-256 ${hashBindingIr(ir)}. -/`
		, `namespace ${namespace}`
		, ""
		, "opaque HostIterator (α : Type) : Type"
		, "opaque HostAsyncIterator (α : Type) : Type"
		, ""
	];
	for(const type of resources)
	{
		lines.push(
			`/-- ${type.documentation.summary} Identity uses ${type.host.identity}. -/`,
			`opaque ${type.name} : Type`,
			`namespace ${type.name}`,
			"",
		);
		const declarations = ir.declarations.filter(declaration => declaration.owner === type.id);
		for(const declaration of declarations)
		{
			const parameters = declaration.parameters.map(parameter =>
				`(${parameter.name} : ${leanType(ir, parameter.type)})`,
			);
			if(declaration.receiver !== null) parameters.unshift(`(self : @& ${type.name})`);
			const name = declarationName(declaration);
			const symbol = `lean_bridge_host_${snake(target)}_${snake(type.name)}_${snake(name)}`;
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
				`/-- ${declaration.documentation.summary} ${sites.join("; ")}. -/`,
				`@[extern ${JSON.stringify(symbol)}] opaque ${name} ${parameters.join(" ")} : IO (${deliveredType(ir, declaration)})`,
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
