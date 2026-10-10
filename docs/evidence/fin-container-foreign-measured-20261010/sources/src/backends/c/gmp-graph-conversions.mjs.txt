/**
 * Bounded C/GMP conversion for finite copied graphs. Root-relative finalizers
 * preserve exact integers when the owning result moves to caller storage.
 *
 * @file
 */
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { generateCopiedGmpGraphValues } from "./gmp-graph-values.mjs";

const support = `#ifndef LEAN_BRIDGE_GMP_GRAPH_CONVERSIONS_SUPPORT_H
#define LEAN_BRIDGE_GMP_GRAPH_CONVERSIONS_SUPPORT_H
#include <stdlib.h>
#include <limits.h>
_Static_assert(sizeof(size_t) == 8 && sizeof(void *) == 8 && sizeof(bool) == 1 && CHAR_BIT == 8, "Native graph conversion requires the verified 64-bit byte ABI");
#ifndef LB_GMP_GRAPH_MALLOC
#define LB_GMP_GRAPH_MALLOC malloc
#endif
#ifndef LB_GMP_GRAPH_FREE
#define LB_GMP_GRAPH_FREE free
#endif
typedef struct {
  size_t nodes, native_bytes, storage_bytes;
  struct { const void *address; size_t type; } path[${componentRecursiveLimits.valueDepth + 1}];
} lb_gg_budget;
typedef struct lb_gg_allocation {
  struct lb_gg_allocation *next;
  unsigned int kind;
  union { size_t offset; mpz_ptr integer; } finalizer;
  max_align_t alignment;
  unsigned char data[];
} lb_gg_allocation;
typedef struct {
  lb_gg_allocation *head;
  lb_gg_budget *budget;
  void *root;
  size_t root_size;
} lb_gg_arena;
static inline uint32_t lb_gg_charge(size_t *budget, size_t count, size_t width) {
  if (!width || count > *budget / width) return 2;
  *budget -= count * width; return 0;
}
static inline int lb_gg_pointer(const void *pointer, size_t bytes, size_t alignment) {
  return pointer && (uintptr_t)pointer % alignment == 0 && bytes <= UINTPTR_MAX - (uintptr_t)pointer;
}
static inline int lb_gg_span(const void *pointer, size_t count, size_t width, size_t alignment) {
  return !count || (count <= SIZE_MAX / width && lb_gg_pointer(pointer, count * width, alignment));
}
static inline uint32_t lb_gg_enter(const void *value, size_t type, size_t depth, uint32_t invalid, lb_gg_budget *budget) {
  if (depth > ${componentRecursiveLimits.valueDepth} || !budget->nodes) return 2;
  for (size_t i = 0; i < depth; ++i)
    if (budget->path[i].address == value && budget->path[i].type == type) return invalid;
  budget->path[depth].address = value; budget->path[depth].type = type;
  --budget->nodes; return 0;
}
static inline uint32_t lb_gg_block(lb_gg_arena *arena, size_t count, size_t width, lb_gg_allocation **out) {
  uint32_t status = lb_gg_charge(&arena->budget->storage_bytes, count, width);
  if (!status) status = lb_gg_charge(&arena->budget->storage_bytes, 1, sizeof(lb_gg_allocation));
  if (status) return status;
  lb_gg_allocation *allocation = LB_GMP_GRAPH_MALLOC(sizeof(*allocation) + count * width);
  if (!allocation) return 3;
  memset(allocation, 0, sizeof(*allocation) + count * width);
  allocation->next = arena->head; arena->head = allocation; *out = allocation; return 0;
}
static inline uint32_t lb_gg_allocate(lb_gg_arena *arena, size_t count, size_t width, void **out) {
  *out = NULL;
  if (!count) return 0;
  lb_gg_allocation *allocation;
  uint32_t status = lb_gg_block(arena, count, width, &allocation);
  if (!status) *out = allocation->data;
  return status;
}
static inline uint32_t lb_gg_track_integer(lb_gg_arena *arena, mpz_ptr integer) {
  lb_gg_allocation *allocation;
  uint32_t status = lb_gg_block(arena, 0, 1, &allocation);
  if (status) return status;
  uintptr_t root = (uintptr_t)arena->root, target = (uintptr_t)integer;
  if (target >= root && target - root <= arena->root_size && sizeof(*integer) <= arena->root_size - (target - root)) {
    allocation->kind = 1; allocation->finalizer.offset = target - root;
  } else { allocation->kind = 2; allocation->finalizer.integer = integer; }
  return 0;
}
static inline void lb_gg_release(void *owner, void *root) {
  lb_gg_allocation *allocation = owner;
  while (allocation) {
    lb_gg_allocation *next = allocation->next;
    if (allocation->kind == 1) mpz_clear((mpz_ptr)((unsigned char *)root + allocation->finalizer.offset));
    else if (allocation->kind == 2) mpz_clear(allocation->finalizer.integer);
    LB_GMP_GRAPH_FREE(allocation); allocation = next;
  }
}
static inline int lb_gg_utf8(const char *text, size_t length) {
  const uint8_t *data = (const uint8_t *)text; size_t i = 0;
  while (i < length) {
    uint32_t point = data[i++], minimum; size_t extra;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; extra = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; extra = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; extra = 3; minimum = 0x10000; }
    else return 0;
    if (extra > length - i) return 0;
    while (extra--) { uint8_t next = data[i++]; if ((next & 0xc0) != 0x80) return 0; point = (point << 6) | (next & 0x3f); }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return 0;
  }
  return 1;
}
#endif
`;

/**
 * Generate private typed calls around a verified native graph function.
 * Validate every argument before constructing any native view. Copy successful
 * output into independent ownership and leave initialized output unchanged on
 * failure. GMP's default fatal allocator policy is not replaced by this API.
 *
 * @param ir - Compiler-checked copied Binding IR.
 * @param options - Optional production runtime readiness/retirement policy.
 * @param options.lifecycle - Guard output publication and retire malformed native results.
 */
export const generateCopiedGmpGraphConversions = (ir, { lifecycle = false } = {}) => {
	const values = generateCopiedGmpGraphValues(ir), { layout } = values;
	const hosts = new Map(values.types.map(node => [node.id, node]));
	const nodes = new Map(layout.nodes.map((node, index) => [node.id, { ...node, index, host: hosts.get(node.id) }]));
	const prefix = `${layout.prefix}_gg`, walker = node => `${prefix}_${node.index}`;
	const declarations = [], functions = [], calls = [];
	const hostInput = node => node.host.integer ? "mpz_srcptr" : `const ${node.host.name} *`;
	const hostOutput = node => node.host.integer ? "mpz_ptr" : `${node.host.name} *`;
	const hostAddress = (node, value) => node.host.integer ? value : `&${value}`;
	const fieldAddress = (field, value, host) => field.storage === "pointer"
		? host && nodes.get(field.type).host.integer ? `(mpz_srcptr)${value}` : value
		: host ? hostAddress(nodes.get(field.type), value) : `&${value}`;
	const finite = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			if(finite.has(node.id)) continue;
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabitable = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabitable)
			{ finite.add(node.id); changed = true; }
		}
	}
	for(const node of nodes.values()) declarations.push(
		`static inline uint32_t ${walker(node)}_check(${hostInput(node)}, size_t, int, lb_gg_budget *);`
		, `static inline uint32_t ${walker(node)}_to(${hostInput(node)}, ${node.name} *, lb_gg_arena *);`
		, `static inline uint32_t ${walker(node)}_from(const ${node.name} *, ${hostOutput(node)}, size_t, int, lb_gg_arena *);`
	);
	for(const node of nodes.values())
	{
		const raw = node.name, host = node.host.name, id = walker(node);
		const check = [
			`if (!lb_gg_pointer(value, sizeof(${host}), _Alignof(${host}))) return 1;`
			, `uint32_t status = lb_gg_enter(value, ${node.index}, depth, 1, budget);`
			, `if (!status && storage) status = lb_gg_charge(&budget->native_bytes, 1, sizeof(${raw}));`
			, "if (status) return status;"
		];
		const to = ["(void)value; (void)out; (void)arena; uint32_t status = 0; (void)status;"];
		const from = [
			`if (!lb_gg_pointer(value, sizeof(*value), _Alignof(${raw}))) return 4;`
			, `uint32_t status = lb_gg_enter(value, ${node.index}, depth, 4, arena->budget);`
			, "if (!status && storage) status = lb_gg_charge(&arena->budget->native_bytes, 1, sizeof(*value));"
			, "if (status) return status;", "(void)out;"
			, ...node.aggregate ? [`${host}_init(out);`] : []
		];
		const checkField = (field, slot) => `if ((status = ${walker(nodes.get(field.type))}_check(${fieldAddress(field, slot, true)}, depth + 1, ${field.storage === "pointer" ? 1 : 0}, budget))) return status;`;
		const convertField = (field, slot, direction) => {
			const child = nodes.get(field.type), boxed = field.storage === "pointer", into = direction === "to";
			const target = boxed ? "data" : into ? `&out->${slot}` : hostAddress(child, `out->${slot}`);
			const lines = ["{"];
			if(boxed) lines.push("  void *data;"
				, `  if ((status = lb_gg_allocate(arena, 1, sizeof(${into ? child.name : child.host.name}), &data))) return status;`
				, `  out->${slot} = data;`);
			lines.push(`  if ((status = ${walker(child)}_${direction}(${fieldAddress(field, `value->${slot}`, into)}, ${target}${into ? "" : `, depth + 1, ${boxed ? 1 : 0}`}, arena))) return status;`, "}");
			return lines;
		};
		if(!finite.has(node.id))
		{ check.push("return 1;"); to.push("return 1;"); from.push("return 4;"); }
		else if(node.kind === "primitive")
		{
			const scalar = node.ref.name;
			if(node.host.integer)
			{
				if(scalar === "nat") check.push("if (mpz_sgn(value) < 0) return 1;");
				check.push("if (mpz_size(value) > budget->native_bytes / sizeof(mp_limb_t) + 1) return 2;"
					, "size_t count = mpz_sgn(value) ? (mpz_sizeinbase(value, 2) - 1) / 32 + 1 : 0;"
					, "if ((status = lb_gg_charge(&budget->native_bytes, count, sizeof(uint32_t)))) return status;");
				to.push("size_t count = mpz_sgn(value) ? (mpz_sizeinbase(value, 2) - 1) / 32 + 1 : 0; void *data;"
					, "if ((status = lb_gg_allocate(arena, count, sizeof(uint32_t), &data))) return status;"
					, "if (count) mpz_export(data, &count, -1, sizeof(uint32_t), 0, 0, value);"
					, "out->data = data; out->length = count;", ...scalar === "int" ? ["out->negative = mpz_sgn(value) < 0;"] : []);
				from.push("if ((status = lb_gg_charge(&arena->budget->native_bytes, value->length, sizeof(uint32_t)))) return status;"
					, "if (!lb_gg_span(value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t))) return 4;"
					, ...scalar === "int" ? ["uint8_t negative; memcpy(&negative, &value->negative, 1); if (negative > 1) return 4;"] : []
					, "size_t bits = value->length * 32, limbs = bits / GMP_NUMB_BITS + (bits % GMP_NUMB_BITS != 0);"
					, "if ((status = lb_gg_charge(&arena->budget->storage_bytes, limbs, sizeof(mp_limb_t)))) return status;"
					, "if ((status = lb_gg_track_integer(arena, out))) return status;"
					, "if (value->length) mpz_import(out, value->length, -1, sizeof(uint32_t), 0, 0, value->data);"
					, ...scalar === "int" ? ["if (negative) mpz_neg(out, out);"] : []);
			}
			else if(["string", "bytes"].includes(scalar))
			{
				check.push("if ((status = lb_gg_charge(&budget->native_bytes, value->length, 1))) return status;"
					, "if (!lb_gg_span(value->data, value->length, 1, 1)) return 1;"
					, ...scalar === "string" ? ["if (!lb_gg_utf8(value->data, value->length)) return 1;"] : []);
				to.push("out->data = value->data; out->length = value->length;");
				from.push("if ((status = lb_gg_charge(&arena->budget->native_bytes, value->length, 1))) return status;"
					, "if (!lb_gg_span(value->data, value->length, 1, 1)) return 4;"
					, ...scalar === "string" ? ["if (!lb_gg_utf8(value->data, value->length)) return 4;"] : []
					, "void *data; if ((status = lb_gg_allocate(arena, value->length, 1, &data))) return status;"
					, "if (value->length) memcpy(data, value->data, value->length);", "out->data = data; out->length = value->length;");
			}
			else
			{
				const validate = invalid => scalar === "unit" ? [`if (*value) return ${invalid};`]
					: scalar === "bool" ? [`uint8_t bits; memcpy(&bits, value, 1); if (bits > 1) return ${invalid};`]
						: scalar === "char" ? [`if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return ${invalid};`] : [];
				check.push(...validate(1)); from.push(...validate(4), "*out = *value;"); to.push("*out = *value;");
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element), c = walker(child);
			check.push("if (value->length > budget->nodes) return 2;"
				, `if ((status = lb_gg_charge(&budget->native_bytes, value->length, sizeof(${child.name})))) return status;`
				, `if (!lb_gg_span(value->data, value->length, sizeof(${child.host.name}), _Alignof(${child.host.name}))) return 1;`
				, `for (size_t i = 0; i < value->length; ++i) if ((status = ${c}_check(${hostAddress(child, "value->data[i]")}, depth + 1, 0, budget))) return status;`);
			to.push("void *data;", `if ((status = lb_gg_allocate(arena, value->length, sizeof(${child.name}), &data))) return status;`
				, `${child.name} *items = data; out->data = data; out->length = value->length;`
				, `for (size_t i = 0; i < value->length; ++i) if ((status = ${c}_to(${hostAddress(child, "value->data[i]")}, items + i, arena))) return status;`);
			from.push("if (value->length > arena->budget->nodes) return 2;"
				, `if ((status = lb_gg_charge(&arena->budget->native_bytes, value->length, sizeof(${child.name})))) return status;`
				, `if (!lb_gg_span(value->data, value->length, sizeof(${child.name}), _Alignof(${child.name}))) return 4;`
				, "void *data;", `if ((status = lb_gg_allocate(arena, value->length, sizeof(${child.host.name}), &data))) return status;`
				, `${child.host.name} *items = data; out->data = data; out->length = value->length;`
				, `for (size_t i = 0; i < value->length; ++i) if ((status = ${c}_from(value->data + i, ${hostAddress(child, "items[i]")}, depth + 1, 0, arena))) return status;`);
		}
		else if(node.kind === "variant")
		{
			check.push("switch (value->kind) {");
			to.push("out->kind = value->kind;", "switch (value->kind) {");
			from.push(`if (!${host}_select(out, (${host}_tag)value->kind)) return 4;`, "switch (value->kind) {");
			node.cases.forEach((branch, index) => {
				for(const lines of [check, to, from]) lines.push(`case ${index}:`);
				for(const field of branch.fields)
				{
					const slot = `cases.${branch.name}.${field.name}`;
					check.push(checkField(field, `value->${slot}`));
					to.push(...convertField(field, slot, "to")); from.push(...convertField(field, slot, "from"));
				}
				for(const lines of [check, to, from]) lines.push("break;");
			});
			check.push("default: return 1;", "}"); to.push("default: return 1;", "}"); from.push("default: return 4;", "}");
		}
		else
		{
			const flag = { option: "has_value", result: "is_ok" }[node.kind];
			if(flag)
			{
				check.push(`if (value->${flag} > 1) return 1;`); to.push(`out->${flag} = value->${flag};`);
				from.push(`if (value->${flag} > 1) return 4;`, `out->${flag} = value->${flag};`);
			}
			node.fields.forEach((field, index) => {
				if(flag) for(const lines of [check, to, from]) lines.push(`if (${index ? "!" : ""}value->${flag}) {`);
				check.push(checkField(field, `value->${field.name}`));
				to.push(...convertField(field, field.name, "to")); from.push(...convertField(field, field.name, "from"));
				if(flag) for(const lines of [check, to, from]) lines.push("}");
			});
		}
		for(const [suffix, body, signature] of [
			["check", check, `${hostInput(node)} value, size_t depth, int storage, lb_gg_budget *budget`]
			, ["to", to, `${hostInput(node)} value, ${raw} *out, lb_gg_arena *arena`]
			, ["from", from, `const ${raw} *value, ${hostOutput(node)} out, size_t depth, int storage, lb_gg_arena *arena`]
		]) functions.push(`static inline uint32_t ${id}_${suffix}(${signature}) {`, ...body.map(line => `  ${line}`), "  return 0;", "}");
	}
	for(const root of layout.roots)
	{
		const result = nodes.get(root.result), params = root.parameters.map(id => nodes.get(id));
		const pointer = hostAddress(result, "result"), functionArgs = [...params.map(node => `const ${node.name} *`), `${result.name} *`].join(", ");
		calls.push(`static inline uint32_t ${root.name}_gmp_graph(uint32_t (*invoke)(${functionArgs})${params.map((node, i) => `, ${hostInput(node)} a${i}`).join("")}, ${hostOutput(result)} out) {`
			, `  if (!invoke || !lb_gg_pointer(out, sizeof(${result.host.name}), _Alignof(${result.host.name}))) return 1;`
			, `  lb_gg_budget budget = { .nodes = ${componentRecursiveLimits.valueNodes}, .native_bytes = 16u * 1024u * 1024u, .storage_bytes = 16u * 1024u * 1024u, .path = {{0}} };`
			, "  uint32_t status;"
			, ...params.map((node, i) => `  if ((status = ${walker(node)}_check(a${i}, 0, 1, &budget))) return status;`)
			, `  ${result.host.name} result;`
			, ...result.aggregate ? [`  ${result.host.name}_init(${pointer});`] : ["  memset(&result, 0, sizeof(result));"]
			, "  lb_gg_arena views = { .head = NULL, .budget = &budget, .root = NULL, .root_size = 0 };"
			, "  lb_gg_arena owned = { .head = NULL, .budget = &budget, .root = &result, .root_size = sizeof(result) };"
			, `  ${result.name} native = {0};`
			, ...params.map((node, i) => `  ${node.name} view${i} = {0};`)
			, `  if ((status = lb_gg_charge(&budget.storage_bytes, 1, sizeof(result)${params.map((_, i) => ` + sizeof(view${i})`).join("")}))) goto done;`
			, ...params.map((node, i) => `  if ((status = ${walker(node)}_to(a${i}, &view${i}, &views))) goto done;`)
			, `  status = invoke(${[...params.map((_, i) => `&view${i}`), "&native"].join(", ")});`
			, `  if (!status) status = ${walker(result)}_from(&native, ${pointer}, 0, 1, &owned);`
			, ...lifecycle ? ["  if (status == 4) lean_bridge_native_runtime_retire();"
				, `  if (!status && !lean_bridge_native_component_ready(${JSON.stringify(ir.component.id)})) status = 5;`] : []
			, "done:"
			, ...result.aggregate ? [`  ${result.name}_clear(&native);`] : []
			, "  lb_gg_release(views.head, NULL);"
			, "  if (status) { lb_gg_release(owned.head, &result); return status; }"
			, ...result.host.integer ? ["  mpz_swap(out, result); lb_gg_release(owned.head, &result);"]
				: result.aggregate ? [`  ${result.host.name}_clear(out);`
					, "  result._bridge_owner = owned.head; result._bridge_release = owned.head ? lb_gg_release : NULL;"
					, "  *out = result;"]
					: ["  *out = result;"]
			, "  return 0;", "}");
	}
	const header = ["#pragma once"
		, `#include "${layout.prefix}-gmp-graph-values.h"`
		, `#include "${layout.prefix}-graph-types.h"`
		, ...lifecycle ? ['#include "lean_bridge_native_runtime.h"'
			, "#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1"
			, '#error "GMP graph calls require the retirement-aware shared runtime"'
			, "#endif"] : []
		, support, ...declarations, ...functions, ...calls, ""].join("\n");
	return { ...values, header, valuesHeader: values.header };
};
