/**
 * Owned Rust values for finite copied graphs. Compilation and package admission
 * still require their checked native conversions and installed acceptance.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";

const keywords = new Set("as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final gen macro override priv typeof unsized virtual yield try union".split(" "));
const reserved = new Set([...keywords, ..."std num_bigint __runtime Error Result Ok Err Vec String BigUint BigInt Sign Option Some None Box Drop Copy Clone Send Sync Default GraphError GraphBudget GraphScope GraphOwner GraphOutput GraphLifecycle bool u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 str usize isize char".split(" ")]);
const scalars = {
	unit: "()"
	, bool: "bool"
	, string: "String"
	, bytes: "Vec<u8>"
	, nat: "BigUint"
	, int: "BigInt"
	, char: "char"
	, usize: "u64"
	, isize: "i64"
	, float32: "f32"
	, float64: "f64"
	, uint8: "u8"
	, uint16: "u16"
	, uint32: "u32"
	, uint64: "u64"
	, int8: "i8"
	, int16: "i16"
	, int32: "i32"
	, int64: "i64"
};

/**
 * Preserve nominal records/enums, transparent aliases and native containers.
 * Recursive ownership uses Box, never reference-counted identities or handles.
 *
 * @param ir - Pure, concrete copied Binding IR.
 */
export const generateCopiedRustGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), definitions = new Map(ir.types.map(type => [type.id, type]));
	const nodes = new Map(layout.nodes.map(node => [node.id, node]));
	const names = new Map(), occupied = new Set(reserved);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.includes("__") || occupied.has(name) || /^Graph(?:Raw\d+|Union\d+|Case\d+_\d+)$/.test(name))
			throw new TypeError(`Rust graph value name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	for(const root of layout.roots) claim(root.name.slice(layout.prefix.length + 1));
	for(const definition of ir.types) names.set(definition.id, claim(definition.name));
	const containers = new Map();
	for(const node of layout.nodes) if(node.ref.kind === "apply") containers.set(node.id, claim(`Graph${sha256(node.id).slice(0, 20)}`));
	const groups = new Map(layout.boxedGroups.flatMap((group, index) => group.map(id => [id, index])));
	// Native C must also box cyclic container structs. Rust can keep Option and
	// Result inline and close these cycles with Box at the nominal child edge.
	const boxed = (parent, field) => field.storage === "pointer" && !(nodes.get(field.type).ref.kind === "apply"
		&& groups.has(parent) && groups.get(parent) === groups.get(field.type));
	const emitted = new Set();
	const type = id => {
		const node = nodes.get(id);
		if(node.ref.kind === "named") return names.get(node.ref.id);
		if(node.kind === "primitive") return scalars[node.ref.name];
		if(emitted.has(id)) return containers.get(id);
		if(node.element) return `Vec<${type(node.element)}>`;
		const arguments_ = node.fields.map(field => boxed(id, field) ? `Box<${type(field.type)}>` : type(field.type));
		return node.kind === "tuple" ? `(${arguments_.join(", ")})`
			: `${{ option: "Option", result: "Result" }[node.kind]}<${arguments_.join(", ")}>`;
	};
	const members = (id, fields) => {
		const seen = new Set();
		return fields.map(field => {
			const publicName = keywords.has(field.name) ? `${field.name}_` : field.name;
			if(seen.has(publicName)) throw new TypeError(`Rust graph field name collides: ${publicName}`);
			seen.add(publicName);
			return { ...field, publicName, boxed: boxed(id, field) };
		});
	};
	const models = new Map(layout.nodes.map(node => {
		const seen = new Set();
		const cases = node.cases.map(branch => {
			const name = branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join("");
			const publicName = reserved.has(name) ? `${name}_` : name;
			if(seen.has(publicName)) throw new TypeError(`Rust graph constructor name collides: ${publicName}`);
			seen.add(publicName); return { ...branch, publicName, fields: members(node.id, branch.fields) };
		});
		return [node.id, { fields: members(node.id, node.fields), cases }];
	}));
	const bigint = layout.nodes.some(node => ["nat", "int"].includes(node.ref.name));
	const lines = [...bigint ? ["pub use num_bigint::{BigInt, BigUint};", ""] : []];
	const fieldType = field => field.boxed ? `Box<${type(field.type)}>` : type(field.type);
	for(const id of layout.order)
	{
		const node = nodes.get(id), model = models.get(id), name = names.get(node.ref.id);
		if(node.ref.kind === "apply")
		{ lines.push(`pub type ${containers.get(id)} = ${type(id)};`); emitted.add(id); }
		else if(node.kind === "record") lines.push("#[derive(Clone, Debug, PartialEq)]", `pub struct ${name} {`
			, ...model.fields.map(field => `    pub ${field.publicName}: ${fieldType(field)},`), "}", "");
		else if(node.kind === "variant") lines.push("#[derive(Clone, Debug, PartialEq)]", `pub enum ${name} {`
			, ...model.cases.map(branch => `    ${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map(field => `${field.publicName}: ${fieldType(field)}`).join(", ")} }` : ""},`)
			, "}", "");
	}
	for(const alias of layout.aliases) lines.push(`pub type ${definitions.get(alias.id).name} = ${type(alias.target)};`);
	lines.push("");
	return {
		layout
		, source: lines.join("\n")
		, bigint
		, types: layout.nodes.map((node, index) => ({ id: node.id, index, name: type(node.id), ...models.get(node.id) })) };
};
