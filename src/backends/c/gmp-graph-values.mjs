/**
 * Finite C/GMP value declarations for recursive copied graphs.
 * Root cleanup receives the current root address, so inline GMP fields can move
 * with an owning value without leaving its private finalizers pointing at a
 * temporary conversion frame. Package admission remains separate.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "./copied-graph-layout.mjs";

/**
 * Generate native C values with exact GMP integers and root-owned cleanup.
 * Input pointers and spans borrow their children. Initialized inline values are
 * owned by the enclosing value; constructors must be changed with select.
 *
 * @param ir - Validated copied Binding IR.
 */
export const generateCopiedGmpGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), p = layout.prefix;
	const types = layout.nodes.map(node => ({ ...node
		, name: node.aggregate ? node.name.replace(`${p}_`, `${p}_gmp_`) : node.name
		, integer: node.kind === "primitive" && ["nat", "int"].includes(node.ref.name) }));
	const table = new Map(types.map(node => [node.id, node]));
	const aliases = layout.aliases.map(alias => ({ ...alias, name: alias.name.replace(`${p}_`, `${p}_gmp_`) }));
	// The implementation includes both headers. A nominal GmpFoo in the raw
	// graph must not collide with Foo's public GMP representation or helpers.
	const names = new Set(layout.nodes.filter(node => node.aggregate).flatMap(node => [node.name
		, `${node.name}_init`, `${node.name}_clear`
		, ...node.kind === "variant" ? [`${node.name}_tag`, ...node.cases.map(branch => branch.tag)] : []]));
	for(const alias of layout.aliases) for(const name of [alias.name, `${alias.name}_init`, `${alias.name}_clear`]) names.add(name);
	const claim = name => {
		if(names.has(name)) throw new TypeError(`Invalid C/GMP graph identifier collision: ${name}`);
		names.add(name);
	};
	for(const node of types.filter(node => node.aggregate))
	{
		for(const name of [node.name, `${node.name}_init`, `${node.name}_clear`]) claim(name);
		if(!node.integer)
		{ claim(`${node.name}_dispose`); claim(`${node.name}_destroy_inline`); }
		if(node.kind === "variant") for(const name of [`${node.name}_tag`, `${node.name}_select`, ...node.cases.map(branch => branch.tag.replace(`${p.toUpperCase()}_`, `${p.toUpperCase()}_GMP_`))]) claim(name);
	}
	for(const alias of aliases)
	{
		claim(alias.name);
		if(table.get(alias.target).aggregate)
		{ claim(`${alias.name}_init`); claim(`${alias.name}_clear`); }
	}
	const guard = `${p.toUpperCase()}_GMP_GRAPH_VALUES_H`;
	const lines = [`#ifndef ${guard}`, `#define ${guard}`
		, "#include <gmp.h>", "#include <stdbool.h>", "#include <stdint.h>"
		, "#include <stddef.h>", "#include <string.h>", ""
		, "/* Inputs borrow pointer/span children. Owning results must not be"
		, "   shallow-copied and cleared twice. The two _bridge fields are private."
		, "   Clear/select the root of an owned result, never a borrowed child."
		, "   Do not overwrite initialized GMP storage or inactive branch fields. */"];
	for(const node of types)
	{
		if(node.integer) lines.push(`typedef mpz_t ${node.name};`);
		else if(node.aggregate) lines.push(`typedef struct ${node.name} ${node.name};`);
	}
	const field = (item, indent) => `${indent}${item.storage === "pointer" ? "const " : ""}${table.get(item.type).name}${item.storage === "pointer" ? " *" : " "}${item.name};`;
	const address = (child, expression) => child.integer ? expression : `&${expression}`;
	for(const id of layout.order)
	{
		const node = table.get(id), name = node.name;
		if(node.integer)
		{
			lines.push(`static inline void ${name}_init(mpz_ptr value) { if (value) mpz_init(value); }`
				, `static inline void ${name}_clear(mpz_ptr value) { if (value) { mpz_clear(value); mpz_init(value); } }`);
			continue;
		}
		if(!node.aggregate) continue;
		if(node.kind === "variant") lines.push(`typedef enum ${name}_tag { ${node.cases.map((branch, index) => `${branch.tag.replace(`${p.toUpperCase()}_`, `${p.toUpperCase()}_GMP_`)} = ${index}`).join(", ")} } ${name}_tag;`);
		lines.push(`struct ${name} {`, "  void *_bridge_owner;"
			, "  void (*_bridge_release)(void *owner, void *root);");
		if(node.kind === "primitive" || node.element)
		{
			const element = node.element ? table.get(node.element).name : node.ref.name === "string" ? "char" : "uint8_t";
			lines.push(`  const ${element} *data;`, "  size_t length;");
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
		lines.push("};");
		const direct = items => items.filter(item => item.storage === "value" && table.get(item.type).aggregate);
		const initialize = (items, prefix) => direct(items).map(item => {
			const child = table.get(item.type);
			return `${child.name}_init(${address(child, `${prefix}${item.name}`)});`;
		});
		const destroy = (items, prefix) => direct(items).map(item => {
			const child = table.get(item.type), pointer = address(child, `${prefix}${item.name}`);
			return child.integer ? `mpz_clear(${pointer});` : `${child.name}_dispose(${pointer});`;
		});
		lines.push(`static inline void ${name}_init(${name} *value) {`, "  if (!value) return;"
			, "  memset(value, 0, sizeof(*value));"
			, ...node.kind === "variant" ? ["  value->kind = UINT32_MAX;"] : initialize(node.fields, "value->").map(line => `  ${line}`), "}");
		// This helper clears only caller-owned inline fields. Borrowed pointers,
		// spans and inactive variant storage must never be traversed or freed.
		lines.push(`static inline void ${name}_destroy_inline(${name} *value) {`, "  (void)value;");
		if(node.kind === "variant")
		{
			lines.push("  switch (value->kind) {");
			node.cases.forEach((branch, index) => lines.push(`  case ${index}:`
				, ...destroy(branch.fields, `value->cases.${branch.name}.`).map(line => `    ${line}`), "    break;"));
			lines.push("  default: break;", "  }");
		}
		else lines.push(...destroy(node.fields, "value->").map(line => `  ${line}`));
		lines.push("}", `static inline void ${name}_dispose(${name} *value) {`, "  if (!value) return;"
			, "  if (value->_bridge_owner && value->_bridge_release) value->_bridge_release(value->_bridge_owner, value);"
			, `  else ${name}_destroy_inline(value);`, "}"
			, `static inline void ${name}_clear(${name} *value) {`, "  if (!value) return;"
			, `  ${name}_dispose(value);`, `  ${name}_init(value);`, "}");
		if(node.kind === "variant")
		{
			lines.push(`static inline int ${name}_select(${name} *value, ${name}_tag kind) {`
				, `  if (!value || (uint32_t)kind >= ${node.cases.length}) return 0;`
				, `  ${name}_clear(value);`, "  value->kind = (uint32_t)kind;", "  switch (kind) {");
			node.cases.forEach((branch, index) => lines.push(`  case ${index}:`
				, ...initialize(branch.fields, `value->cases.${branch.name}.`).map(line => `    ${line}`), "    break;"));
			lines.push("  default: break;", "  }", "  return 1;", "}");
		}
		lines.push("");
	}
	for(const alias of aliases)
	{
		const target = table.get(alias.target), pointer = target.integer ? "mpz_ptr " : `${alias.name} *`;
		lines.push(`typedef ${target.name} ${alias.name};`);
		if(target.aggregate) lines.push(`static inline void ${alias.name}_init(${pointer}value) { ${target.name}_init(value); }`
			, `static inline void ${alias.name}_clear(${pointer}value) { ${target.name}_clear(value); }`);
	}
	lines.push("", `#endif /* ${guard} */`, "");
	// Copy the planned layout so host spelling and ownership do not mutate the
	// raw C graph ABI shared with C++, Rust and other language adapters.
	return { layout, types, aliases, header: lines.join("\n") };
};
