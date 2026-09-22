/**
 * Finite native layouts for copied graphs. Planning a layout does not admit a
 * compiled export; native conversion and installed acceptance are separate.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { componentRecordDefinitions } from "../../abi/component-records.mjs";
import { assertComponentCopySemantics } from "../../abi/component-copied.mjs";
import { compileComponentCopiedGraph, snapshotComponentCopiedGraph } from "../../abi/component-recursive.mjs";
import { cIdentifier, cKeywords, cRecordIdentifier, cVariantIdentifier, cVariantTag } from "./generate.mjs";

const fail = message => { throw new TypeError(`Invalid native copied graph layout: ${message}`); };
const safe = name => /^[a-z][a-z0-9_]*$/.test(name) && !name.includes("__") && !cKeywords.has(name);
const freeze = value => {
	if(value && typeof value === "object" && !Object.isFrozen(value))
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
const scalars = {
	unit: "uint8_t"
	, bool: "bool"
	, uint8: "uint8_t"
	, uint16: "uint16_t"
	, uint32: "uint32_t"
	, uint64: "uint64_t"
	, int8: "int8_t", int16: "int16_t", int32: "int32_t", int64: "int64_t"
	, usize: "uint64_t"
	, isize: "int64_t"
	, char: "uint32_t"
	, float32: "float"
	, float64: "double"
};
const inlineValueLimit = 64;

// Iterative Kosaraju: metadata can contain a thousand nominal definitions, even
// when values have a much smaller independent runtime-depth allowance.
const components = (ids, edges) => {
	const seen = new Set(), order = [], reverse = new Map(ids.map(id => [id, []]));
	for(const id of ids) for(const child of edges(id)) reverse.get(child).push(id);
	for(const id of ids)
	{
		if(seen.has(id)) continue;
		seen.add(id);
		const stack = [{ id, index: 0, children: edges(id) }];
		while(stack.length)
		{
			const frame = stack.at(-1);
			if(frame.index === frame.children.length)
			{ order.push(frame.id); stack.pop(); continue; }
			const child = frame.children[frame.index++];
			if(!seen.has(child))
			{ seen.add(child); stack.push({ id: child, index: 0, children: edges(child) }); }
		}
	}
	const membership = new Map(), groups = [];
	for(const id of order.reverse())
	{
		if(membership.has(id)) continue;
		const group = [], pending = [id], index = groups.length;
		membership.set(id, index);
		while(pending.length)
		{
			const current = pending.pop(); group.push(current);
			for(const parent of reverse.get(current)) if(!membership.has(parent))
			{ membership.set(parent, index); pending.push(parent); }
		}
		groups.push(group.sort());
	}
	return { membership, groups };
};

/**
 * Resolve transparent aliases once, retain finite nominal edges, and box cyclic
 * or oversized inline fields. Array/List spans already supply indirection.
 * All members of an inline strongly connected component use the same rule;
 * declaration order never chooses which public field becomes a pointer.
 *
 * @param ir - Validated copied Binding IR with semantic names and constructors.
 */
export const compileCopiedCGraphLayout = ir => {
	validateBindingIr(ir);
	const definitions = componentRecordDefinitions(ir, true);
	const { graph, resolve } = compileComponentCopiedGraph({ schemaVersion: 1, root: { kind: "primitive", name: "unit" }, types: definitions });
	const checkedRoot = root => snapshotComponentCopiedGraph({ schemaVersion: 1, root, types: graph.types }).root;
	assertComponentCopySemantics({ exports: ir.declarations.map(declaration => ({ bindingId: declaration.id
		, parameters: declaration.parameters.map(site => site.type)
		, result: declaration.result.type })) }, ir, checkedRoot);
	const prefix = cIdentifier(ir.component.id.slice(0, ir.component.id.lastIndexOf("@")).split("/").at(-1));
	if(!safe(prefix)) fail("invalid package identifier");
	const sourceNames = new Map(ir.types.map(type => [type.id, type.name]));
	const nodes = new Map(), pending = [], names = new Map();
	for(const suffix of ["status", "error", "error_code", "initialize", "runtime", "runtime_v1"])
		names.set(`${prefix}_${suffix}`, "reserved runtime name");
	const claim = (name, identity) => {
		if(names.has(name) && names.get(name) !== identity) fail(`C identifier collision: ${name}`);
		names.set(name, identity);
	};
	const functionNames = new Map(ir.declarations.map(declaration => {
		const member = cIdentifier(declaration.name);
		if(!safe(member)) fail(`invalid function name: ${declaration.name}`);
		const name = `${prefix}_${member}`;
		claim(name, declaration.id);
		return [declaration.id, name];
	}));
	const reference = ref => {
		const resolved = resolve(ref);
		return ["record", "variant"].includes(resolved.kind) ? { kind: "named", id: resolved.id } : resolved;
	};
	// Container aliases are transparent too. Hash finite child identities rather
	// than unfolding their targets, which can create an exponentially large type.
	const identities = new Map(), shapes = new Map();
	const identity = ref => {
		const root = reference(ref), key = canonicalJson(root);
		if(identities.has(key)) return identities.get(key);
		const stack = [{ ref: root, done: false }];
		while(stack.length)
		{
			const entry = stack.pop(), value = reference(entry.ref), key = canonicalJson(value);
			if(identities.has(key)) continue;
			if(value.kind !== "apply")
			{ identities.set(key, key); continue; }
			if(!entry.done)
			{
				stack.push({ ref: value, done: true });
				for(const child of value.arguments) stack.push({ ref: child, done: false });
				continue;
			}
			const shape = canonicalJson({ constructor: value.constructor, arguments: value.arguments.map(child => identities.get(canonicalJson(reference(child)))) });
			const id = `apply:${sha256(shape)}`;
			if(shapes.has(id) && shapes.get(id) !== shape) fail("structural type identity collision");
			shapes.set(id, shape); identities.set(key, id);
		}
		return identities.get(key);
	};
	const add = ref => {
		const normalized = reference(ref), id = identity(normalized);
		if(nodes.has(id)) return id;
		const definition = resolve(normalized), kind = definition.kind === "apply" ? definition.constructor : definition.kind;
		const aggregate = kind !== "primitive" || !scalars[definition.name];
		let name;
		if(kind === "primitive") name = scalars[definition.name] ?? `${prefix}_scalar_${definition.name}_t`;
		else if(normalized.kind === "named")
		{
			const source = sourceNames.get(normalized.id), member = cIdentifier(source);
			if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(source) || !safe(member)) fail(`invalid nominal name: ${source}`);
			name = `${prefix}_${member}_t`;
		}
		else name = `${prefix}_graph_${sha256(id).slice(0, 20)}_t`;
		if(aggregate) for(const value of [name, `${name}_init`, `${name}_clear`, ...kind === "variant" ? [`${name}_tag`] : []]) claim(value, id);
		const node = { id, ref: normalized, name, kind, aggregate, fields: [], cases: [], element: null };
		nodes.set(id, node); pending.push({ node, definition });
		return id;
	};
	const roots = ir.declarations.map(declaration => {
		return { bindingId: declaration.id, name: functionNames.get(declaration.id)
			, parameters: declaration.parameters.map(site => add(checkedRoot(site.type)))
			, result: add(checkedRoot(declaration.result.type)) };
	});
	if(!roots.length) fail("empty export set");
	const aliases = [];
	for(const definition of graph.types)
	{
		const target = add({ kind: "named", id: definition.id });
		if(definition.kind !== "alias") continue;
		const source = sourceNames.get(definition.id), member = cIdentifier(source);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(source) || !safe(member)) fail(`invalid alias name: ${source}`);
		const name = `${prefix}_${member}_t`;
		for(const value of [name, `${name}_init`, `${name}_clear`]) claim(value, definition.id);
		aliases.push({ id: definition.id, name, target });
	}
	const fields = (values, variant = false) => {
		const seen = new Set();
		return values.map(field => {
			const name = (variant ? cVariantIdentifier : cRecordIdentifier)(field.name);
			if(!safe(name) || seen.has(name)) fail(`invalid or duplicate C field: ${field.name}`);
			seen.add(name);
			return { sourceName: field.name, name, type: add(field.type), storage: "value" };
		});
	};
	while(pending.length)
	{
		const { node, definition } = pending.pop();
		if(node.kind === "record") node.fields = fields(definition.fields);
		else if(node.kind === "variant")
		{
			const seen = new Set();
			node.cases = definition.cases.map(branch => {
				const name = cVariantIdentifier(branch.name), tag = cVariantTag(node.name, branch.name);
				if(!safe(name) || seen.has(name)) fail(`invalid or duplicate C constructor: ${branch.name}`);
				seen.add(name); claim(tag, `${node.id}:${name}`);
				return { sourceName: branch.name, name, tag, fields: fields(branch.fields, true) };
			});
		}
		else if(["array", "list"].includes(node.kind)) node.element = add(definition.arguments[0]);
		else if(["option", "result", "tuple"].includes(node.kind)) node.fields = fields(definition.arguments.map((type, index) => ({
			name: { option: ["value"], result: ["ok", "error"], tuple: ["fst", "snd"] }[node.kind][index]
			, type
		})));
	}
	const ids = [...nodes.keys()].sort();
	const members = id => { const node = nodes.get(id); return [...node.fields, ...node.cases.flatMap(branch => branch.fields)]; };
	const inline = id => members(id).filter(field => nodes.get(field.type).aggregate).map(field => field.type);
	const { membership, groups } = components(ids, inline);
	for(const id of ids) for(const field of members(id))
		if(nodes.get(field.type).aggregate && membership.get(id) === membership.get(field.type)) field.storage = "pointer";
	// Iterative postorder over the now-acyclic by-value dependency graph.
	const emitted = new Set(), order = [];
	for(const id of ids)
	{
		const stack = [{ id, done: false }];
		while(stack.length)
		{
			const entry = stack.pop();
			if(emitted.has(entry.id)) continue;
			if(entry.done)
			{ emitted.add(entry.id); order.push(entry.id); continue; }
			stack.push({ id: entry.id, done: true });
			for(const field of members(entry.id).filter(field => field.storage === "value"))
				if(!emitted.has(field.type)) stack.push({ id: field.type, done: false });
		}
	}
	// Acyclic sharing can also expand an inline C object exponentially. Bound
	// each branch's embedded value count; primitive fields stay directly typed.
	// This changes layout only, never the allowed runtime value depth or size.
	const weights = new Map();
	for(const id of order)
	{
		const node = nodes.get(id), branches = node.kind === "variant" ? node.cases.map(branch => branch.fields) : [node.fields];
		let weight = 1;
		for(const branch of branches)
		{
			let branchWeight = 1;
			for(const [index, field] of branch.entries())
			{
				const child = nodes.get(field.type), childWeight = weights.get(field.type);
				const limit = Math.max(inlineValueLimit, 1 + branch.length);
				if(field.storage === "value" && child.aggregate && branchWeight + childWeight + branch.length - index - 1 > limit) field.storage = "pointer";
				branchWeight += field.storage === "pointer" ? 1 : childWeight;
			}
			weight = Math.max(weight, branchWeight);
		}
		weights.set(id, weight);
	}
	return freeze({ schemaVersion: 1, prefix, roots, aliases, inlineValueLimit
		, nodes: ids.map(id => nodes.get(id)), order
		, boxedGroups: groups.filter(group => group.length > 1 || inline(group[0]).includes(group[0])) });
};

/**
 * Emit typed declarations for native graph adapter development. Inputs borrow
 * their buffers. A completed output owns one arena at its root; nested values
 * borrow from that arena. Clearing a root never follows its tags or children.
 * This header alone neither loads Lean nor supplies callable exports.
 *
 * @param ir - Pure copied Binding IR accepted by the finite layout planner.
 */
export const generateCopiedCGraphTypes = ir => {
	const layout = compileCopiedCGraphLayout(ir), table = new Map(layout.nodes.map(node => [node.id, node]));
	const guard = `${layout.prefix.toUpperCase()}_COPIED_GRAPH_H`;
	const lines = [`#ifndef ${guard}`, `#define ${guard}`, "#include <stdbool.h>", "#include <stddef.h>", "#include <stdint.h>", "#include <string.h>", ""];
	for(const node of layout.nodes.filter(node => node.aggregate)) lines.push(`typedef struct ${node.name} ${node.name};`);
	const field = (item, indent) => `${indent}${item.storage === "pointer" ? "const " : ""}${table.get(item.type).name}${item.storage === "pointer" ? " *" : " "}${item.name};`;
	for(const id of layout.order)
	{
		const node = table.get(id), name = node.name;
		if(!node.aggregate) continue;
		if(node.kind === "variant") lines.push(`typedef enum ${name}_tag { ${node.cases.map((branch, index) => `${branch.tag} = ${index}`).join(", ")} } ${name}_tag;`);
		lines.push(`struct ${name} {`, "  void *_bridge_owner;", "  void (*_bridge_release)(void *owner);");
		if(node.kind === "primitive" || node.element)
		{
			const element = node.element ? table.get(node.element).name : node.ref.name === "string" ? "char" : node.ref.name === "bytes" ? "uint8_t" : "uint32_t";
			lines.push(`  const ${element} *data;`, "  size_t length;");
			if(node.ref.name === "int") lines.push("  bool negative;");
		}
		else if(node.kind === "variant")
		{
			lines.push("  uint32_t kind;", "  union {");
			for(const branch of node.cases)
			{
				lines.push("    struct {");
				if(!branch.fields.length) lines.push("      uint8_t empty;");
				lines.push(...branch.fields.map(item => field(item, "      ")), `    } ${branch.name};`);
			}
			lines.push("  } cases;");
		}
		else
		{
			if(node.kind === "option") lines.push("  uint8_t has_value;");
			if(node.kind === "result") lines.push("  uint8_t is_ok;");
			lines.push(...node.fields.map(item => field(item, "  ")));
		}
		lines.push("};", `static inline void ${name}_init(${name} *value) {`
			, "  if (!value) return;", "  memset(value, 0, sizeof(*value));"
			, ...node.kind === "variant" ? ["  value->kind = UINT32_MAX;"] : [], "}"
			, `static inline void ${name}_clear(${name} *value) {`, "  if (!value) return;"
			, "  void *owner = value->_bridge_owner;", "  void (*release)(void *) = value->_bridge_release;"
			, `  ${name}_init(value);`, "  if (owner && release) release(owner);", "}", "");
	}
	for(const alias of layout.aliases)
	{
		const target = table.get(alias.target);
		lines.push(`typedef ${target.name} ${alias.name};`);
		if(target.aggregate) lines.push(`static inline void ${alias.name}_init(${alias.name} *value) { ${target.name}_init(value); }`
			, `static inline void ${alias.name}_clear(${alias.name} *value) { ${target.name}_clear(value); }`);
	}
	lines.push("", `#endif /* ${guard} */`, "");
	return { layout, header: lines.join("\n") };
};
