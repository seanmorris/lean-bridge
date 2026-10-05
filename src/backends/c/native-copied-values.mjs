/**
 * Recursive copied-value adapters. Compiler-emitted accessors own record layout.
 *
 * @file
 */
import { nativeCType, nativeObjectType, nativeTypeKey } from "../../build/native-model.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";

/**
 * Convert a compiler type to its semantic C reference.
 *
 * @param type - Checked native type.
 */
export const nativeCReference = type => type.kind === "primitive" ? { kind: "primitive", name: type.name }
	: type.kind === "callback" ? { kind: "named", id: `bridge:Callback${sha256(canonicalJson({ parameters: type.parameters.map(nativeCReference), result: nativeCReference(type.result) })).slice(0, 20)}` }
		: ["array", "list", "option"].includes(type.kind) ? { kind: "apply", constructor: type.kind, arguments: [nativeCReference(type.element)] }
			: ["result", "tuple"].includes(type.kind) ? { kind: "apply", constructor: type.kind, arguments: type.arguments.map(nativeCReference) }
				: { kind: "named", id: `lean:${type.name}` };
const dynamic = type => ["string", "bytes", "nat", "int"].includes(type.name);

/**
 * Render recursive validation, conversion and typed calls.
 *
 * @param model - Verified native compiler model.
 * @param surface - Admitted copied C surface.
 */
export const generateCopiedNativeCalls = (model, surface) => {
	const p = surface.prefix, macro = p.toUpperCase();
	const copy = type => surface.copy(nativeCReference(type));
	const id = type => `lb_copy_${copy(type).index}`;
	const boxed = (type, value) => nativeObjectType(type) ? value : `${type.abi.box}(${value})`;
	const unboxed = (type, value) => nativeObjectType(type) ? value : `(${nativeCType(type)})${type.abi.unbox}(${value})`;
	const definitions = model.types.filter(type => type.kind !== "callback").map(type => {
		const c = copy(type), key = id(type), n = nativeCType(type);
		const check = [], input = [], output = [], extra = [];
		if(type.kind === "primitive")
		{
			if(type.name === "unit") check.push("if (*value != 0) return 0;");
			if(type.name === "char") check.push("if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return 0;");
			if(type.name === "usize" && model.pointerBits === 32) check.push("if (*value > UINT32_MAX) return 0;");
			if(type.name === "isize" && model.pointerBits === 32) check.push("if (*value < INT32_MIN || *value > INT32_MAX) return 0;");
			if(dynamic(type))
			{
				const width = ["nat", "int"].includes(type.name) ? "sizeof(uint32_t)" : "1";
				check.push(`if ((value->length && !value->data) || !lb_charge(budget, value->length, ${width})) return 0;`);
				if(type.name === "string") check.push("if (!lb_utf8((const uint8_t *)value->data, value->length)) return 0;");
			}
			if(type.name === "unit") input.push("return lean_box(0);");
			else if(type.name === "string") input.push('return lean_mk_string_from_bytes(value->length ? value->data : "", value->length);');
			else if(type.name === "bytes") input.push("return lb_bytes_in(value->data, value->length);");
			else if(type.name === "nat") input.push("return lb_nat_in(value->data, value->length);");
			else if(type.name === "int") input.push("return lb_int_in(value->data, value->length, value->negative);");
			else input.push(`return (${n})*value;`);
			if(type.name === "string" || type.name === "bytes")
			{
				output.push(`size_t length = ${type.name === "string" ? "lean_string_size(value) - 1" : "lean_sarray_size(value)"};`
					, "if (!lb_charge(budget, length, 1)) return 0;", "void *data = length ? malloc(length) : NULL;"
					, "if (length && !data) return -1;"
					, `if (length) memcpy(data, ${type.name === "string" ? "lean_string_cstr(value)" : "lean_sarray_cptr(value)"}, length);`
					, `*out = (${c.name}){data, length, data, free};`);
			} else if(type.name === "nat" || type.name === "int")
			{
				if(type.name === "int") output.push("bool negative = lean_int_lt(value, lean_box(0));", "lean_object *magnitude = lean_nat_abs(value);");
				output.push("uint32_t *data = NULL; size_t length = 0;"
					, `int status = lb_nat_out(${type.name === "int" ? "magnitude" : "value"}, &data, &length, *budget);`);
				if(type.name === "int") output.push("lean_dec(magnitude);");
				output.push("if (status != 1) return status;", "*budget -= length * sizeof(uint32_t);"
					, `*out = (${c.name}){data, length, data, free${type.name === "int" ? ", negative" : ""}};`);
			} else if(type.name === "char") output.push("if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return -2;", "*out = value;");
			else if(type.name === "unit") output.push("*out = 0;");
			else if(type.name === "isize") output.push(`int${model.pointerBits}_t signed_value; memcpy(&signed_value, &value, sizeof(value));`, "*out = signed_value;");
			else if(/^int\d/.test(type.name)) output.push("memcpy(out, &value, sizeof(value));");
			else output.push(`*out = (${c.name})value;`);
		} else if(type.kind === "array" || type.kind === "list")
		{
			const element = copy(type.element), child = id(type.element);
			const list = type.kind === "list", helper = `lb_t${nativeTypeKey(type)}`;
			const items = list ? "items" : "value", release = list ? "lean_dec(items); " : "";
			const width = `((sizeof(${element.name}) > sizeof(void *)) ? sizeof(${element.name}) : sizeof(void *))`;
			check.push(`if ((value->length && !value->data) || !lb_charge(budget, value->length, ${width})) return 0;`
				, `for (size_t i = 0; i < value->length; ++i) if (!${child}_check(&value->data[i], budget)) return 0;`);
			input.push("lean_object *result = lean_alloc_array(value->length, value->length);"
				, `for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, ${boxed(type.element, `${child}_in(&value->data[i])`)});`
				, list ? `return ${helper}_from_array(result);` : "return result;");
			extra.push(`typedef struct { size_t length; ${element.name} data[]; } ${key}_owner;`
				, `static void ${key}_release(void *raw) {`, `  ${key}_owner *owner = raw;`
				, ...(element.aggregate ? [`  for (size_t i = 0; i < owner->length; ++i) ${element.name}_clear(&owner->data[i]);`] : [])
				, "  free(owner);", "}");
			if(list) output.push("lean_inc(value);", `lean_object *items = ${helper}_to_array(value);`);
			output.push(`size_t length = lean_array_size(${items});`
				, `if (!lb_charge(budget, length, ${width}) || !lb_charge(budget, 1, sizeof(${key}_owner))) { ${release}return 0; }`
				, `if (!length) { ${release}*out = (${c.name}){0}; return 1; }`
				, `${key}_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(${element.name}));`
				, `if (!owner) { ${release}return -1; }`, "owner->length = length;"
				, "for (size_t i = 0; i < length; ++i) {"
				, `  int status = ${child}_out(${unboxed(type.element, `lean_array_get_core(${items}, i)`)}, &owner->data[i], budget);`
				, `  if (status != 1) { ${release}${key}_release(owner); return status; }`, "}"
				, ...(list ? ["lean_dec(items);"] : [])
				, `*out = (${c.name}){owner->data, length, owner, ${key}_release};`);
		} else if(type.kind === "variant")
		{
			const helper = `lb_t${nativeTypeKey(type)}`;
			check.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`, "switch (value->kind) {");
			input.push("switch (value->kind) {");
			output.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`);
			if(nativeObjectType(type)) output.push("lean_inc(value);");
			output.push(`uint32_t kind = ${helper}_tag(value);`, `if (kind >= ${type.cases.length}) return -3;`
				, `*out = (${c.name}){0};`, "out->kind = kind;", "switch (kind) {");
			type.cases.forEach((branch, i) => {
				const member = c.cases[i];
				check.push(`case ${i}:`); input.push(`case ${i}:`); output.push(`case ${i}: {`);
				const args = branch.fields.map((field, j) => {
					const slot = `cases.${member.name}.${member.fields[j].name}`;
					check.push(`  if (!${id(field.type)}_check(&value->${slot}, budget)) return 0;`);
					if(nativeObjectType(type)) output.push("  lean_inc(value);");
					output.push(`  ${nativeCType(field.type)} field${j} = ${helper}_get${i}_${j}(value);`
						, `  int status${j} = ${id(field.type)}_out(field${j}, &out->${slot}, budget);`);
					if(nativeObjectType(field.type)) output.push(`  lean_dec(field${j});`);
					output.push(`  if (status${j} != 1) { ${c.name}_clear(out); return status${j}; }`);
					return `${id(field.type)}_in(&value->${slot})`;
				});
				check.push("  break;");
				input.push(`  return ${helper}_make${i}(${args.join(", ") || "lean_box(0)"});`);
				output.push("  break;", "}");
			});
			check.push("default: return 0;", "}");
			input.push("default: abort();", "}");
			output.push("default: return -3;", "}");
		} else
		{
			const fields = type.kind === "record" ? type.fields : (type.element ? [type.element] : type.arguments).map(type => ({ type }));
			const flag = { option: "has_value", result: "is_ok" }[type.kind];
			const condition = i => flag ? `${i === 1 ? "!" : ""}value->${flag}` : "1";
			check.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`);
			if(flag) check.push(`if (value->${flag} > 1) return 0;`);
			for(const [i, field] of fields.entries()) check.push(`if (${condition(i)} && !${id(field.type)}_check(&value->${c.fields[i].name}, budget)) return 0;`);
			const args = fields.map((field, i) => `${id(field.type)}_in(&value->${c.fields[i].name})`), helper = `lb_t${nativeTypeKey(type)}`;
			if(type.kind === "option") input.push(`return value->has_value ? ${helper}_some(${args[0]}) : ${helper}_none(lean_box(0));`);
			else if(type.kind === "result") input.push(`return value->is_ok ? ${helper}_ok(${args[0]}) : ${helper}_error(${args[1]});`);
			else input.push(`return ${helper}_make(${args.join(", ") || "lean_box(0)"});`);
			output.push(`if (!lb_charge(budget, 1, sizeof(${c.name}))) return 0;`, `*out = (${c.name}){0};`);
			if(flag)
			{
				if(nativeObjectType(type)) output.push("lean_inc(value);");
				output.push(`out->${flag} = ${helper}_has(value);`);
			}
			for(const [i, field] of fields.entries())
			{
				if(flag) output.push(`if (${i === 1 ? "!" : ""}out->${flag}) {`);
				if(nativeObjectType(type)) output.push("lean_inc(value);");
				output.push(`${nativeCType(field.type)} field${i} = lb_t${nativeTypeKey(type)}_get${i}(value);`
					, `int status${i} = ${id(field.type)}_out(field${i}, &out->${c.fields[i].name}, budget);`);
				if(nativeObjectType(field.type)) output.push(`lean_dec(field${i});`);
				output.push(`if (status${i} != 1) { ${c.name}_clear(out); return status${i}; }`);
				if(flag) output.push("}");
			}
		}
		return [...extra
			, `static inline int ${key}_check(const ${c.name} *value, size_t *budget) {`
			, "  (void)value; (void)budget;", ...check.map(line => `  ${line}`)
			, "  return 1;", "}"
			, `static inline ${n} ${key}_in(const ${c.name} *value) {`
			, "  (void)value;", ...input.map(line => `  ${line}`), "}"
			, `static inline int ${key}_out(${n} value, ${c.name} *out, size_t *budget) {`
			, "  (void)value; (void)budget;", ...output.map(line => `  ${line}`)
			, "  return 1;", "}"].join("\n");
	});
	const exports = new Map(model.exports.map(item => [`lean:${item.name}`, item]));
	const calls = surface.functions.filter(fn => ![...fn.declaration.parameters, fn.declaration.result].some(site => surface.callbacks.has(site.type.id))).map(fn => {
		const native = exports.get(fn.declaration.id), lines = [`static ${p}_status lb_call_${fn.field}(${fn.signature}) {`
			, "  (void)context; size_t budget = 16u * 1024u * 1024u;"
			, `  if (lb_ready(error) != ${macro}_STATUS_OK) return ${macro}_STATUS_UNEXPECTED_ERROR;`];
		const args = fn.parameters.map(({ name }, i) => {
			const type = native.parameters[i].type, value = copy(type).aggregate ? name : `&${name}`;
			lines.push(`  if (!${id(type)}_check(${value}, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");`);
			return `${id(type)}_in(${value})`;
		});
		lines.push(`  ${nativeCType(native.result)} value = ${native.symbol}(${args.join(", ") || "lean_box(0)"});`);
		if(native.result.kind !== "primitive" || native.result.name !== "unit")
		{
			lines.push(`  ${copy(native.result).name} result = {0};`, `  int status = ${id(native.result)}_out(value, &result, &budget);`);
			if(nativeObjectType(native.result)) lines.push("  lean_dec(value);");
			lines.push('  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");'
				, '  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");'
				, ...(model.types.some(type => type.kind === "variant") ? ['  if (status == -3) return lb_failure(error, "Invalid native variant result");'] : [])
				, '  if (status < 0) return lb_failure(error, "Cannot allocate copied result");'
				, `  if (lb_ready(error) != ${macro}_STATUS_OK) { ${copy(native.result).aggregate ? `${copy(native.result).name}_clear(&result); ` : ""}return ${macro}_STATUS_UNEXPECTED_ERROR; }`, "  *out = result;");
		} else lines.push("  lean_dec(value); (void)budget;", `  if (lb_ready(error) != ${macro}_STATUS_OK) return ${macro}_STATUS_UNEXPECTED_ERROR;`);
		lines.push(`  if (error) *error = (${p}_error){0};`, `  return ${macro}_STATUS_OK;`, "}");
		return lines.join("\n");
	});
	return `${definitions.join("\n\n")}\n\n${calls.join("\n\n")}`;
};
