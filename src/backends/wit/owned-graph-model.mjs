/**
 * Preserve owned Lean graphs and callable identities in finite typed WIT.
 * Model generation alone does not admit a build or establish installed support.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { compileOwnedNativeValueLayout } from "../native/owned-value-layout.mjs";
import { renderCopiedWitComponent } from "./copied-component.mjs";
import { validateOrdinaryWasiSettings } from "./copied-model.mjs";
import { witVariantMember } from "./copied-variants.mjs";
import { createOwnedWitGraphTypes } from "./owned-graph-types.mjs";

const reserved = new Set("as async bool borrow char constructor enum export f32 f64 flags from func future import include interface list option own package record resource result s8 s16 s32 s64 static stream string tuple type u8 u16 u32 u64 use variant with world".split(" "));
const identifier = name => reserved.has(name) ? `%${name}` : name;
const watShape = copy => {
	// Define named handle aliases directly. Re-exporting the unnamed handle as an
	// equality alias leaves its dependency owner unset in the pinned WIT decoder.
	if(copy.aliasTarget?.resource) return `(${copy.aliasTarget.borrowed ? "borrow" : "own"} $resource${copy.aliasTarget.resourceIndex})`;
	if(copy.aliasTarget) return copy.aliasTarget.wat;
	if(copy.variant) return `(variant ${copy.cases.map(branch => `(case "${branch.witName}"${branch.payload ? ` ${branch.payload.wat}` : ""})`).join(" ")})`;
	if(copy.element) return `(list ${copy.element.wat})`;
	if(copy.compound === "option") return `(option ${copy.fields[0].type.wat})`;
	if(copy.compound === "result") return `(result ${copy.fields[0].type.wat} (error ${copy.fields[1].type.wat}))`;
	if(copy.compound === "tuple") return `(tuple ${copy.fields.map(field => field.type.wat).join(" ")})`;
	if(copy.scalarName === "unit") return '(enum "unit")';
	return copy.fields.length ? `(record ${copy.fields.map(field => `(field "${field.witName}" ${field.type.wat})`).join(" ")})` : '(enum "empty")';
};
const witShape = copy => {
	if(copy.aliasTarget) return `type ${copy.witName} = ${copy.aliasTarget.wit};`;
	if(copy.variant) return `variant ${copy.witName} { ${copy.cases.map(branch => `${identifier(branch.witName)}${branch.payload ? `(${branch.payload.wit})` : ""}`).join(", ")} }`;
	if(copy.element) return `type ${copy.witName} = list<${copy.element.wit}>;`;
	if(copy.compound) return `type ${copy.witName} = ${copy.compound}<${copy.fields.map(field => field.type.wit).join(", ")}>;`;
	if(copy.scalarName === "unit") return `enum ${copy.witName} { unit }`;
	return copy.fields.length ? `record ${copy.witName} { ${copy.fields.map(field => `${identifier(field.witName)}: ${field.type.wit}`).join(", ")} }` : `enum ${copy.witName} { empty }`;
};

/**
 * Generate distinct input/output graphs without copying identity-bearing fields.
 * Original ownership sites and Lean proof metadata remain in the manifest.
 *
 * @param ir - Explicit compiler-authenticated or reviewed version-4 contract.
 * @param settings - Optional WIT package coordinates.
 * @param options - Explicit capabilities of the consuming host adapter.
 */
export const compileOwnedWitGraphModel = (ir, settings = {}, options = {}) => {
	const layout = compileOwnedNativeValueLayout(ir, options), model = layout.model;
	const transfers = layout.functions.filter(item => item.transfers?.length);
	const anchors = layout.functions.filter(item => item.anchor !== undefined);
	const receivers = model.declarations.filter(item => item.receiver);
	const name = settings.name ?? `owned-h${model.bindingIrSha256.slice(0, 20)}`;
	const version = settings.version ?? model.component.version;
	validateOrdinaryWasiSettings({ name, version });
	const graph = createOwnedWitGraphTypes(layout), scope = new Set();
	const label = (name, scope) => witVariantMember(name, scope, message => { throw new TypeError(message); });
	const fn = (declaration, name, parameters, result, resource = null) => {
		const names = new Set();
		return { declaration, witName: label(name, scope), resource
			, parameters: parameters.map((site, index) => ({ witName: label(site.name ?? `arg${index}`, names), copy: graph.value(site.type, site.ownership === "transfer" ? "output" : "input") }))
			, resultCopy: graph.value(result.type, "output") };
	};
	const functions = model.declarations.map(declaration => {
		let parameters = declaration.parameters;
		if(declaration.receiver)
		{
			const names = new Set();
			parameters.forEach((site, index) => label(site.name ?? `arg${index + 1}`, names));
			let name = "receiver", suffix = 0;
			while(names.has(name)) name = `receiver-${++suffix}`;
			parameters = [{ ...declaration.receiver, name }, ...parameters];
		}
		return fn(declaration, declaration.name, parameters, declaration.result);
	});
	for(const resource of graph.resources.filter(resource => resource.node.kind === "callback"))
	{
		const signature = resource.node.callable;
		functions.push(fn(signature, `invoke-${resource.witName}`, [{ name: "self", type: resource.id }, ...signature.parameters], signature.result, resource));
	}
	const types = graph.finish(), resources = graph.resources;
	const packageName = `lean-bridge:${name}@${version}`;
	const importName = `lean-bridge:${name}/native@${version}`, exportName = `lean-bridge:${name}/api@${version}`;
	const signatures = functions.map(fn => `  ${identifier(fn.witName)}: func(${fn.parameters.map(parameter => `${identifier(parameter.witName)}: ${parameter.copy.wit}`).join(", ")}) -> ${fn.resultCopy.wit};`).join("\n");
	const typeBody = `${resources.map(resource => `    (export "${resource.witName}" (type $resource${resource.index} (sub resource)))\n    (type $borrow${resource.index} (borrow $resource${resource.index}))\n    (type $own${resource.index} (own $resource${resource.index}))`).join("\n")}
${types.map(copy => copy.aliasTarget?.witName ? `    (export "${copy.witName}" (type ${copy.wat} (eq ${copy.aliasTarget.wat})))`
	: `    (type $base${copy.index} ${watShape(copy)})\n    (export "${copy.witName}" (type ${copy.wat} (eq $base${copy.index})))`).join("\n")}
${functions.map(fn => `    (export "${fn.witName}" (func ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${parameter.copy.wat})`).join(" ")} (result ${fn.resultCopy.wat})))`).join("\n")}`;
	const wit = `package ${packageName};\n\ninterface native {\n${resources.map(resource => `  resource ${resource.witName};`).join("\n")}\n${types.map(copy => `  ${witShape(copy)}`).join("\n")}\n${signatures}\n}\n\ninterface api {\n  use native.{${[...resources, ...types].map(copy => copy.witName).join(", ")}};\n${signatures}\n}\n\nworld ${name} {\n  import native;\n  export api;\n}\n`;
	const wat = renderCopiedWitComponent({ surface: { functions }, functions, types, resources, typeBody, importName, exportName, preserveTypes: true });
	const manifest = { schemaVersion: 1
		, backend: "ordinary-wit-native-owned-graph-v1"
		, component: model.component, bindingIrSha256: model.bindingIrSha256
		, wit: { package: packageName, world: name, apiInterface: exportName, nativeImport: importName }
		, assurance: model.assurance, assuranceScope: model.assuranceScope
		, declarations: model.declarations.map((declaration, index) => ({ ...declaration
			, witName: functions[index].witName
			, ...declaration.receiver ? { receiver: { ...declaration.receiver
				, witName: functions[index].parameters[0].witName
				, witType: functions[index].parameters[0].copy.wit } } : {}
			, parameters: declaration.parameters.map((site, position) => ({ ...site, witType: functions[index].parameters[position + Number(Boolean(declaration.receiver))].copy.wit }))
			, result: { ...declaration.result, witType: functions[index].resultCopy.wit } }))
		, graph: { schemaVersion: receivers.length ? 3 : anchors.length ? 2 : 1
			, representation: "owned-typed-node-tables-v1"
			, layoutSha256: sha256(canonicalJson(layout)), limits: model.limits
			, ...transfers.length ? { inputTransfers: transfers.map(fn => ({ bindingId: fn.id, parameters: fn.transfers })) } : {}
			, ...anchors.length ? { resultAnchors: anchors.map(fn => ({ bindingId: fn.id, parameter: fn.anchor })) } : {}
			, ...receivers.length ? { receiverExports: receivers.map(item => ({ bindingId: item.id, kind: item.kind, owner: item.owner, argument: 0 })) } : {}
			, types: model.types
			, resources: resources.map(resource => ({ id: resource.id, kind: resource.node.kind, witName: resource.witName }))
			, values: [...graph.values].map(([key, copy]) => ({ key, witType: copy.wit
				, tables: copy.tables.map(table => ({ type: table.node.id, field: table.field, rowType: table.row.wit })) })) }
		, deferred: [...transfers.length ? [] : ["transferred-inputs"]
			, ...anchors.length ? [...receivers.length ? [] : ["receiver-result-anchors"], "callback-result-anchors"] : ["anchored-borrowed-results"]
			, "retained-host-callbacks", "asynchronous-callables"] };
	return { model, layout, graph, functions, types, resources, name, version, importName, exportName, wit, wat, manifest };
};
