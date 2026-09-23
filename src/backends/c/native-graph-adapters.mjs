/**
 * Bounded native conversion for finite copied graphs and total Lean carriers.
 * This transport is staged independently of native package admission.
 *
 * @file
 */
import { sha256 } from "../../capsule/node.mjs";
import { assertComponentRecursiveBindings } from "../../abi/component-recursive-abi.mjs";
import { componentRecursiveLimits } from "../../abi/component-recursive.mjs";
import { componentRecursiveHelper } from "../../build/component-recursive-lean.mjs";
import { generateCopiedCGraphTypes } from "./copied-graph-layout.mjs";

const runtime = `
#include <lean/lean.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
_Static_assert(sizeof(size_t) == 8 && sizeof(void *) == 8, "native graph transport requires 64-bit Lean");
_Static_assert(sizeof(bool) == 1, "native graph transport requires byte Bool storage");
#ifndef LB_GRAPH_MALLOC
#define LB_GRAPH_MALLOC malloc
#endif
#ifndef LB_GRAPH_FREE
#define LB_GRAPH_FREE free
#endif
#ifndef LB_GRAPH_DECODE
#define LB_GRAPH_DECODE() ((void)0)
#endif
#ifndef LB_GRAPH_ENCODE
#define LB_GRAPH_ENCODE(value) (value)
#endif
enum { NG_OK = 0, NG_INVALID = 1, NG_LIMIT = 2, NG_ALLOC = 3, NG_RESULT = 4, NG_RUNTIME = 5 };
typedef struct {
  size_t bytes, nodes;
  struct { const void *address; size_t type; } path[${componentRecursiveLimits.valueDepth + 1}];
} ng_budget;
typedef struct ng_allocation {
  struct ng_allocation *next;
  max_align_t alignment;
  unsigned char data[];
} ng_allocation;
typedef struct { ng_allocation *head; ng_budget *budget; } ng_arena;
static void ng_release(void *owner) {
  ng_allocation *allocation = owner;
  while (allocation) {
    ng_allocation *next = allocation->next;
    LB_GRAPH_FREE(allocation); allocation = next;
  }
}
static inline uint32_t ng_charge(ng_budget *budget, size_t count, size_t width) {
  if (!width || count > budget->bytes / width) return NG_LIMIT;
  budget->bytes -= count * width; return NG_OK;
}
static inline int ng_pointer(const void *pointer, size_t bytes, size_t alignment) {
  return pointer && (uintptr_t)pointer % alignment == 0 && bytes <= UINTPTR_MAX - (uintptr_t)pointer;
}
static inline uint32_t ng_enter(const void *value, size_t type, size_t depth, ng_budget *budget) {
  if (depth > ${componentRecursiveLimits.valueDepth} || !budget->nodes) return NG_LIMIT;
  for (size_t i = 0; i < depth; ++i)
    if (budget->path[i].address == value && budget->path[i].type == type) return NG_INVALID;
  budget->path[depth].address = value; budget->path[depth].type = type;
  --budget->nodes; return NG_OK;
}
static inline uint32_t ng_allocate(ng_arena *arena, size_t count, size_t width, void **out) {
  *out = NULL;
  if (!count) return NG_OK;
  uint32_t status = ng_charge(arena->budget, count, width);
  if (!status) status = ng_charge(arena->budget, 1, sizeof(ng_allocation));
  if (status) return status;
  ng_allocation *allocation = LB_GRAPH_MALLOC(sizeof(*allocation) + count * width);
  if (!allocation) return NG_ALLOC;
  allocation->next = arena->head; arena->head = allocation;
  memset(allocation->data, 0, count * width); *out = allocation->data; return NG_OK;
}
static inline uint32_t ng_span(const void *data, size_t count, size_t width, size_t alignment, ng_budget *budget) {
  uint32_t status = ng_charge(budget, count, width);
  if (status) return status;
  return !count || ng_pointer(data, count * width, alignment) ? NG_OK : NG_INVALID;
}
static inline int ng_utf8(const uint8_t *data, size_t length) {
  size_t i = 0;
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
static inline lean_object *ng_nat_in(const uint32_t *data, size_t length) {
  lean_object *value = lean_box(0);
  while (length) {
    lean_object *shifted = lean_nat_shiftl(value, lean_box(32)); lean_dec(value);
    lean_object *limb = lean_uint32_to_nat(data[--length]);
    value = lean_nat_add(shifted, limb); lean_dec(shifted); lean_dec(limb);
  }
  return value;
}
/* Borrow value, allocate exactly the required limbs, and own every temporary. */
static inline uint32_t ng_nat_out(lean_object *value, ng_arena *arena, const uint32_t **data, size_t *length) {
  *data = NULL; *length = 0;
  if (lean_nat_eq(value, lean_box(0))) return NG_OK;
  lean_object *bits = lean_nat_log2(value);
  if (!lean_is_scalar(bits)) { lean_dec(bits); return NG_LIMIT; }
  size_t count = lean_unbox(bits) / 32 + 1; lean_dec(bits);
  void *raw; uint32_t status = ng_allocate(arena, count, sizeof(uint32_t), &raw);
  if (status) return status;
  uint32_t *limbs = raw; lean_inc(value);
  for (size_t i = 0; i < count; ++i) {
    limbs[i] = lean_uint32_of_nat(value);
    lean_object *next = lean_nat_shiftr(value, lean_box(32)); lean_dec(value); value = next;
  }
  lean_dec(value); *data = limbs; *length = count; return NG_OK;
}
`;

/**
 * Emit checked native walkers against an independently authenticated carrier
 * descriptor. The descriptor supplies Lean helper symbols, not Wasm frames.
 * Arguments must reference readable native objects; native C cannot establish
 * the accessibility of arbitrary process addresses.
 *
 * @param ir - Pure copied Binding IR.
 * @param abi - Matching total-carrier signatures and nominal graph.
 * @param options - Optional shared-runtime lifecycle for compiled components.
 * @param options.initializer - Verified component initializer, absent for isolated transport tests.
 */
export const generateNativeCopiedGraphAdapters = (ir, abi, { initializer = null } = {}) => {
	assertComponentRecursiveBindings(abi, ir);
	if(initializer !== null && (typeof initializer !== "string" || !/^initialize_LeanBridgeNative[0-9a-f]{16}$/.test(initializer))) throw new TypeError("Invalid native graph initializer identity");
	const { layout, header: typesHeader } = generateCopiedCGraphTypes(ir);
	const table = new Map(layout.nodes.map((node, index) => [node.id, { ...node, index }]));
	const walker = id => `ng_${sha256(id).slice(0, 20)}`;
	const helper = node => componentRecursiveHelper(abi, node.ref);
	const lines = [`#include "${layout.prefix}-graph.h"`, runtime];
	if(initializer) lines.push('#include "lean_bridge_native_runtime.h"'
		, '#if !defined(LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION) || LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION != 1'
		, '#error "native graph calls require the retirement-aware shared runtime"', "#endif"
		, `extern lean_object *${initializer}(uint8_t);`
		, `static void *ng_initialize(uint8_t builtin) { return ${initializer}(builtin); }`
		, `static int ng_ready(void) { return lean_bridge_native_component_ready(${JSON.stringify(ir.component.id)}); }`);
	const declarations = [];
	for(const node of table.values())
	{
		const id = walker(node.id), name = node.name;
		lines.push(`static inline uint32_t ${id}_check(const ${name} *, size_t, int, ng_budget *);`
			, `static inline lean_object *${id}_in(const ${name} *);`
			, `static inline uint32_t ${id}_out(${name} *, lean_object *, size_t, ng_arena *);`);
		if(node.kind === "primitive") continue;
		const symbol = helper(node);
		const make = (suffix, count) => lines.push(`extern lean_object *${symbol}_${suffix}(${Array(Math.max(1, count)).fill("lean_object *").join(", ")});`);
		const field = suffix => lines.push(`extern lean_object *${symbol}_${suffix}(lean_object *);`);
		if(node.kind === "variant")
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			node.cases.forEach((branch, index) => { make(`make${index}`, branch.fields.length); branch.fields.forEach((_, fieldIndex) => field(`case${index}_field${fieldIndex}`)); });
		}
		else if(["option", "result"].includes(node.kind))
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			if(node.kind === "option") make("none", 0);
			node.fields.forEach((_, index) => { make(`make${index}`, 1); field(`field${index}`); });
		}
		else if(node.element)
		{ make("make", 1); field("items"); }
		else
		{ make("make", node.fields.length); node.fields.forEach((_, index) => field(`field${index}`)); }
	}
	for(const node of table.values())
	{
		const id = walker(node.id), name = node.name, symbol = helper(node);
		const check = [
			`if (!ng_pointer(value, sizeof(*value), _Alignof(${name}))) return NG_INVALID;`
			, `uint32_t status = ng_enter(value, ${node.index}, depth, budget);`
			, "if (!status && storage) status = ng_charge(budget, 1, sizeof(*value));"
			, "if (status) return status;"
		];
		const input = ["(void)value; LB_GRAPH_DECODE();"], output = ["(void)out; value = LB_GRAPH_ENCODE(value);"
			, `if (depth > ${componentRecursiveLimits.valueDepth} || !arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }`
			, "--arena->budget->nodes;"
			, "if (lean_is_scalar(value) || !lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return NG_RESULT; }"
		];
		const extra = [];
		const address = (field, slot) => field.storage === "pointer" ? slot : `&${slot}`;
		const checkField = (field, slot) => `if ((status = ${walker(field.type)}_check(${address(field, slot)}, depth + 1, ${field.storage === "pointer" ? 1 : 0}, budget))) return status;`;
		const encodeField = (field, suffix, slot) => {
			const child = table.get(field.type), target = field.storage === "pointer" ? "raw" : `&${slot}`;
			return ["if (!status) {"
				, ...field.storage === "pointer" ? ["  void *raw;", `  status = ng_allocate(arena, 1, sizeof(${child.name}), &raw);`, `  ${slot} = raw;`] : []
				, "  if (!status) {", "    lean_inc(value);"
				, `    status = ${walker(field.type)}_out(${target}, ${symbol}_${suffix}(value), depth + 1, arena);`
				, "  }", "}"];
		};
		const construct = (fields, suffix, slots) => {
			if(!fields.length) return [`return ${symbol}_${suffix}(lean_box(0));`];
			// Keep wide C argument lists in a nonrecursive frame. Pending child
			// carriers live in a Lean Array while the decoder descends further.
			extra.push(`__attribute__((noinline)) static lean_object *${id}_${suffix}(lean_object *items) {`);
			fields.forEach((_, index) => extra.push(`  lean_object *a${index} = lean_array_get_core(items, ${index}); lean_inc(a${index});`));
			extra.push("  lean_dec(items);", `  return ${symbol}_${suffix}(${fields.map((_, index) => `a${index}`).join(", ")});`, "}");
			return [`lean_object *items = lean_alloc_array(${fields.length}, ${fields.length});`
				, ...fields.map((field, index) => `lean_array_set_core(items, ${index}, ${walker(field.type)}_in(${address(field, slots[index])}));`)
				, `return ${id}_${suffix}(items);`];
		};
		if(node.kind === "primitive")
		{
			const scalar = node.ref.name, dynamic = node.aggregate;
			if(scalar === "unit") check.push("if (*value) return NG_INVALID;");
			if(scalar === "bool") check.push("uint8_t raw; memcpy(&raw, value, 1); if (raw > 1) return NG_INVALID;");
			if(scalar === "char") check.push("if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return NG_INVALID;");
			if(dynamic)
			{
				const limbs = ["nat", "int"].includes(scalar);
				check.push(`status = ng_span(value->data, value->length, ${limbs ? "sizeof(uint32_t), _Alignof(uint32_t)" : "1, 1"}, budget);`, "if (status) return status;");
				if(scalar === "string") check.push("if (!ng_utf8((const uint8_t *)value->data, value->length)) return NG_INVALID;");
				if(scalar === "int") check.push("uint8_t raw; memcpy(&raw, &value->negative, 1); if (raw > 1) return NG_INVALID;");
			}
			let boxed;
			if(scalar === "unit") boxed = "lean_box(0)";
			else if(scalar === "string") boxed = 'lean_mk_string_from_bytes(value->length ? value->data : "", value->length)';
			else if(scalar === "bytes")
			{
				input.push("lean_object *bytes = lean_alloc_sarray(1, value->length, value->length);", "if (value->length) memcpy(lean_sarray_cptr(bytes), value->data, value->length);"); boxed = "bytes";
			}
			else if(scalar === "nat") boxed = "ng_nat_in(value->data, value->length)";
			else if(scalar === "int")
			{
				input.push("lean_object *integer = lean_nat_to_int(ng_nat_in(value->data, value->length));", "if (value->negative) { lean_object *negative = lean_int_neg(integer); lean_dec(integer); integer = negative; }"); boxed = "integer";
			}
			else
			{
				const suffix = { uint32: "_uint32", int32: "_uint32", char: "_uint32", uint64: "_uint64", int64: "_uint64", usize: "_usize", isize: "_usize", float32: "_float32", float64: "_float" }[scalar] ?? "";
				const cast = scalar === "bool" ? "uint8_t" : scalar === "char" ? "uint32_t" : scalar === "isize" || scalar === "usize" ? "size_t" : scalar.startsWith("int") ? `u${name}` : name;
				boxed = `lean_box${suffix}((${cast})*value)`;
			}
			input.push("lean_object *carrier = lean_alloc_array(1, 1);", `lean_array_set_core(carrier, 0, ${boxed});`, "return carrier;");
			output.push("lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);", "uint32_t status = NG_OK;");
			if(scalar === "string" || scalar === "bytes")
			{
				output.push(`if (lean_is_scalar(child) || !${scalar === "string" ? "lean_is_string" : "lean_is_sarray"}(child)) { lean_dec(child); return NG_RESULT; }`
					, `size_t length = ${scalar === "string" ? "lean_string_size(child) - 1" : "lean_sarray_size(child)"};`
					, ...scalar === "string" ? ["if (!ng_utf8((const uint8_t *)lean_string_cstr(child), length)) { lean_dec(child); return NG_RESULT; }"] : []
					, "void *data;"
					, "status = ng_allocate(arena, length, 1, &data);", "if (!status) {"
					, `  if (length) memcpy(data, ${scalar === "string" ? "lean_string_cstr(child)" : "lean_sarray_cptr(child)"}, length);`
					, "  out->data = data; out->length = length;", "}");
			}
			else if(scalar === "nat" || scalar === "int")
			{
				if(scalar === "int") output.push("out->negative = lean_int_lt(child, lean_box(0));", "lean_object *magnitude = lean_nat_abs(child);", "lean_dec(child); child = magnitude;");
				output.push("status = ng_nat_out(child, arena, &out->data, &out->length);");
			}
			else
			{
				const suffix = { uint32: "_uint32", int32: "_uint32", char: "_uint32", uint64: "_uint64", int64: "_uint64", usize: "_usize", isize: "_usize", float32: "_float32", float64: "_float" }[scalar] ?? "";
				const bound = { unit: "0", bool: "1", uint8: "UINT8_MAX", int8: "UINT8_MAX", uint16: "UINT16_MAX", int16: "UINT16_MAX", uint32: "UINT32_MAX", int32: "UINT32_MAX", char: "0x10ffff" }[scalar];
				if(bound) output.push(`if (!lean_is_scalar(child) || lean_unbox(child) > ${bound}) { lean_dec(child); return NG_RESULT; }`);
				if(scalar.startsWith("int") || scalar === "isize") output.push(`${scalar === "isize" ? "size_t" : `u${name}`} bits = lean_unbox${suffix}(child);`, "memcpy(out, &bits, sizeof(*out));");
				else output.push(`*out = (${name})lean_unbox${suffix}(child);`);
				if(scalar === "char") output.push("if (*out > 0x10ffff || (*out >= 0xd800 && *out <= 0xdfff)) status = NG_RESULT;");
			}
			output.push("lean_dec(child); return status;");
		}
		else if(node.element)
		{
			const child = table.get(node.element), childId = walker(node.element);
			check.push("if (value->length > budget->nodes) return NG_LIMIT;"
				, `status = ng_span(value->data, value->length, sizeof(${child.name}), _Alignof(${child.name}), budget);`, "if (status) return status;"
				, `for (size_t i = 0; i < value->length; ++i) if ((status = ${childId}_check(value->data + i, depth + 1, 0, budget))) return status;`);
			input.push("lean_object *items = lean_alloc_array(value->length, value->length);"
				, `for (size_t i = 0; i < value->length; ++i) lean_array_set_core(items, i, ${childId}_in(value->data + i));`, `return ${symbol}_make(items);`);
			output.push(`value = ${symbol}_items(value);`, "if (lean_is_scalar(value) || !lean_is_array(value)) { lean_dec(value); return NG_RESULT; }"
				, "size_t count = lean_array_size(value);", "if (count > arena->budget->nodes) { lean_dec(value); return NG_LIMIT; }", "void *raw;"
				, `uint32_t status = ng_allocate(arena, count, sizeof(${child.name}), &raw);`
				, `out->data = raw; out->length = count; ${child.name} *data = raw;`
				, "for (size_t i = 0; !status && i < count; ++i) {", "  lean_object *child = lean_array_get_core(value, i); lean_inc(child);"
				, `  status = ${childId}_out(data + i, child, depth + 1, arena);`, "}", "lean_dec(value); return status;");
		}
		else if(node.kind === "variant")
		{
			check.push("switch (value->kind) {"); input.push("switch (value->kind) {");
			output.push("lean_inc(value);", `uint32_t branch = ${symbol}_branch(value), status = NG_OK;`, "out->kind = branch;", "switch (branch) {");
			node.cases.forEach((branch, index) => {
				const slots = branch.fields.map(field => `value->cases.${branch.name}.${field.name}`);
				check.push(`case ${index}:`, ...branch.fields.map((field, i) => checkField(field, slots[i])), "break;");
				input.push(`case ${index}: {`, ...construct(branch.fields, `make${index}`, slots), "}");
				output.push(`case ${index}: {`, ...branch.fields.flatMap((field, i) => encodeField(field, `case${index}_field${i}`, `out->cases.${branch.name}.${field.name}`)), "break;", "}");
			});
			check.push("default: return NG_INVALID;", "}"); input.push("default: return lean_alloc_array(0, 0);", "}");
			output.push("default: status = NG_RESULT;", "}", "lean_dec(value); return status;");
		}
		else
		{
			const flag = { option: "has_value", result: "is_ok" }[node.kind];
			if(flag) check.push(`if (value->${flag} > 1) return NG_INVALID;`);
			node.fields.forEach((field, index) => {
				check.push(...flag ? [`if (${index ? "!" : ""}value->${flag}) {`, checkField(field, `value->${field.name}`), "}"] : [checkField(field, `value->${field.name}`)]);
			});
			if(flag)
			{
				if(node.kind === "option") input.push(`if (!value->has_value) return ${symbol}_none(lean_box(0));`);
				node.fields.forEach((field, index) => input.push(`if (${index ? "!" : ""}value->${flag}) return ${symbol}_make${index}(${walker(field.type)}_in(${address(field, `value->${field.name}`)}));`));
				input.push("return lean_alloc_array(0, 0);");
				output.push("lean_inc(value);", `uint32_t branch = ${symbol}_branch(value);`, "if (branch > 1) { lean_dec(value); return NG_RESULT; }"
					, `out->${flag} = ${node.kind === "option" ? "branch" : "branch == 0"};`);
			}
			else input.push(...construct(node.fields, "make", node.fields.map(field => `value->${field.name}`)));
			output.push("uint32_t status = NG_OK;");
			node.fields.forEach((field, index) => output.push(...flag ? [`if (${index ? "!" : ""}out->${flag}) {`, ...encodeField(field, `field${index}`, `out->${field.name}`), "}"] : encodeField(field, `field${index}`, `out->${field.name}`)));
			output.push("lean_dec(value); return status;");
		}
		lines.push(...extra, `static inline uint32_t ${id}_check(const ${name} *value, size_t depth, int storage, ng_budget *budget) {`, ...check.map(line => `  ${line}`), "  return NG_OK;", "}"
			, `static inline lean_object *${id}_in(const ${name} *value) {`, ...input.map(line => `  ${line}`), "}"
			, `static inline uint32_t ${id}_out(${name} *out, lean_object *value, size_t depth, ng_arena *arena) {`, ...output.map(line => `  ${line}`), "}");
	}
	for(const root of layout.roots)
	{
		const item = abi.exports.find(item => item.bindingId === root.bindingId), result = table.get(root.result);
		const parameters = root.parameters.map((id, index) => `const ${table.get(id).name} *a${index}`);
		parameters.push(`${result.name} *out`);
		const signature = `uint32_t ${root.name}_graph(${parameters.join(", ")})`;
		declarations.push(`${signature};`);
		lines.push(`extern lean_object *${item.symbol}_lean(${Array(Math.max(1, root.parameters.length)).fill("lean_object *").join(", ")});`, `${signature} {`
			, `  if (!ng_pointer(out, sizeof(*out), _Alignof(${result.name}))) return NG_INVALID;`
			, ...result.aggregate ? ["  if (out->_bridge_owner || out->_bridge_release) return NG_INVALID;"] : []
			, `  ng_budget budget = { .bytes = 16u * 1024u * 1024u, .nodes = ${componentRecursiveLimits.valueNodes}, .path = {{0}} };`
			, "  uint32_t status;"
			, ...root.parameters.map((type, index) => `  if ((status = ${walker(type)}_check(a${index}, 0, 1, &budget))) return status;`)
			, "  if ((status = ng_charge(&budget, 1, sizeof(*out)))) return status;"
			, "  if (!budget.nodes) return NG_LIMIT;"
			, ...initializer ? [`  if (!lean_bridge_native_component_initialize(${JSON.stringify(ir.component.id)}, ng_initialize)) return NG_RUNTIME;`] : []
			, "  ng_arena arena = { .head = NULL, .budget = &budget };"
			, ...root.parameters.map((type, index) => `  lean_object *v${index} = ${walker(type)}_in(a${index});`)
			, `  lean_object *value = ${item.symbol}_lean(${root.parameters.length ? root.parameters.map((_, index) => `v${index}`).join(", ") : "lean_box(0)"});`
			, ...initializer ? ["  if (!ng_ready()) { lean_dec(value); return NG_RUNTIME; }"] : []
			, `  ${result.name} result = {0};`, `  status = ${walker(root.result)}_out(&result, value, 0, &arena);`
			, ...initializer ? ["  if (status == NG_RESULT) lean_bridge_native_runtime_retire();"] : []
			, "  if (status) { ng_release(arena.head); return status; }"
			, ...initializer ? ["  if (!ng_ready()) { ng_release(arena.head); return NG_RUNTIME; }"] : []
			, ...result.aggregate ? ["  result._bridge_owner = arena.head;", "  result._bridge_release = arena.head ? ng_release : NULL;"] : []
			, "  *out = result; return NG_OK;", "}");
	}
	const header = [`#include "${layout.prefix}-graph-types.h"`, "#ifdef __cplusplus", 'extern "C" {', "#endif", ...declarations, "#ifdef __cplusplus", "}", "#endif", ""].join("\n");
	return { layout, typesHeader, header, source: lines.join("\n") };
};
