/**
 * Idiomatic Rust values with explicit ownership for resource-bearing graphs.
 * Generating these types does not admit a prepared Cargo package.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { planNativeGraphStorage } from "../c/copied-graph-layout.mjs";
import { ownedRustRuntime } from "./owned-runtime.mjs";

const keywords = new Set("as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final gen macro override priv typeof unsized virtual yield try union".split(" "));
const reserved = new Set([...keywords, ..."std num_bigint owned_runtime owned_values Error Resource Result Ok Err Vec String BigUint BigInt Sign Option Some None Box Drop Copy Clone Send Sync Default WithRecovery with_recovery bool u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 str usize isize char".split(" ")]);
const scalars = {
	unit: "()", bool: "bool", string: "String", bytes: "Vec<u8>"
	, nat: "BigUint", int: "BigInt", char: "char", usize: "u64", isize: "i64"
	, float32: "f32", float64: "f64", uint8: "u8", uint16: "u16", uint32: "u32"
	, uint64: "u64", int8: "i8", int16: "i16", int32: "i32", int64: "i64"
};

/**
 * Keep nominal records/enums, transparent aliases and native containers. Box
 * closes recursive value edges; only resource leaves carry shared leases.
 *
 * @param ir - Validated explicit ownership contract.
 * @param options - Prepared-package runtime policy.
 */
export const generateOwnedRustValues = (ir, options = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true });
	const nodes = new Map(c.nodes.map(node => [node.id, { ...node
		, aggregate: !node.leaf
		, fields: node.fields.map(field => ({ ...field, storage: "value" }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field, storage: "value" })) }))
	}]));
	const layout = planNativeGraphStorage(nodes), occupied = new Set(reserved);
	const claim = name => {
		if(typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || name.includes("__") || occupied.has(name)
			|| /^Owned(?:Identity|Raw|Union|Case|Callback)/u.test(name)) throw new TypeError(`Owned Rust name is reserved or duplicated: ${name}`);
		occupied.add(name); return name;
	};
	for(const item of c.functions) claim(item.cName.slice(c.prefix.length + 1));
	const names = new Map(), containers = new Map(), identities = new Map();
	for(const node of nodes.values())
	{
		if(node.kind !== "primitive" && node.name) names.set(node.id, claim(node.name));
		else if(node.kind !== "primitive") containers.set(node.id, claim(`Value${sha256(node.id).slice(0, 20)}`));
		if(node.identity) identities.set(node.id, `OwnedIdentity${sha256(node.id).slice(0, 20)}`);
	}
	const definitions = new Map(c.native.model.types.map(node => [node.id, node]));
	for(const alias of c.native.aliases) claim(definitions.get(alias.id).name);
	const groups = new Map(layout.boxedGroups.flatMap((group, index) => group.map(id => [id, index])));
	const boxed = (parent, field) => field.storage === "pointer" && !(containers.has(field.type)
		&& groups.has(parent) && groups.get(parent) === groups.get(field.type));
	const emitted = new Set();
	const type = (id, active = new Set()) => {
		const node = nodes.get(id);
		if(names.has(id)) return names.get(id);
		if(node.kind === "primitive") return scalars[node.name];
		if(emitted.has(id)) return containers.get(id);
		if(active.has(id)) throw new TypeError("Owned Rust container cycle requires a nominal value boundary");
		const next = new Set(active); next.add(id);
		if(node.element) return `Vec<${type(node.element, next)}>`;
		const args = node.fields.map(field => boxed(id, field) ? `Box<${type(field.type, next)}>` : type(field.type, next));
		return node.kind === "tuple" ? `(${args.join(", ")})` : `${{ option: "Option", result: "Result" }[node.kind]}<${args.join(", ")}>`;
	};
	const members = (id, fields) => {
		const seen = new Set();
		return fields.map(field => {
			const publicName = keywords.has(field.name) ? `${field.name}_` : field.name;
			if(seen.has(publicName)) throw new TypeError(`Owned Rust field name collides: ${publicName}`);
			seen.add(publicName); return { ...field, publicName, boxed: boxed(id, field) };
		});
	};
	const models = new Map([...nodes.values()].map(node => {
		const seen = new Set();
		const cases = node.cases.map(branch => {
			const name = branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join("");
			const publicName = reserved.has(name) ? `${name}_` : name;
			if(seen.has(publicName)) throw new TypeError(`Owned Rust constructor name collides: ${publicName}`);
			seen.add(publicName); return { ...branch, publicName, fields: members(node.id, branch.fields) };
		});
		return [node.id, { fields: members(node.id, node.fields), cases }];
	}));
	const bigint = c.nodes.some(node => node.integer);
	const lines = [ownedRustRuntime(c.prefix, options), ...bigint ? ["pub use num_bigint::{BigInt, BigUint};", ""] : []];
	const fieldType = field => field.boxed ? `Box<${type(field.type)}>` : type(field.type);
	for(const id of layout.order)
	{
		const node = nodes.get(id), model = models.get(id), name = names.get(id);
		if(node.identity) lines.push("#[doc(hidden)]", `pub enum ${identities.get(id)} {}`, `pub type ${name} = Resource<${identities.get(id)}>;`);
		else if(containers.has(id))
		{ lines.push(`pub type ${containers.get(id)} = ${type(id)};`); emitted.add(id); }
		else if(node.kind === "record") lines.push("#[derive(Clone, Debug, PartialEq)]", `pub struct ${name} {`
			, ...model.fields.map(field => `    pub ${field.publicName}: ${fieldType(field)},`), "}", "");
		else if(node.kind === "variant") lines.push("#[derive(Clone, Debug, PartialEq)]", `pub enum ${name} {`
			, ...model.cases.map(branch => `    ${branch.publicName}${branch.fields.length ? ` { ${branch.fields.map(field => `${field.publicName}: ${fieldType(field)}`).join(", ")} }` : ""},`), "}", "");
	}
	for(const alias of c.native.aliases) lines.push(`pub type ${definitions.get(alias.id).name} = ${type(alias.target)};`);
	return { c, layout, source: lines.join("\n") + "\n", bigint
		, types: [...nodes.values()].map(node => ({ ...node, hostName: type(node.id), identityTag: identities.get(node.id), ...models.get(node.id) })) };
};
