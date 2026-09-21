/**
 * Typed record and compound bridges. Lean constructs, matches and projects;
 * C only sees arrays and boxed primitives, never constructor tags or offsets.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentScalarTypes, scalarCopyLimit, scalarSlotBytes } from "../abi/component-scalars.mjs";
import { assertComponentRecordAbi, componentCompoundAbi, componentNominalAbi } from "../abi/component-records.mjs";

const key = id => sha256(id).slice(0, 20);
const prefix = (abi, id) => `${abi.exports[0].symbol}_record_${key(id)}`;
const sequence = type => type.kind === "apply" && ["array", "list"].includes(type.constructor);
const compound = type => type.kind === "apply" && !sequence(type);
const carried = type => type.kind === "named" || compound(type);
const identity = type => type.kind === "named" ? type.id : canonicalJson(type);
const definitions = abi => abi.types ?? abi.records;
const childrenOf = (type, records) => {
	if(type.kind === "apply") return type.arguments;
	if(type.kind !== "named") return [];
	const definition = records.get(type.id);
	return definition.kind === "alias" ? [definition.target] : definition.kind === "variant"
		? definition.cases.flatMap(item => item.fields.map(field => field.type)) : definition.fields.map(field => field.type);
};
const allTypes = abi => {
	const records = new Map(definitions(abi).map(record => [record.id, record])), types = new Map();
	const add = type => { if(types.has(identity(type))) return; types.set(identity(type), type); childrenOf(type, records).forEach(add); };
	for(const item of abi.exports) [...item.parameters, item.result].forEach(add);
	for(const record of definitions(abi)) add({ kind: "named", id: record.id });
	return [...types.values()];
};
const object = type => type.kind !== "primitive" || ["unit", "nat", "int", "string", "bytes"].includes(type.name);
const cType = type => object(type) ? "lean_object *" : ["usize", "isize"].includes(type.name) ? "size_t"
	: type.name === "bool" ? "uint8_t" : type.name === "char" ? "uint32_t"
		: type.name === "float32" ? "float" : type.name === "float64" ? "double" : `${type.name.replace(/^int/, "uint")}_t`;
const suffix = type => ["uint32", "int32", "char"].includes(type.name) ? "_uint32"
	: ["uint64", "int64"].includes(type.name) ? "_uint64" : ["usize", "isize"].includes(type.name) ? "_usize"
		: type.name === "float32" ? "_float32" : type.name === "float64" ? "_float" : "";
const box = (type, expression) => object(type) ? expression : `lean_box${suffix(type)}(${expression})`;
const needsConversion = type => carried(type) || type.constructor === "list" || (type.kind === "apply" && type.arguments.some(needsConversion));

/**
 * Generate total Lean conversion functions and typed public-call wrappers.
 * A one-element Array carries each record or compound across C regardless of its native
 * representation. Array access is bounds checked with a proved local bound.
 *
 * @param abi - Validated private record or compound descriptor.
 * @param exports - Compiler-selected declarations and applications.
 * @param leanType - Source Lean type renderer.
 */
export const componentRecordLeanSource = (abi, exports, leanType) => {
	assertComponentRecordAbi(abi);
	const records = new Map(definitions(abi).map(record => [record.id, record]));
	const sourceType = type => type.kind === "named" ? `_root_.${type.id.slice(5)}` : leanType(type);
	const transportType = type => carried(type) ? `(_root_.Array ${sourceType(type)})`
		: type.kind === "apply" ? `(_root_.Array ${transportType(type.arguments[0])})` : leanType(type);
	const convert = (type, value, input) => {
		if(carried(type)) return input ? `(unpack${key(identity(type))} ${value})` : `#[${value}]`;
		if(!sequence(type)) return value;
		// One slot costs 16 bytes. Retaining one excess element guarantees that
		// an oversized List fails the 16 MiB wire budget, never returns a prefix.
		// Bound this intermediate conversion before traversing an arbitrary List.
		let result = type.constructor === "list" && !input ? `(listToTransportArray (${value}))` : value;
		if(needsConversion(type.arguments[0])) result = `((${result}).map (fun element => ${convert(type.arguments[0], "element", input)}))`;
		return type.constructor === "list" && input ? `((${result}).toList)` : result;
	};
	const defaultValue = type => type.kind === "primitive" ? ({ unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)", string: '""', bytes: "_root_.ByteArray.empty" })[type.name] ?? "0"
		: type.kind === "apply" ? type.constructor === "array" ? "#[]" : type.constructor === "list" ? "[]" : type.constructor === "option" ? "_root_.Option.none"
			: type.constructor === "result" ? `(_root_.Except.ok ${defaultValue(type.arguments[0])})`
				: `(${defaultValue(type.arguments[0])}, ${defaultValue(type.arguments[1])})`
			: records.get(type.id).kind === "alias" ? defaultValue(records.get(type.id).target)
				: records.get(type.id).kind === "variant" ? `(${sourceType(type)}.«${records.get(type.id).cases[0].name}» ${records.get(type.id).cases[0].fields.map(field => defaultValue(field.type)).join(" ")})`
					: `({ ${records.get(type.id).fields.map(field => `«${field.name}» := ${defaultValue(field.type)}`).join(", ")} } : ${sourceType(type)})`;
	const lines = [];
	if(allTypes(abi).some(type => type.constructor === "list")) lines.push(
		"def listToTransportArray {α : Type} (values : _root_.List α) : _root_.Array α :="
		, "  let rec loop : _root_.Nat → _root_.List α → _root_.Array α → _root_.Array α"
		, "    | 0, _, acc => acc"
		, "    | _, [], acc => acc"
		, "    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push head)"
		, `  loop ${Math.floor(scalarCopyLimit / scalarSlotBytes) + 1} values #[]`, ""
	);
	for(const type of allTypes(abi).filter(carried))
	{
		lines.push(`def unpack${key(identity(type))} (value : ${transportType(type)}) : ${sourceType(type)} :=`
			, `  if bound : 0 < value.size then value[0]'bound else ${defaultValue(type)}`, "");
	}
	for(const type of allTypes(abi).filter(compound))
	{
		const id = identity(type), hash = key(id), symbol = prefix(abi, id), args = type.arguments;
		const emit = (name, parameters, result, body) => lines.push(`@[export ${symbol}_${name}]`, `def ${name}${hash} ${parameters} : ${result} :=`, `  ${body}`, "");
		const input = `(value : ${transportType(type)})`, unpack = `(unpack${hash} value)`;
		if(type.constructor === "tuple")
		{
			emit("make", args.map((child, i) => `(a${i} : ${transportType(child)})`).join(" "), transportType(type), `#[(${convert(args[0], "a0", true)}, ${convert(args[1], "a1", true)})]`);
			args.forEach((child, i) => emit(`field${i}`, input, transportType(child), convert(child, `${unpack}.${i ? "snd" : "fst"}`, false)));
			continue;
		}
		const option = type.constructor === "option", names = option ? ["none", "some"] : ["ok", "error"];
		emit("branch", input, "_root_.UInt32", `match ${unpack} with | .${names[0]}${option ? "" : " _"} => 0 | .${names[1]} _ => 1`);
		if(option) emit("none", "(_bridgeUnit : _root_.Unit)", transportType(type), "#[.none]");
		args.forEach((child, i) => {
			const name = option ? "some" : names[i];
			emit(`make${i}`, `(value : ${transportType(child)})`, transportType(type), `#[.${name} ${convert(child, "value", true)}]`);
			emit(`field${i}`, input, transportType(child), `match ${unpack} with | .${name} field => ${convert(child, "field", false)} | _ => ${convert(child, defaultValue(child), false)}`);
		});
	}
	for(const record of definitions(abi))
	{
		const type = { kind: "named", id: record.id }, symbol = prefix(abi, record.id);
		const emit = (name, parameters, result, body) => lines.push(`@[export ${symbol}_${name}]`, `def ${name}${key(record.id)} ${parameters} : ${result} :=`, `  ${body}`, "");
		const input = `(value : ${transportType(type)})`, unpack = `(unpack${key(record.id)} value)`;
		if(record.kind === "alias")
		{
			emit("make", `(value : ${transportType(record.target)})`, transportType(type), `#[${convert(record.target, "value", true)}]`);
			emit("field0", input, transportType(record.target), convert(record.target, unpack, false));
			continue;
		}
		if(record.kind === "variant")
		{
			emit("branch", input, "_root_.UInt32", `match ${unpack} with ${record.cases.map((item, i) => `| .«${item.name}» ${item.fields.map(() => "_").join(" ")} => ${i}`).join(" ")}`);
			record.cases.forEach((item, branch) => {
				const parameters = item.fields.map((field, i) => `(a${i} : ${transportType(field.type)})`).join(" ");
				emit(`make${branch}`, parameters || "(_bridgeUnit : _root_.Unit)", transportType(type), `#[.«${item.name}» ${item.fields.map((field, i) => convert(field.type, `a${i}`, true)).join(" ")}]`);
				item.fields.forEach((field, index) => emit(`case${branch}_field${index}`, input, transportType(field.type)
					, `match ${unpack} with | .«${item.name}» ${item.fields.map((_, i) => i === index ? "field" : "_").join(" ")} => ${convert(field.type, "field", false)}${record.cases.length > 1 ? ` | _ => ${convert(field.type, defaultValue(field.type), false)}` : ""}`));
			});
			continue;
		}
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
 * @param abi - Closed private record or compound descriptor.
 */
export const generateComponentRecordAdapters = abi => {
	assertComponentRecordAbi(abi);
	const records = new Map(definitions(abi).map(record => [record.id, record]));
	const identify = type => `copied_${key(JSON.stringify(type))}`;
	const types = new Map(allTypes(abi).map(type => [identify(type), type]));
	const mode = abi.version === componentNominalAbi ? "nominal" : abi.version === componentCompoundAbi ? "compound" : "record";
	const lines = ['#include "component_scalar.h"', '_Static_assert(sizeof(size_t) == 4, "record frames require wasm32 Lean");', ""];
	for(const record of definitions(abi))
	{
		const symbol = prefix(abi, record.id);
		if(record.kind === "alias")
		{
			lines.push(`extern lean_object *${symbol}_make(${cType(record.target)});`, `extern ${cType(record.target)} ${symbol}_field0(lean_object *);`);
			continue;
		}
		if(record.kind === "variant")
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			record.cases.forEach((item, branch) => {
				lines.push(`extern lean_object *${symbol}_make${branch}(${item.fields.length ? item.fields.map(field => cType(field.type)).join(", ") : "lean_object *"});`);
				item.fields.forEach((field, index) => lines.push(`extern ${cType(field.type)} ${symbol}_case${branch}_field${index}(lean_object *);`));
			});
			continue;
		}
		lines.push(`extern lean_object *${symbol}_make(${record.fields.length ? record.fields.map(field => cType(field.type)).join(", ") : "lean_object *"});`);
		for(const [index, field] of record.fields.entries()) lines.push(`extern ${cType(field.type)} ${symbol}_field${index}(lean_object *);`);
	}
	for(const type of allTypes(abi).filter(compound))
	{
		const symbol = prefix(abi, identity(type)), args = type.arguments;
		if(type.constructor === "tuple") lines.push(`extern lean_object *${symbol}_make(${args.map(cType).join(", ")});`);
		else
		{
			lines.push(`extern uint32_t ${symbol}_branch(lean_object *);`);
			if(type.constructor === "option") lines.push(`extern lean_object *${symbol}_none(lean_object *);`);
			args.forEach((child, i) => lines.push(`extern lean_object *${symbol}_make${i}(${cType(child)});`));
		}
		args.forEach((child, i) => lines.push(`extern ${cType(child)} ${symbol}_field${i}(lean_object *);`));
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
		const definition = type.kind === "named" ? records.get(type.id) : null;
		const namedSymbol = prefix(abi, identity(type));
		if(definition?.kind === "alias")
		{
			const child = definition.target;
			lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t *budget) { return ${identify(child)}_validate(slot, budget); }`
				, `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`, ...decode(child, "slot", "value"), `  return ${namedSymbol}_make(value);`, "}"
				, `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t *budget) {`
				, "  if (!lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return 6; }"
				, `  ${cType(child)} field = ${namedSymbol}_field0(value);`, `  return ${identify(child)}_encode(slot, ${box(child, "field")}, budget);`, "}");
			continue;
		}
		if(definition?.kind === "variant")
		{
			lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t *budget) {`
				, "  uint32_t status = bridge_nominal_children_validate(slot, 37, UINT32_MAX, budget);", "  if (status) return status;"
				, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;"
				, "  uint32_t count = slot->bits >> 32;", "  switch (slot->flags >> 2) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}:`, `    if (count != ${item.fields.length}) return 3;`);
				item.fields.forEach((field, i) => lines.push(`    if ((status = ${identify(field.type)}_validate(children + ${i}, budget))) return status;`));
				lines.push("    return 0;");
			});
			lines.push("  default: return 3;", "  }", "}", `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
				, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;", "  switch (slot->flags >> 2) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}: {`);
				item.fields.forEach((field, i) => lines.push(...decode(field.type, `children + ${i}`, `a${i}`)));
				lines.push(`    return ${namedSymbol}_make${branch}(${item.fields.length ? item.fields.map((_, i) => `a${i}`).join(", ") : "lean_box(0)"});`, "  }");
			});
			lines.push("  default: return lean_box(0); /* unreachable after complete input validation */", "  }", "}"
				, `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t *budget) {`
				, "  if (!lean_is_array(value) || lean_array_size(value) != 1) { lean_dec(value); return 6; }"
				, "  lean_inc(value);", `  uint32_t branch = ${namedSymbol}_branch(value);`, "  uint32_t status;", "  switch (branch) {");
			definition.cases.forEach((item, branch) => {
				lines.push(`  case ${branch}: {`, `    status = bridge_nominal_children_allocate(slot, 37, ${item.fields.length}, branch, budget);`
					, "    if (status) { lean_dec(value); return status; }", "    bridge_scalar_slot *children = (bridge_scalar_slot *)(uintptr_t)(uint32_t)slot->bits;");
				item.fields.forEach((field, i) => lines.push("    if (!status) {", "      lean_inc(value);"
					, `      ${cType(field.type)} field = ${namedSymbol}_case${branch}_field${i}(value);`
					, `      status = ${identify(field.type)}_encode(children + ${i}, ${box(field.type, "field")}, budget);`, "    }"));
				lines.push("    break;", "  }");
			});
			lines.push("  default: lean_dec(value); return 6;", "  }", "  lean_dec(value);", "  if (status) bridge_record_slot_clear(slot);", "  return status;", "}");
			continue;
		}
		const array = sequence(type), option = type.constructor === "option", sum = option || type.constructor === "result";
		const children = childrenOf(type, records), tag = type.kind === "named" ? 36 : ({ array: 32, list: 32, tuple: 33, option: 34, result: 35 })[type.constructor];
		const count = array ? "(uint32_t)(slot->bits >> 32)" : option ? "(slot->flags & 1u)" : sum ? "1" : String(children.length);
		const symbol = prefix(abi, identity(type));
		lines.push(`static uint32_t ${id}_validate(bridge_scalar_slot const *slot, uint32_t *budget) {`
			, `  uint32_t status = bridge_${mode}_children_validate(slot, ${tag}, ${array || option ? "UINT32_MAX" : count}, budget);`
			, "  if (status) return status;", "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push(`  for (uint32_t i = 0; i < ${count}; ++i) if ((status = ${identify(children[0])}_validate(children + i, budget))) return status;`);
		else if(sum) lines.push(option ? `  if (slot->flags & 1u) return ${identify(children[0])}_validate(children, budget);`
			: `  return (slot->flags & 1u) ? ${identify(children[1])}_validate(children, budget) : ${identify(children[0])}_validate(children, budget);`);
		else for(const [index, child] of children.entries()) lines.push(`  if ((status = ${identify(child)}_validate(children + ${index}, budget))) return status;`);
		lines.push("  return 0;", "}", `static lean_object *${id}_decode(bridge_scalar_slot const *slot) {`
			, "  bridge_scalar_slot const *children = (bridge_scalar_slot const *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push(`  uint32_t count = ${count};`, "  lean_object *value = lean_alloc_array(count, count);"
			, `  for (uint32_t i = 0; i < count; ++i) lean_array_set_core(value, i, ${identify(children[0])}_decode(children + i));`, "  return value;");
		else if(sum)
		{
			if(option) lines.push(`  if (!(slot->flags & 1u)) return ${symbol}_none(lean_box(0));`);
			children.forEach((child, i) => {
				lines.push(option ? "  {" : `  if ((slot->flags & 1u) == ${i}) {`, ...decode(child, "children", `a${i}`), `  return ${symbol}_make${i}(a${i});`, "  }");
			});
			lines.push("  return lean_box(0); /* unreachable after complete input validation */");
		}
		else
		{
			for(const [index, child] of children.entries()) lines.push(...decode(child, `children + ${index}`, `a${index}`));
			lines.push(`  return ${symbol}_make(${children.length ? children.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`);
		}
		lines.push("}", `static uint32_t ${id}_encode(bridge_scalar_slot *slot, lean_object *value, uint32_t *budget) {`
			, `  if (!lean_is_array(value)${array ? "" : " || lean_array_size(value) != 1"}) { lean_dec(value); return 6; }`);
		if(sum) lines.push("  lean_inc(value);", `  uint32_t branch = ${symbol}_branch(value);`, "  if (branch > 1) { lean_dec(value); return 6; }");
		lines.push(`  uint32_t count = ${array ? "lean_array_size(value)" : option ? "branch" : count};`
			, `  uint32_t status = bridge_${mode}_children_allocate(slot, ${tag}, count, ${mode !== "record" ? `${sum ? "branch" : "0"}, ` : ""}budget);`
			, "  if (status) { lean_dec(value); return status; }", "  bridge_scalar_slot *children = (bridge_scalar_slot *)(uintptr_t)(uint32_t)slot->bits;");
		if(array) lines.push("  for (uint32_t i = 0; i < count; ++i) {", "    lean_object *child = lean_array_get_core(value, i); lean_inc(child);"
			, `    status = ${identify(children[0])}_encode(children + i, child, budget);`, "    if (status) break;", "  }");
		else if(sum) children.forEach((child, i) => lines.push(`  if (branch == ${option ? 1 : i}) {`, "    lean_inc(value);"
			, `    ${cType(child)} field = ${symbol}_field${i}(value);`, `    status = ${identify(child)}_encode(children, ${box(child, "field")}, budget);`, "  }"));
		else for(const [index, child] of children.entries()) lines.push("  if (!status) {", "    lean_inc(value);"
			, `    ${cType(child)} field = ${symbol}_field${index}(value);`
			, `    status = ${identify(child)}_encode(children + ${index}, ${box(child, "field")}, budget);`, "  }");
		lines.push("  lean_dec(value);", "  if (status) bridge_record_slot_clear(slot);", "  return status;", "}");
	}
	for(const item of abi.exports)
	{
		lines.push(`extern ${cType(item.result)} ${item.symbol}_lean(${item.parameters.length ? item.parameters.map(cType).join(", ") : "lean_object *"});`
			, `LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`, `  uint32_t status = bridge_${mode}_frame_validate(frame, ${item.parameters.length});`
			, "  if (status) return status;", `  if (bridge_${mode}_abi() != 1) return 6;`, "  uint32_t budget = 16u * 1024u * 1024u;");
		for(const [index, type] of item.parameters.entries()) lines.push(`  if ((status = ${identify(type)}_validate(&frame->args[${index}], &budget))) return status;`);
		for(const [index, type] of item.parameters.entries()) lines.push(...decode(type, `&frame->args[${index}]`, `a${index}`));
		lines.push(`  ${cType(item.result)} result = ${item.symbol}_lean(${item.parameters.length ? item.parameters.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`
			, `  lean_object *boxed = ${box(item.result, "result")};`, "  if (budget < 16) { lean_dec(boxed); return 4; }", "  budget -= 16;"
			, `  return ${identify(item.result)}_encode(&frame->result, boxed, &budget);`, "}", "");
	}
	return lines.join("\n");
};
