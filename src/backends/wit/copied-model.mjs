/**
 * Project ordinary copied Lean values into an executable native-host WIT world.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { renderCopiedWitComponent } from "./copied-component.mjs";
import { compileCopiedWitAliases } from "./copied-aliases.mjs";
import { witVariantMember, witVariantPayloads } from "./copied-variants.mjs";

const kebab = value => value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replaceAll("_", "-").toLowerCase();
const reserved = new Set("as async bool borrow char constructor enum export f32 f64 flags from func future import include interface list option own package record resource result s8 s16 s32 s64 static stream string tuple type u8 u16 u32 u64 use variant with world".split(" "));
const primitive = { char: "char", bool: "bool", uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64", int8: "s8", int16: "s16", int32: "s32", int64: "s64", float32: "f32", float64: "f64", string: "string" };
const identifier = value => reserved.has(value) ? `%${value}` : value;

/**
 * Validate archive coordinates without normalizing distinct WIT identities.
 *
 * @param settings - Optional archive name and exact semantic version.
 */
export const validateOrdinaryWasiSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 100 || !/^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/.test(settings.name) || reserved.has(settings.name))) throw new TypeError("WIT/WASI name must be a non-reserved lowercase kebab-case coordinate");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?$/.test(settings.version)) throw new TypeError("WIT/WASI version must be an exact semantic version");
};

/**
 * Compile every selected export, with source-located rejection on unsupported input.
 *
 * @param ir - Authoritative compiler-derived Binding IR.
 * @param settings - Optional archive name and exact semantic version.
 * @param options - Explicit projection capabilities.
 * @param options.callables - Admit the primitive callable resource contract.
 */
export const compileCopiedWitModel = (ir, settings = {}, { callables = false } = {}) => {
	const surface = compilePrimitiveCSurface(ir, { callables, compounds: true, lists: true, variants: true });
	const name = settings.name ?? kebab(surface.prefix), version = settings.version ?? ir.component.version;
	validateOrdinaryWasiSettings({ name, version });
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-wit-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	const names = new Set();
	const admit = (value, declaration, scope = names) => {
		const label = kebab(value);
		if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(label) || reserved.has(label) || scope.has(label)) fail(declaration, `WIT name is reserved or duplicated: ${label}`);
		scope.add(label); return label;
	};
	for(const copy of surface.copies)
	{
		copy.witName = primitive[copy.scalarName] ? null : admit(copy.record?.name ?? copy.variant?.name ?? `bridge-value-${copy.index}`, ir.declarations[0]);
		copy.wit = copy.witName ?? primitive[copy.scalarName];
		copy.wat = copy.witName ? `$t${copy.index}` : copy.wit;
		const fields = new Set();
		for(const [index, field] of copy.fields.entries())
			field.witName = copy.record
				? witVariantMember(copy.record.fields[index].name, fields, message => fail(ir.declarations[0], message), "record field")
				: admit(field.name, ir.declarations[0], fields);
		if(copy.variant)
		{
			const cases = new Set(), reject = message => fail(ir.declarations[0], message);
			for(const [index, branch] of copy.cases.entries())
			{
				const original = copy.variant.cases[index], fields = new Set();
				branch.witName = witVariantMember(original.name, cases, reject);
				for(const [index, field] of branch.fields.entries()) field.witName = witVariantMember(original.fields[index].name, fields, reject);
			}
		}
	}
	const functionNames = new Set(surface.functions.map(fn => kebab(fn.field)));
	const admitAlias = (name, declaration) => {
		let label = kebab(name);
		while(functionNames.has(label)) label = `alias-${label}`;
		return admit(label, declaration);
	};
	const aliasModel = surface.aliases.length ? compileCopiedWitAliases({ ir, surface, admit, admitAlias, fail }) : null;
	const copied = aliasModel?.copy ?? surface.copy;
	const { types, nextIndex } = witVariantPayloads(aliasModel?.types ?? surface.copies.filter(copy => copy.witName)
		, aliasModel?.nextIndex ?? surface.copies.length, value => admit(value, ir.declarations[0]));
	const resources = [...surface.callbacks.values()].map((callback, index) => {
		const signature = callback.type.callable;
		const label = type => kebab(type.name);
		const witName = admit(`function-${signature.parameters.map(site => label(site.type)).join("-")}-to-${label(signature.result.type)}`, ir.declarations[0]);
		const resource = { ...callback, index: nextIndex + index, witName };
		resource.borrow = { resource: true, resourceIndex: resource.index, borrowed: true, wit: `borrow<${witName}>`, wat: `$borrow${resource.index}` };
		resource.own = { resource: true, resourceIndex: resource.index, borrowed: false, wit: `own<${witName}>`, wat: `$own${resource.index}` };
		return resource;
	});
	const value = (ref, returned = false) => resources.find(resource => resource.type.id === ref.id)?.[returned ? "own" : "borrow"] ?? copied(ref);
	for(const fn of surface.functions)
	{
		fn.witName = admit(fn.field, fn.declaration);
		const parameters = new Set();
		for(const [index, parameter] of fn.parameters.entries())
		{ parameter.witName = admit(parameter.name, fn.declaration, parameters); parameter.copy = value(fn.declaration.parameters[index].type); }
		fn.resultCopy = value(fn.declaration.result.type, true);
	}
	const functions = [...surface.functions
		, ...resources.map(resource => ({
			witName: admit(`invoke-${resource.witName}`, ir.declarations[0])
			, resource
			, parameters: [{ witName: "self", copy: resource.borrow }, ...resource.type.callable.parameters.map((site, index) => ({ witName: `arg${index}`, copy: surface.copy(site.type) }))]
			, resultCopy: surface.copy(resource.type.callable.result.type)}))
	];
	const witType = copy => {
		if(copy.aliasTarget) return `type ${copy.witName} = ${copy.aliasTarget.wit};`;
		if(copy.variant) return `variant ${copy.witName} { ${copy.cases.map(branch => `${identifier(branch.witName)}${branch.payload ? `(${branch.payload.wit})` : ""}`).join(", ")} }`;
		if(copy.payloadRecord) return `record ${copy.witName} { ${copy.fields.map(field => `${identifier(field.witName)}: ${field.type.wit}`).join(", ")} }`;
		if(copy.compound === "option") return `type ${copy.witName} = option<${copy.fields[0].type.wit}>;`;
		if(copy.compound === "result") return `type ${copy.witName} = result<${copy.fields.map(field => field.type.wit).join(", ")}>;`;
		if(copy.compound === "tuple") return `type ${copy.witName} = tuple<${copy.fields.map(field => field.type.wit).join(", ")}>;`;
		if(copy.element) return `type ${copy.witName} = list<${copy.element.wit}>;`;
		if(copy.record) return copy.fields.length ? `record ${copy.witName} { ${copy.fields.map(field => `${identifier(field.witName)}: ${field.type.wit}`).join(", ")} }` : `enum ${copy.witName} { empty }`;
		if(copy.scalarName === "unit") return `enum ${copy.witName} { unit }`;
		if(copy.scalarName === "int") return `record ${copy.witName} { negative: bool, limbs: list<u32> }`;
		return `type ${copy.witName} = list<${copy.scalarName === "nat" ? "u32" : "u8"}>;`;
	};
	const watType = copy => {
		if(copy.variant) return `(variant ${copy.cases.map(branch => `(case "${branch.witName}"${branch.payload ? ` ${branch.payload.wat}` : ""})`).join(" ")})`;
		if(copy.payloadRecord) return `(record ${copy.fields.map(field => `(field "${field.witName}" ${field.type.wat})`).join(" ")})`;
		if(copy.compound === "option") return `(option ${copy.fields[0].type.wat})`;
		if(copy.compound === "result") return `(result ${copy.fields[0].type.wat} (error ${copy.fields[1].type.wat}))`;
		if(copy.compound === "tuple") return `(tuple ${copy.fields.map(field => field.type.wat).join(" ")})`;
		if(copy.element) return `(list ${copy.element.wat})`;
		if(copy.record) return copy.fields.length ? `(record ${copy.fields.map(field => `(field "${field.witName}" ${field.type.wat})`).join(" ")})` : '(enum "empty")';
		if(copy.scalarName === "unit") return '(enum "unit")';
		if(copy.scalarName === "int") return '(record (field "negative" bool) (field "limbs" $limbs))';
		return `(list ${copy.scalarName === "nat" ? "u32" : "u8"})`;
	};
	const packageName = `lean-bridge:${name}@${version}`, exportName = `lean-bridge:${name}/api@${version}`, importName = `lean-bridge:${name}/native@${version}`;
	const signatures = functions.map(fn => `  ${fn.witName}: func(${fn.parameters.map(parameter => `${parameter.witName}: ${parameter.copy.wit}`).join(", ")}) -> ${fn.resultCopy.wit};`).join("\n");
	const resourceWit = resources.length ? resources.map(resource => `  resource ${resource.witName};`).join("\n") + "\n" : "";
	const exportedTypes = [...types, ...resources];
	const wit = `package ${packageName};\n\ninterface native {\n${types.map(copy => `  ${witType(copy)}`).join("\n")}\n${resourceWit}${signatures}\n}\n\ninterface api {\n${exportedTypes.length ? `  use native.{${exportedTypes.map(copy => copy.witName).join(", ")}};\n` : ""}${signatures}\n}\n\nworld ${name} {\n  import native;\n  export api;\n}\n`;
	const resourceWat = resources.length ? resources.map(resource => `    (export "${resource.witName}" (type $resource${resource.index} (sub resource)))\n    (type $borrow${resource.index} (borrow $resource${resource.index}))\n    (type $own${resource.index} (own $resource${resource.index}))`).join("\n") + "\n" : "";
	const typeBody = `    (type $limbs (list u32))\n${types.map(copy => {
		const index = copy.witIndex ?? copy.index;
		if(copy.aliasTarget?.witName) return `    (export "${copy.witName}" (type $t${index} (eq ${copy.aliasTarget.wat})))`;
		return `    (type $base${index} ${copy.aliasTarget?.wat ?? watType(copy)})\n    (export "${copy.witName}" (type $t${index} (eq $base${index})))`;
	}).join("\n")}\n${resourceWat}${functions.map(fn => `    (export "${fn.witName}" (func ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${parameter.copy.wat})`).join(" ")} (result ${fn.resultCopy.wat})))`).join("\n")}`;
	const variants = types.filter(copy => copy.variant && !copy.aliasTarget);
	const wat = renderCopiedWitComponent({ surface, functions, types, resources, typeBody, importName, exportName, preserveTypes: !!aliasModel || variants.length > 0 });
	const manifest = { schemaVersion: 1, backend: "ordinary-wit-native-v1", component: ir.component, bindingIrSha256: hashBindingIr(ir), wit: { package: packageName, world: name, apiInterface: exportName, nativeImport: importName }, declarations: surface.functions.map(fn => ({ id: fn.declaration.id, witName: fn.witName })), deferred: [], assurance: ir.assurance };
	if(aliasModel || variants.length)
	{
		if(aliasModel) manifest.aliases = aliasModel.aliases;
		manifest.contracts = {
			declarations: surface.functions.map(fn => ({ id: fn.declaration.id
				, parameters: fn.declaration.parameters.map((site, index) => ({ name: site.name, type: site.type, witType: fn.parameters[index].copy.wit }))
				, result: { type: fn.declaration.result.type, witType: fn.resultCopy.wit } }))
			, records: types.filter(copy => copy.record && !copy.aliasTarget).map(copy => ({ id: copy.record.id
				, witName: copy.witName
				, fields: copy.record.fields.map((field, index) => ({ name: field.name, type: field.type, witType: copy.fields[index].type.wit })) }))
		};
		if(variants.length) manifest.contracts.variants = variants.map(copy => ({ id: copy.variant.id
			, name: copy.variant.name
			, witName: copy.witName
			, cases: copy.variant.cases.map((branch, index) => ({ name: branch.name
				, witName: copy.cases[index].witName
				, payloadType: copy.cases[index].payload?.wit ?? null
				, fields: branch.fields.map((field, position) => ({ name: field.name
					, type: field.type
					, witName: copy.cases[index].fields[position].witName
					, witType: copy.cases[index].fields[position].type.wit })) })) }));
	}
	if(resources.length)
	{
		manifest.backend = "ordinary-wit-native-callable-v1";
		manifest.callables = resources.map(resource => ({ id: resource.type.id, witName: resource.witName, invoke: `invoke-${resource.witName}`, parameter: "borrow", result: "own" }));
	}
	return { ir, surface, functions, resources, name, version, exportName, importName, wit, wat, manifest };
};

/**
 * Render the portable interface and native-host component source.
 *
 * @param model - Validated ordinary WIT projection.
 */
export const renderCopiedWitLayout = model => ({ wit: model.wit, manifest: model.manifest, files: { [`wit/${model.name}.wit`]: model.wit, [`component/${model.name}.wat`]: model.wat, "binding-manifest.json": `${JSON.stringify(model.manifest, null, 2)}\n` } });
