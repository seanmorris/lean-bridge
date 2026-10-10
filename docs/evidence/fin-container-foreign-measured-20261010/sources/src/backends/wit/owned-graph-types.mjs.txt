/**
 * Finite canonical types with distinct borrowed-input and owned-output shapes.
 * Resource identities stay resource handles, never integers in node tables.
 *
 * @file
 */
import { witVariantMember } from "./copied-variants.mjs";

const primitives = { bool: "bool", char: "char", uint8: "u8", uint16: "u16"
	, uint32: "u32", uint64: "u64", int8: "s8", int16: "s16", int32: "s32"
	, int64: "s64", usize: "u64", isize: "s64", float32: "f32", float64: "f64"
	, string: "string" };
const fail = message => { throw new TypeError(`Owned WIT types: ${message}`); };
const dependencies = copy => copy.aliasTarget ? [copy.aliasTarget]
	: copy.element ? [copy.element]
		: copy.variant ? copy.cases.flatMap(branch => branch.payload ? [branch.payload] : [])
			: (copy.fields ?? []).map(field => field.type);

/**
 * Keep recursive shapes finite through typed row indices. Each root carries
 * only the tables reachable from its type, so copied roots contain no handles.
 *
 * @param layout - Validated ownership-aware native layout and original model.
 */
export const createOwnedWitGraphTypes = layout => {
	const names = new Set(), types = [], resources = [], scalars = new Map();
	const sourceNodes = new Map(layout.nodes.map(node => [node.id, node]));
	const nodes = new Map(), rows = new Map(), values = new Map(), aliases = new Map();
	const label = name => witVariantMember(name, names, fail, "type");
	const named = (name, shape) => {
		const index = types.length, witName = label(name);
		const copy = { ...shape, index, witName, wit: witName, wat: `$t${index}` };
		types.push(copy); return copy;
	};
	const field = (name, type, scope = new Set()) => ({ name
		, witName: witVariantMember(name, scope, fail, "field"), type });
	const members = (fields, direction) => {
		const scope = new Set();
		return fields.map(item => field(item.sourceName, reference(item.type, direction), scope));
	};
	const scalar = name => {
		if(scalars.has(name)) return scalars.get(name);
		const wat = primitives[name];
		const scalarName = name === "usize" ? "uint64" : name === "isize" ? "int64" : name;
		const copy = wat ? { scalarName, wit: wat, wat, fields: [] }
			: named(`bridge-${name}`, name === "nat" || name === "bytes"
				? { scalarName, element: scalar(name === "nat" ? "uint32" : "uint8"), fields: [] }
				: name === "int" ? { scalarName, record: true, fields: [field("negative", scalar("bool")), field("limbs", scalar("nat"))] }
					: name === "unit" ? { scalarName, fields: [] } : fail(`unknown primitive ${name}`));
		scalars.set(name, copy); return copy;
	};
	for(const node of layout.nodes)
	{
		if(node.kind === "primitive") nodes.set(node.id, { node, input: scalar(node.name), output: scalar(node.name) });
		else if(node.kind === "resource" || node.kind === "callback")
		{
			const resource = { id: node.id, node, witName: label(`identity-${node.name}`) };
			const handle = borrowed => ({ resource: true, borrowed, identity: node.id, fields: [] });
			resource.borrow = handle(true); resource.own = handle(false); resources.push(resource);
			nodes.set(node.id, { node, input: resource.borrow, output: resource.own, resource });
		}
		else nodes.set(node.id, { node, reference: named(`bridge-ref-${node.index}`, { record: true, fields: [field("index", scalar("uint32"))] }) });
	}
	const reference = (id, direction) => {
		const type = nodes.get(id); return type.reference ?? type[direction];
	};
	const row = (id, direction) => {
		const key = `${direction}:${id}`;
		if(rows.has(key)) return rows.get(key);
		const node = sourceNodes.get(id), fields = members(node.fields, direction);
		let shape;
		if(node.element) shape = { element: reference(node.element, direction), fields: [] };
		else if(node.kind === "variant")
		{
			const scope = new Set();
			const cases = node.cases.map((branch, index) => {
				const fields = members(branch.fields, direction);
				const witName = witVariantMember(branch.sourceName, scope, fail, "constructor");
				return { witName, fields
					, payload: fields.length ? named(`bridge-case-${node.index}-${index}-${direction}`, { payloadRecord: true, fields }) : null };
			});
			shape = { variant: true, fields: [], cases };
		}
		else shape = node.kind === "record" ? { record: true, fields } : { compound: node.kind, fields };
		const copy = named(`bridge-row-${node.index}-${direction}`, shape); rows.set(key, copy); return copy;
	};
	const reachable = id => {
		const seen = new Set(), pending = [id];
		while(pending.length)
		{
			const node = sourceNodes.get(pending.pop());
			if(node.leaf || seen.has(node.id)) continue;
			seen.add(node.id);
			pending.push(...node.fields.map(field => field.type), ...node.cases.flatMap(branch => branch.fields.map(field => field.type)));
			if(node.element) pending.push(node.element);
		}
		return [...seen].map(id => sourceNodes.get(id)).sort((a, b) => a.index - b.index);
	};
	const value = (id, direction) => {
		if(!["input", "output"].includes(direction)) fail("value direction must be explicit");
		const node = nodes.get(id);
		if(node.node.leaf) return node[direction];
		const key = `${direction}:${id}`;
		if(values.has(key)) return values.get(key);
		const tables = reachable(id).map(item => ({ node: item, field: `nodes${item.index}`, row: row(item.id, direction) }));
		const arena = named(`bridge-arena-${node.node.index}-${direction}`, { record: true
			, fields: tables.map(table => field(table.field, named(`bridge-table-${node.node.index}-${table.node.index}-${direction}`, { element: table.row, fields: [] }))) });
		const copy = named(`bridge-value-${node.node.index}-${direction}`, { record: true
			, fields: [field("root", node.reference), field("nodes", arena)]
			, tables, arena });
		values.set(key, copy); return copy;
	};
	const source = new Map(layout.model.types.map(type => [type.id, type]));
	const resolved = new Map(layout.aliases.map(alias => [alias.id, alias.target]));
	const publicValue = (id, direction) => {
		const target = resolved.get(id) ?? id, original = source.get(id);
		const underlying = value(target, direction);
		if(!["record", "variant", "alias"].includes(original.kind)) return underlying;
		const key = `${direction}:${id}`;
		if(!aliases.has(key)) aliases.set(key, named(`${original.name}-${direction}`, { ...underlying, resource: false, aliasTarget: underlying }));
		return aliases.get(key);
	};
	const finish = () => {
		for(const [index, resource] of resources.entries())
		{
			resource.index = types.length + index;
			for(const handle of [resource.borrow, resource.own]) Object.assign(handle, {
				resourceIndex: resource.index
				, wit: `${handle.borrowed ? "borrow" : "own"}<${resource.witName}>`
				, wat: `$${handle.borrowed ? "borrow" : "own"}${resource.index}`
			});
		}
		const sorted = [], seen = new Set(), active = new Set();
		const visit = copy => {
			if(!copy.witName || seen.has(copy)) return;
			if(active.has(copy)) fail("canonical types must not be recursive");
			active.add(copy); dependencies(copy).forEach(visit); active.delete(copy);
			seen.add(copy); sorted.push(copy);
		};
		types.forEach(visit); return sorted;
	};
	return { nodes, rows, values, aliases, resources, value: publicValue, finish };
};
