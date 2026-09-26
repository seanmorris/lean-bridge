/**
 * Checked resource-bearing native values and transactional compiled Lean calls.
 * Public host projection and installed package admission are separate layers.
 *
 * @file
 */
import { generateOwnedAggregateCarriers } from "../../build/owned-aggregate-carriers.mjs";
import { compileOwnedNativeValueLayout } from "./owned-value-layout.mjs";
import { ownedNativeValueRuntime } from "./owned-value-runtime.mjs";

const suffix = name => ({ uint32: "_uint32", int32: "_uint32", char: "_uint32"
	, uint64: "_uint64", int64: "_uint64", usize: "_usize", isize: "_usize"
	, float32: "_float32", float64: "_float" }[name] ?? "");

/**
 * Regenerate typed carriers from retained compiler evidence, then bind native
 * walkers to those exact signatures. Resource leaves never enter a copied ABI.
 * C callers must supply readable native objects for their stated spans.
 *
 * @param options - Fresh metadata, source identity and component coordinates.
 */
export const generateOwnedNativeValueAdapters = options => {
	const carriers = generateOwnedAggregateCarriers(options);
	const layout = compileOwnedNativeValueLayout(carriers.model.bindingIr);
	const table = new Map(layout.nodes.map(node => [node.id, node]));
	const helper = node => carriers.symbols.types[node.id];
	const lines = ['#include "owned-values.h"', '#include "carriers.h"'
		, ownedNativeValueRuntime(layout.model.limits)];
	for(const node of layout.nodes) lines.push(
		`static inline int ${node.walker}_in(const ${node.cName} *, size_t, int, ov_transaction *, lean_object **);`
		, `static inline int ${node.walker}_out(${node.cName} *, lean_object *, size_t, ov_transaction *);`
	);
	for(const node of layout.nodes)
	{
		const input = ["*out = NULL;"
			, `if (!ov_pointer(value, sizeof(*value), _Alignof(${node.cName}))) return LB_OWNED_INVALID;`
			, `int status = ov_enter(&transaction->budget, value, ${node.index}, depth);`
			, "if (!status && storage) status = ov_charge(&transaction->budget, 1, sizeof(*value));"
			, "if (status) return status;"
		];
		const output = ["int status = ov_visit(&transaction->budget, depth);"
			, "if (status) { if (value) lean_dec(value); return status; }"
			, "if (!ov_carrier(value)) { if (value) lean_dec(value); return OV_RESULT; }"
		];
		const extras = [];
		const address = (field, expression) => field.pointer ? expression : `&${expression}`;
		const childInput = (field, expression, result) => `${table.get(field.type).walker}_in(${address(field, expression)}, depth + 1, ${field.pointer ? 1 : 0}, transaction, ${result})`;
		const construct = (fields, action, slots) => {
			if(!fields.length) return [`return ov_finish(${helper(node)}_${action}(lean_box(0)), out);`];
			// Wide constructor arguments live only in a nonrecursive invocation frame.
			const name = `${node.walker}_${action}`;
			extras.push(`__attribute__((noinline)) static lean_object *${name}(lean_object *items) {`);
			fields.forEach((_, i) => extras.push(`  lean_object *a${i} = lean_array_get_core(items, ${i}); lean_inc(a${i});`));
			extras.push("  lean_dec(items);", `  return ${helper(node)}_${action}(${fields.map((_, i) => `a${i}`).join(", ")});`, "}");
			return [`lean_object *items = lean_alloc_array(0, ${fields.length});`
				, "lean_object *child = NULL;"
				, ...fields.flatMap((field, i) => [
					`status = ${childInput(field, slots[i], "&child")};`
					, "if (status) { lean_dec(items); return status; }"
					, "items = lean_array_push(items, child);"
				])
				, `return ov_finish(${name}(items), out);`];
		};
		const emitChild = (field, action, target) => {
			const child = table.get(field.type);
			return ["if (!status) {"
				, ...field.pointer ? ["  void *raw = NULL;", `  status = ov_allocate(transaction, 1, sizeof(${child.cName}), &raw);`, `  ${target} = raw;`] : []
				, "  if (!status) {", "    lean_inc(value);"
				, `    status = ${child.walker}_out(${field.pointer ? "raw" : `&${target}`}, ${helper(node)}_${action}(value), depth + 1, transaction);`
				, "  }", "}"];
		};
		if(node.kind === "primitive")
		{
			const scalar = node.name, signed = scalar.startsWith("int") || scalar === "isize";
			const limbs = ["nat", "int"].includes(scalar);
			const dynamic = limbs || ["string", "bytes"].includes(scalar);
			if(scalar === "unit") input.push("if (*value) return LB_OWNED_INVALID;");
			if(scalar === "bool") input.push("if (*value > 1) return LB_OWNED_INVALID;");
			if(scalar === "char") input.push("if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return LB_OWNED_INVALID;");
			if(dynamic)
			{
				input.push(`status = ov_span(&transaction->budget, value->data, value->length, ${limbs ? "sizeof(uint32_t), _Alignof(uint32_t)" : "1, 1"});`, "if (status) return status;");
				if(scalar === "string") input.push("if (!ov_utf8((const uint8_t *)value->data, value->length)) return LB_OWNED_INVALID;");
				if(scalar === "int") input.push("if (value->negative > 1) return LB_OWNED_INVALID;");
			}
			let boxed;
			if(scalar === "unit") boxed = "lean_box(0)";
			else if(scalar === "string") boxed = 'lean_mk_string_from_bytes(value->length ? value->data : "", value->length)';
			else if(scalar === "bytes")
			{
				input.push("lean_object *bytes = lean_alloc_sarray(1, value->length, value->length);", "if (value->length) memcpy(lean_sarray_cptr(bytes), value->data, value->length);");
				boxed = "bytes";
			}
			else if(scalar === "nat") boxed = "ov_nat_in(value->data, value->length)";
			else if(scalar === "int")
			{
				input.push("lean_object *integer = lean_nat_to_int(ov_nat_in(value->data, value->length));", "if (value->negative) { lean_object *negative = lean_int_neg(integer); lean_dec(integer); integer = negative; }");
				boxed = "integer";
			}
			else boxed = `lean_box${suffix(scalar)}((${signed ? scalar === "isize" ? "size_t" : `u${node.cName}` : node.cName})*value)`;
			input.push(`return ov_finish(ov_carry(${boxed}), out);`);
			output.push("lean_object *child = lean_array_get_core(value, 0); lean_inc(child); lean_dec(value);");
			if(scalar === "string" || scalar === "bytes")
			{
				output.push(`if (lean_is_scalar(child) || !${scalar === "string" ? "lean_is_string" : "lean_is_sarray"}(child)) { lean_dec(child); return OV_RESULT; }`
					, ...scalar === "bytes" ? ["if (lean_sarray_elem_size(child) != 1) { lean_dec(child); return OV_RESULT; }"] : []
					, `size_t length = ${scalar === "string" ? "lean_string_size(child) - 1" : "lean_sarray_size(child)"};`
					, ...scalar === "string" ? ["if (!ov_utf8((const uint8_t *)lean_string_cstr(child), length)) { lean_dec(child); return OV_RESULT; }"] : []
					, "void *data = NULL;", "status = ov_allocate(transaction, length, 1, &data);"
					, "if (!status) {"
					, `  if (length) memcpy(data, ${scalar === "string" ? "lean_string_cstr(child)" : "lean_sarray_cptr(child)"}, length);`
					, "  out->data = data; out->length = length;", "}");
			}
			else if(limbs)
			{
				output.push("if (!lean_is_scalar(child) && !lean_is_mpz(child)) { lean_dec(child); return OV_RESULT; }");
				if(scalar === "int") output.push("out->negative = lean_int_lt(child, lean_box(0));", "lean_object *magnitude = lean_nat_abs(child); lean_dec(child); child = magnitude;");
				output.push("status = ov_nat_out(child, transaction, &out->data, &out->length);");
			}
			else
			{
				const bound = { unit: "0", bool: "1", uint8: "UINT8_MAX", int8: "UINT8_MAX"
					, uint16: "UINT16_MAX", int16: "UINT16_MAX"
					, uint32: "UINT32_MAX", int32: "UINT32_MAX", char: "0x10ffff" }[scalar];
				const width = { uint64: 8, int64: 8, usize: 8, isize: 8, float32: 4, float64: 8 }[scalar];
				if(bound) output.push(`if (!lean_is_scalar(child) || lean_unbox(child) > ${bound}) { lean_dec(child); return OV_RESULT; }`);
				if(width) output.push(`if (lean_is_scalar(child) || !lean_is_ctor(child) || lean_ptr_tag(child) != 0 || lean_ctor_num_objs(child) != 0 || lean_object_byte_size(child) < sizeof(lean_ctor_object) + ${width}) { lean_dec(child); return OV_RESULT; }`);
				if(signed) output.push(`${scalar === "isize" ? "size_t" : `u${node.cName}`} bits = lean_unbox${suffix(scalar)}(child);`, "memcpy(out, &bits, sizeof(*out));");
				else output.push(`*out = (${node.cName})lean_unbox${suffix(scalar)}(child);`);
				if(scalar === "char") output.push("if (*out >= 0xd800 && *out <= 0xdfff) status = OV_RESULT;");
			}
			output.push("lean_dec(child); return status;");
		}
		else if(node.kind === "resource" || node.kind === "callback")
		{
			input.push("lean_object *child = NULL;"
				, `status = lb_owned_scope_borrow(&transaction->scope, ${JSON.stringify(node.identityKind)}, value->token, &child);`
				, "if (status) return status;", "lean_inc(child); return ov_finish(ov_carry(child), out);");
			output.push("lean_object *child = lean_array_get_core(value, 0);"
				, "if (lean_is_scalar(child)) { lean_dec(value); return OV_RESULT; }"
				, ...node.kind === "callback" ? ["if (lean_is_scalar(child) || !lean_is_closure(child)) { lean_dec(value); return OV_RESULT; }"] : []
				, `status = lb_owned_scope_acquire(&transaction->scope, ${JSON.stringify(node.identityKind)}, child, &out->token);`
				, "lean_dec(value); return status;");
		}
		else if(node.element)
		{
			const child = table.get(node.element);
			input.push("if (value->length > transaction->budget.visits) return LB_OWNED_LIMIT;"
				, `status = ov_span(&transaction->budget, value->data, value->length, sizeof(${child.cName}), _Alignof(${child.cName}));`
				, "if (status) return status;", "lean_object *items = lean_alloc_array(0, value->length);"
				, "for (size_t i = 0; i < value->length; ++i) {", "  lean_object *child = NULL;"
				, `  status = ${child.walker}_in(value->data + i, depth + 1, 0, transaction, &child);`
				, "  if (status) { lean_dec(items); return status; }", "  items = lean_array_push(items, child);", "}"
				, `return ov_finish(${helper(node)}_make(items), out);`);
			output.push(`size_t limit = transaction->budget.bytes / sizeof(${child.cName});`
				, "if (limit > transaction->budget.visits) limit = transaction->budget.visits;"
				, `if (depth == ${layout.model.limits.depth}) limit = 0;`
				, ...["resource", "callback"].includes(child.kind) ? [
					"size_t remaining = LB_OWNED_RETAINED_LIMIT - transaction->scope.retained;"
					, "if (limit > remaining) limit = remaining;"
				] : []
				, `value = ${helper(node)}_itemsBounded(value, lean_box(limit));`
				, "if (!value || lean_is_scalar(value) || !lean_is_array(value)) { if (value) lean_dec(value); return OV_RESULT; }"
				, "size_t count = lean_array_size(value);"
				, "if (count > limit) { lean_dec(value); return LB_OWNED_LIMIT; }"
				, "void *raw = NULL;", `status = ov_allocate(transaction, count, sizeof(${child.cName}), &raw);`
				, `out->data = raw; out->length = count; ${child.cName} *data = raw;`
				, "for (size_t i = 0; !status && i < count; ++i) {"
				, "  lean_object *child = lean_array_get_core(value, i); lean_inc(child);"
				, `  status = ${child.walker}_out(data + i, child, depth + 1, transaction);`, "}"
				, "lean_dec(value); return status;");
		}
		else if(node.kind === "variant")
		{
			input.push("switch (value->tag) {");
			output.push("lean_inc(value);", `uint32_t tag = ${helper(node)}_branch(value);`, "out->tag = tag;", "switch (tag) {");
			node.cases.forEach((branch, i) => {
				input.push(`case ${i}: {`, ...construct(branch.fields, `make${i}`, branch.fields.map(field => `value->cases.${branch.name}.${field.name}`)), "}");
				output.push(`case ${i}: {`, ...branch.fields.flatMap((field, j) => emitChild(field, `case${i}_field${j}`, `out->cases.${branch.name}.${field.name}`)), "break;", "}");
			});
			input.push("default: return LB_OWNED_INVALID;", "}");
			output.push("default: status = OV_RESULT;", "}", "lean_dec(value); return status;");
		}
		else
		{
			const tagged = ["option", "result"].includes(node.kind), option = node.kind === "option";
			if(tagged)
			{
				input.push("if (value->tag > 1) return LB_OWNED_INVALID;");
				if(option) input.push(`if (!value->tag) return ov_finish(${helper(node)}_none(lean_box(0)), out);`);
				node.fields.forEach((field, i) => input.push(`if (value->tag == ${option ? 1 : i}) {`, "  lean_object *child = NULL;"
					, `  status = ${childInput(field, `value->${field.name}`, "&child")};`
					, "  if (status) return status;", `  return ov_finish(${helper(node)}_make${i}(child), out);`, "}"));
				input.push("return LB_OWNED_INVALID;");
				output.push("lean_inc(value);", `uint32_t tag = ${helper(node)}_branch(value);`
					, "if (tag > 1) { lean_dec(value); return OV_RESULT; }", "out->tag = (uint8_t)tag;");
			}
			else input.push(...construct(node.fields, "make", node.fields.map(field => `value->${field.name}`)));
			node.fields.forEach((field, i) => output.push(...tagged ? [
				`if (out->tag == ${option ? 1 : i}) {`
				, ...emitChild(field, `field${i}`, `out->${field.name}`), "}"
			] : emitChild(field, `field${i}`, `out->${field.name}`)));
			output.push("lean_dec(value); return status;");
		}
		lines.push(...extras
			, `static inline int ${node.walker}_in(const ${node.cName} *value, size_t depth, int storage, ov_transaction *transaction, lean_object **out) {`
			, ...input.map(line => `  ${line}`), "}"
			, `static inline int ${node.walker}_out(${node.cName} *out, lean_object *value, size_t depth, ov_transaction *transaction) {`
			, ...output.map(line => `  ${line}`), "}");
	}
	for(const declaration of [...layout.functions, ...layout.callbacks])
	{
		const result = table.get(declaration.result), parameters = declaration.parameters.map((type, i) => `const ${table.get(type).cName} *a${i}`);
		const callback = !carriers.symbols.exports[declaration.id];
		const symbol = callback ? `${carriers.symbols.types[declaration.id]}_apply` : carriers.symbols.exports[declaration.id];
		lines.push(`static inline int ${declaration.symbol}(lb_owned_context *context, ${[...parameters, `${result.cName} *out`, "ov_result_owner *owner"].join(", ")}) {`
			, `  if (!ov_pointer(out, sizeof(*out), _Alignof(${result.cName})) || !ov_pointer(owner, sizeof(*owner), _Alignof(ov_result_owner))) return LB_OWNED_INVALID;`
			, "  ov_transaction transaction = {0};"
			, `  int status = ov_begin(&transaction, context, owner, ${JSON.stringify(layout.model.component.id)});`
			, "  if (status) return status;"
			, "  status = ov_charge(&transaction.budget, 1, sizeof(*out));"
			, "  if (status) return ov_abort(&transaction, status);"
			, `  lean_object *arguments = lean_alloc_array(0, ${declaration.parameters.length});`
			, ...declaration.parameters.flatMap((type, i) => ["  {"
				, "    lean_object *child = NULL;"
				, `    status = ${table.get(type).walker}_in(a${i}, 0, 1, &transaction, &child);`
				, "    if (status) { lean_dec(arguments); return ov_abort(&transaction, status); }"
				, "    arguments = lean_array_push(arguments, child);", "  }"])
			, ...declaration.parameters.map((_, i) => `  lean_object *v${i} = lean_array_get_core(arguments, ${i}); lean_inc(v${i});`)
			, "  lean_dec(arguments);"
			, `  lean_object *returned = ${symbol}(${declaration.parameters.length ? declaration.parameters.map((_, i) => `v${i}`).join(", ") : "lean_box(0)"});`
			, "  status = lb_owned_scope_ready(&transaction.scope);"
			, "  if (status) { lean_dec(returned); return ov_abort(&transaction, status); }"
			, `  ${result.cName} converted = {0};`
			, `  status = ${result.walker}_out(&converted, returned, 0, &transaction);`
			, "  if (status) return ov_abort(&transaction, status);"
			, "  status = ov_commit(&transaction, owner);"
			, "  if (!status) *out = converted;", "  return status;", "}");
	}
	return { carriers, layout, typesHeader: layout.header, source: lines.join("\n") + "\n" };
};
