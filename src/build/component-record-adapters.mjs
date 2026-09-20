/**
 * Typed record bridges. Lean constructs/projects records; C only sees arrays
 * and boxed primitives, never compiler-dependent record offsets or layouts.
 *
 * @file
 */
import { sha256 } from "../capsule/node.mjs";
import { componentScalarTypes } from "../abi/component-scalars.mjs";
import { assertComponentRecordAbi } from "../abi/component-records.mjs";

const key = id => sha256(id).slice(0, 20);
const prefix = (abi, id) => `${abi.exports[0].symbol}_record_${key(id)}`;
const object = type => type.kind !== "primitive" || ["unit", "nat", "int", "string", "bytes"].includes(type.name);
const cType = type => object(type) ? "lean_object *" : ["usize", "isize"].includes(type.name) ? "size_t"
	: type.name === "bool" ? "uint8_t" : type.name === "char" ? "uint32_t"
		: type.name === "float32" ? "float" : type.name === "float64" ? "double" : `${type.name.replace(/^int/, "uint")}_t`;
const suffix = type => ["uint32", "int32", "char"].includes(type.name) ? "_uint32"
	: ["uint64", "int64"].includes(type.name) ? "_uint64" : ["usize", "isize"].includes(type.name) ? "_usize"
		: type.name === "float32" ? "_float32" : type.name === "float64" ? "_float" : "";
const box = (type, expression) => object(type) ? expression : `lean_box${suffix(type)}(${expression})`;
const containsRecord = type => type.kind === "named" || (type.kind === "apply" && containsRecord(type.arguments[0]));

/**
 * Generate total Lean conversion functions and typed public-call wrappers.
 * A one-element Array carries each record across C regardless of its native
 * representation. Array access is bounds checked with a proved local bound.
 *
 * @param abi - Validated private record descriptor.
 * @param exports - Compiler-selected declarations and applications.
 * @param leanType - Source Lean type renderer.
 */
export const componentRecordLeanSource = (abi, exports, leanType) => {
	assertComponentRecordAbi(abi);
	const records = new Map(abi.records.map(record => [record.id, record]));
	const sourceType = type => type.kind === "named" ? `_root_.${type.id.slice(5)}` : leanType(type);
	const transportType = type => type.kind === "named" ? `(_root_.Array ${sourceType(type)})`
		: type.kind === "apply" ? `(_root_.Array ${transportType(type.arguments[0])})` : leanType(type);
	const convert = (type, value, input) => type.kind === "named" ? input ? `(unpack${key(type.id)} ${value})` : `#[${value}]`
		: type.kind === "apply" && containsRecord(type) ? `((${value}).map (fun element => ${convert(type.arguments[0], "element", input)}))` : value;
	const defaultValue = type => type.kind === "primitive" ? ({ unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)", string: '""', bytes: "_root_.ByteArray.empty" })[type.name] ?? "0"
		: type.kind === "apply" ? "#[]" : `({ ${records.get(type.id).fields.map(field => `«${field.name}» := ${defaultValue(field.type)}`).join(", ")} } : ${sourceType(type)})`;
	const lines = [];
	for(const record of abi.records)
	{
		const type = { kind: "named", id: record.id };
		lines.push(`def unpack${key(record.id)} (value : ${transportType(type)}) : ${sourceType(type)} :=`
			, `  if bound : 0 < value.size then value[0]'bound else ${defaultValue(type)}`, "");
	}
	for(const record of abi.records)
	{
		const type = { kind: "named", id: record.id }, symbol = prefix(abi, record.id);
		const parameters = record.fields.map((field, index) => `(a${index} : ${transportType(field.type)})`).join(" ");
		const fields = record.fields.map((field, index) => `«${field.name}» := ${convert(field.type, `a${index}`, true)}`).join(", ");
		lines.push(`@[export ${symbol}_make]`, `def make${key(record.id)} ${parameters || "(_bridgeUnit : _root_.Unit)"} : ${transportType(type)} :=`
			, `  #[({ ${fields} } : ${sourceType(type)})]`, "");
		for(const [index, field] of record.fields.entries())
			lines.push(`@[export ${symbol}_field${index}]`, `def field${key(record.id)}_${index} (value : ${transportType(type)}) : ${transportType(field.type)} :=`
				, `  ${convert(field.type, `(unpack${key(record.id)} value).«${field.name}»`, false)}`, "");
	}
	for(const item of exports)
	{
		const signature = abi.exports.find(value => value.bindingId === item.bindingId);
		const parameters = signature.parameters.map((type, index) => `(${item.parameters[index].name} : ${transportType(type)})`).join(" ");
		const args = signature.parameters.map((type, index) => convert(type, item.parameters[index].name, true)).join(" ");
		const call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${args ? ` ${args}` : ""}`;
		lines.push(`@[export ${item.symbol}_lean]`, `def ${item.wrapper} ${parameters || "(_bridgeUnit : _root_.Unit)"} : ${transportType(signature.result)} :=`
			, `  ${convert(signature.result, `(${call})`, false)}`, "");
	}
	return lines;
};

/**
 * Generate bounded typed walkers and calls to the compiler-emitted record API.
 * Every encoder consumes its owned Lean input on success or ordinary failure.
 *
 * @param abi - Closed private record descriptor.
 */
export const generateComponentRecordAdapters = abi => {
	assertComponentRecordAbi(abi);
	const records = new Map(abi.records.map(record => [record.id, record])), types = new Map();
	const identify = type => `copied_${key(JSON.stringify(type))}`;
	const childrenOf = type => type.kind === "apply" ? [type.arguments[0]] : type.kind === "named" ? records.get(type.id).fields.map(field => field.type) : [];
	const add = type => { if(types.has(identify(type))) return; types.set(identify(type), type); childrenOf(type).forEach(add); };
	for(const item of abi.exports) [...item.parameters, item.result].forEach(add);
	for(const record of abi.records) add({ kind: "named", id: record.id });
	const lines = ['#include "component_scalar.h"', '_Static_assert(sizeof(size_t) == 4, "record frames require wasm32 Lean");', ""];
	for(const record of abi.records)
	{
		const symbol = prefix(abi, record.id);
		lines.push(`extern lean_object *${symbol}_make(${record.fields.length ? record.fields.map(field => cType(field.type)).join(", ") : "lean_object *"});`);
		for(const [index, field] of record.fields.entries()) lines.push(`extern ${cType(field.type)} ${symbol}_field${index}(lean_object *);`);
	}
	for(const id of types.keys()) lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *, uint32_t *);`
		, `static lean_object *${id}_decode(bridge_scalar_slot const *);`
		, `static uint32_t ${id}_encode(bridge_scalar_slot *, lean_object *, uint32_t *);`);
	const decode = (type, slot, name) => [`  lean_object *boxed_${name} = ${identify(type)}_decode(${slot});`
		, `  ${cType(type)} ${name} = ${object(type) ? `boxed_${name}` : `(${cType(type)})lean_unbox${suffix(type)}(boxed_${name})`};`
		, ...(!object(type) ? [`  lean_dec(boxed_${name});`] : [])];
	for(const [id, type] of types)
	{
		if(type.kind === "primitive")
		{
			const tag = componentScalarTypes.indexOf(type.name);
			lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t *budget) { return bridge_copied_validate(slot, ${tag}, 0, budget); }`
				, `static lean_object *${id}_decode(bridge_scalar_slot const *slot) { return bridge_copied_decode(slot, ${tag}, 0); }`
				, `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t *budget) { return bridge_record_encode_leaf(slot, ${tag}, value, budget); }`);
			continue;
		}
		const array = type.kind === "apply", record = records.get(type.id), children = childrenOf(type), tag = array ? 32 : 36;
		const count = array ? "(uint32_t)(slot->bits >> 32)" : String(children.length);
		lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t *budget) {`
			, `  uint32_t status = bridge_record_children_validate(slot, ${tag}, ${array ? "UINT32_MAX" : count}, budget);`
			, "  if (status) return status;", "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push(`  for (uint32_t i = 0; i < ${count}; ++i) if ((status = ${identify(children[0])}_validate(children + i, budget))) return status;`);
		else for(const [index, child] of children.entries()) lines.push(`  if ((status = ${identify(child)}_validate(children + ${index}, budget))) return status;`);
		lines.push("  return 0;", "}", `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
			, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push(`  uint32_t count = ${count};`, "  lean_object *value = lean_alloc_array(count, count);"
			, `  for (uint32_t i = 0; i < count; ++i) lean_array_set_core(value, i, ${identify(children[0])}_decode(children + i));`, "  return value;");
		else
		{
			for(const [index, child] of children.entries()) lines.push(...decode(child, `children + ${index}`, `a${index}`));
			lines.push(`  return ${prefix(abi, record.id)}_make(${children.length ? children.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`);
		}
		lines.push("}", `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t *budget) {`
			, `  if (!lean_is_array(value)${array ? "" : " || lean_array_size(value) != 1"}) { lean_dec(value); return 6; }`
			, `  uint32_t count = ${array ? "lean_array_size(value)" : count};`
			, `  uint32_t status = bridge_record_children_allocate(slot, ${tag}, count, budget);`
			, "  if (status) { lean_dec(value); return status; }", "  bridge_scalar_slot *children = (bridge_scalar_slot *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push("  for (uint32_t i = 0; i < count; ++i) {", "    lean_object *child = lean_array_get_core(value, i); lean_inc(child);"
			, `    status = ${identify(children[0])}_encode(children + i, child, budget);`, "    if (status) break;", "  }");
		else for(const [index, child] of children.entries()) lines.push("  if (!status) {", "    lean_inc(value);"
			, `    ${cType(child)} field = ${prefix(abi, record.id)}_field${index}(value);`
			, `    status = ${identify(child)}_encode(children + ${index}, ${box(child, "field")}, budget);`, "  }");
		lines.push("  lean_dec(value);", "  if (status) bridge_record_slot_clear(slot);", "  return status;", "}");
	}
	for(const item of abi.exports)
	{
		lines.push(`extern ${cType(item.result)} ${item.symbol}_lean(${item.parameters.length ? item.parameters.map(cType).join(", ") : "lean_object *"});`
			, `LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`, `  uint32_t status = bridge_record_frame_validate(frame, ${item.parameters.length});`
			, "  if (status) return status;", "  if (bridge_record_abi() != 1) return 6;", "  uint32_t budget = 16u * 1024u * 1024u;");
		for(const [index, type] of item.parameters.entries()) lines.push(`  if ((status = ${identify(type)}_validate(&frame->args[${index}], &budget))) return status;`);
		for(const [index, type] of item.parameters.entries()) lines.push(...decode(type, `&frame->args[${index}]`, `a${index}`));
		lines.push(`  ${cType(item.result)} result = ${item.symbol}_lean(${item.parameters.length ? item.parameters.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`
			, `  lean_object *boxed = ${box(item.result, "result")};`, "  if (budget < 16) { lean_dec(boxed); return 4; }", "  budget -= 16;"
			, `  return ${identify(item.result)}_encode(&frame->result, boxed, &budget);`, "}", "");
	}
	return lines.join("\n");
};
