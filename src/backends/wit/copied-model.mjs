/**
 * Project ordinary copied Lean values into an executable native-host WIT world.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { renderCopiedWitComponent } from "./copied-component.mjs";

const kebab = value => value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replaceAll("_", "-").toLowerCase();
const reserved = new Set("as async bool borrow char constructor enum export f32 f64 flags from func future import include interface list option own package record resource result s8 s16 s32 s64 static stream string tuple type u8 u16 u32 u64 use variant with world".split(" "));
const primitive = { bool: "bool", uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64", int8: "s8", int16: "s16", int32: "s32", int64: "s64", float32: "f32", float64: "f64", string: "string" };

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
 */
export const compileCopiedWitModel = (ir, settings = {}) => {
	const surface = compilePrimitiveCSurface(ir);
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
		copy.witName = primitive[copy.ref.name] ? null : admit(copy.record?.name ?? `bridge-value-${copy.index}`, ir.declarations[0]);
		copy.wit = copy.witName ?? primitive[copy.ref.name];
		copy.wat = copy.witName ? `$t${copy.index}` : copy.wit;
		const fields = new Set();
		for(const field of copy.fields) field.witName = admit(field.name, ir.declarations[0], fields);
	}
	for(const fn of surface.functions)
	{
		fn.witName = admit(fn.field, fn.declaration);
		const parameters = new Set();
		for(const [index, parameter] of fn.parameters.entries())
		{ parameter.witName = admit(parameter.name, fn.declaration, parameters); parameter.copy = surface.copy(fn.declaration.parameters[index].type); }
	}
	const types = surface.copies.filter(copy => copy.witName);
	const witType = copy => {
		if(copy.element) return `type ${copy.witName} = list<${copy.element.wit}>;`;
		if(copy.record) return copy.fields.length ? `record ${copy.witName} { ${copy.fields.map(field => `${field.witName}: ${field.type.wit}`).join(", ")} }` : `enum ${copy.witName} { empty }`;
		if(copy.ref.name === "unit") return `enum ${copy.witName} { unit }`;
		if(copy.ref.name === "int") return `record ${copy.witName} { negative: bool, limbs: list<u32> }`;
		return `type ${copy.witName} = list<${copy.ref.name === "nat" ? "u32" : "u8"}>;`;
	};
	const watType = copy => {
		if(copy.element) return `(list ${copy.element.wat})`;
		if(copy.record) return copy.fields.length ? `(record ${copy.fields.map(field => `(field "${field.witName}" ${field.type.wat})`).join(" ")})` : '(enum "empty")';
		if(copy.ref.name === "unit") return '(enum "unit")';
		if(copy.ref.name === "int") return '(record (field "negative" bool) (field "limbs" $limbs))';
		return `(list ${copy.ref.name === "nat" ? "u32" : "u8"})`;
	};
	const packageName = `lean-bridge:${name}@${version}`, exportName = `lean-bridge:${name}/api@${version}`, importName = `lean-bridge:${name}/native@${version}`;
	const signatures = surface.functions.map(fn => `  ${fn.witName}: func(${fn.parameters.map(parameter => `${parameter.witName}: ${parameter.copy.wit}`).join(", ")}) -> ${surface.copy(fn.declaration.result.type).wit};`).join("\n");
	const wit = `package ${packageName};\n\ninterface native {\n${types.map(copy => `  ${witType(copy)}`).join("\n")}\n${signatures}\n}\n\ninterface api {\n${types.length ? `  use native.{${types.map(copy => copy.witName).join(", ")}};\n` : ""}${signatures}\n}\n\nworld ${name} {\n  import native;\n  export api;\n}\n`;
	const typeBody = `    (type $limbs (list u32))\n${types.map(copy => `    (type $base${copy.index} ${watType(copy)})\n    (export "${copy.witName}" (type $t${copy.index} (eq $base${copy.index})))`).join("\n")}\n${surface.functions.map(fn => `    (export "${fn.witName}" (func ${fn.parameters.map(parameter => `(param "${parameter.witName}" ${parameter.copy.wat})`).join(" ")} (result ${surface.copy(fn.declaration.result.type).wat})))`).join("\n")}`;
	const wat = renderCopiedWitComponent({ surface, types, typeBody, importName, exportName });
	const manifest = { schemaVersion: 1, backend: "ordinary-wit-native-v1", component: ir.component, bindingIrSha256: hashBindingIr(ir), wit: { package: packageName, world: name, apiInterface: exportName, nativeImport: importName }, declarations: surface.functions.map(fn => ({ id: fn.declaration.id, witName: fn.witName })), deferred: [], assurance: ir.assurance };
	return { ir, surface, name, version, exportName, importName, wit, wat, manifest };
};

/**
 * Render the portable interface and native-host component source.
 *
 * @param model - Validated ordinary WIT projection.
 */
export const renderCopiedWitLayout = model => ({ wit: model.wit, manifest: model.manifest, files: { [`wit/${model.name}.wit`]: model.wit, [`component/${model.name}.wat`]: model.wat, "binding-manifest.json": `${JSON.stringify(model.manifest, null, 2)}\n` } });
