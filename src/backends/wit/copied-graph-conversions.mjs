/**
 * Convert finite typed WIT arenas to native copied graphs and independent results.
 *
 * @file
 */
import { fixedPlatformInteger } from "../../abi/component-scalars.mjs";
import { renderWitConversions, witConversionPrelude } from "./copied-conversions.mjs";
import { witGraphRuntime } from "./copied-graph-runtime.mjs";

// Extend the private scope without changing the established acyclic ABI. Each
// replacement is checked so a shared helper change cannot drop error tracking.
const graphPrelude = () => {
	let source = witConversionPrelude;
	for(const [before, after] of [
		["typedef struct { size_t remaining; lb_allocation *allocations; } lb_scope;", "typedef struct { size_t remaining; lb_allocation *allocations; unsigned failure; } lb_scope;"]
		, ["if (count && width > scope->remaining / count) return false;", "if (count && width > scope->remaining / count) { scope->failure = 2; return false; }"]
		, ["if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) return NULL;", "if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) { scope->failure = 2; return NULL; }"]
		, ["if (!allocation) return NULL;", "if (!allocation) { scope->failure = 3; return NULL; }"]
	]) {
		if(source.split(before).length !== 2) throw new Error("WIT graph conversion prelude changed; review bounded allocation tracking");
		source = source.replace(before, after);
	}
	return source;
};

const stringConversions = node => `
static inline bool lb_in_${node.index}(const wasmtime_component_val_t *value, lb_scope *scope, ${node.name} *out) {
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || value->kind != WASMTIME_COMPONENT_STRING || !lb_charge(scope, 1, sizeof(*value)) || !lb_charge(scope, value->of.string.size, 2) || !lb_utf8(value->of.string.data, value->of.string.size)) return false;
  if (out) {
    char *text = lb_alloc(scope, value->of.string.size, 1);
    if (value->of.string.size && !text) return false;
    if (value->of.string.size) memcpy(text, value->of.string.data, value->of.string.size);
    *out = (${node.name}){.data = text, .length = value->of.string.size};
  }
  return true;
}
static inline bool lb_out_${node.index}(const ${node.name} *value, lb_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(${node.name})) || !lb_charge(scope, 1, sizeof(*out)) || !lb_charge(scope, value->length, 1) || !lb_utf8(value->data, value->length)) return false;
  out->kind = WASMTIME_COMPONENT_STRING; wasm_name_new(&out->of.string, value->length, value->data); return true;
}
`;

/**
 * Generate bounded input validation, copied native views and owned WIT results.
 * The caller closes each scope and releases native result owners independently.
 * Decode with a null output performs the same traversal before Wasmtime copying.
 *
 * @param model - A compiled copied WIT graph model with native layout descriptors.
 */
export const renderWitGraphConversions = model => {
	const nodes = new Map(model.nodes.map(node => [node.id, node]));
	const tableIndex = new Map(model.tables.map((node, index) => [node.id, index]));
	const leaf = node => node.kind === "primitive";
	const scalarModel = { surface: { copies: model.nodes.filter(node => leaf(node) && node.ref.name !== "string").map(node => ({ ...node, scalarName: fixedPlatformInteger(node.ref.name, 64) })) } };
	const declarations = model.nodes.flatMap(node => [
		`static inline bool lb_graph_read_${node.index}(const wasmtime_component_val_t *, lb_graph_input *, unsigned, ${node.name} *);`
		, `static inline bool lb_graph_write_${node.index}(const ${node.name} *, lb_graph_output *, unsigned, wasmtime_component_val_t *);`
	]);
	const inputField = (field, value, target, label) => {
		const child = nodes.get(field.type), pointer = field.storage === "pointer";
		return [
			...pointer ? [
				`if (!lb_charge(&context->scope->memory, 1, sizeof(${child.name}))) return false;`
				, `${child.name} *${label} = out ? lb_alloc(&context->scope->memory, 1, sizeof(${child.name})) : NULL;`
				, `if (out && !${label}) return false;`
				, `if (out) ${target} = ${label};`
			] : []
			, `if (!lb_graph_read_${child.index}(${value}, context, depth + 1, ${pointer ? label : `out ? &${target} : NULL`})) return false;`
		];
	};
	const outputField = (field, value, target) => {
		const child = nodes.get(field.type);
		return `if (!lb_graph_write_${child.index}(${field.storage === "pointer" ? value : `&${value}`}, context, depth + 1, ${target})) return false;`;
	};
	const definitions = model.nodes.map(node => {
		const input = [], output = [], row = node.rowCopy;
		if(leaf(node))
		{
			input.push(`return lb_in_${node.index}(value, &context->scope->memory, out);`);
			output.push(`return lb_out_${node.index}(value, &context->scope->memory, out);`);
		}
		else
		{
			input.push(`value = lb_graph_dereference(context, ${tableIndex.get(node.id)}, value);`, "if (!value) return false;");
			output.push(`out = lb_graph_append(context, ${tableIndex.get(node.id)}, value, out);`, "if (!out) return false;");
			if(node.element)
			{
				const child = nodes.get(node.element);
				input.push("if (value->kind != WASMTIME_COMPONENT_LIST) return false;"
					, "size_t count = value->of.list.size;"
					, `if (count > context->scope->nodes || !lb_buffer(value->of.list.data, count, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(&context->scope->memory, count, sizeof(${child.name}) + sizeof(wasmtime_component_val_t))) return false;`
					, `${child.name} *items = out ? lb_alloc(&context->scope->memory, count, sizeof(${child.name})) : NULL;`
					, "if (out && count && !items) return false;"
					, "if (out) { out->data = items; out->length = count; }"
					, `for (size_t i = 0; i < count; ++i) if (!lb_graph_read_${child.index}(&value->of.list.data[i], context, depth + 1, out ? &items[i] : NULL)) return false;`);
				output.push(`if (!lb_graph_count(context->scope, value->length) || !lb_buffer(value->data, value->length, sizeof(${child.name}), _Alignof(${child.name})) || !lb_charge(&context->scope->memory, value->length, sizeof(wasmtime_component_val_t))) return false;`
					, "out->kind = WASMTIME_COMPONENT_LIST;"
					, "wasmtime_component_vallist_new_uninit(&out->of.list, value->length);"
					, "if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));"
					, `for (size_t i = 0; i < value->length; ++i) if (!lb_graph_write_${child.index}(&value->data[i], context, depth + 1, &out->of.list.data[i])) return false;`);
			}
			else if(node.kind === "variant")
			{
				input.push("if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;");
				output.push(`if (value->kind >= ${node.cases.length}) return false;`
					, "out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};"
					, "switch (value->kind) {");
				for(const [index, branch] of node.cases.entries())
				{
					const projected = row.cases[index], count = branch.fields.length;
					input.push(`${index ? "else " : ""}if (lb_name(&value->of.variant.discriminant, "${projected.witName}")) {`
						, `if (out) out->kind = ${index};`);
					output.push(`case ${index}: {`
						, `if (!lb_charge(&context->scope->memory, ${projected.witName.length}, 1)) return false;`
						, `wasm_name_new(&out->of.variant.discriminant, ${projected.witName.length}, "${projected.witName}");`);
					if(count)
					{
						input.push("const wasmtime_component_val_t *payload = value->of.variant.val;"
							, `if (!lb_graph_record_in(payload, ${count}, context->scope)) return false;`);
						output.push("if (!lb_charge(&context->scope->memory, 1, sizeof(wasmtime_component_val_t))) return false;"
							, "wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);"
							, "wasmtime_component_val_t *payload = out->of.variant.val;"
							, `if (!lb_graph_record_out(payload, ${count}, context->scope)) return false;`);
						for(const [position, field] of branch.fields.entries())
						{
							const member = projected.fields[position].witName;
							input.push(`if (!lb_name(&payload->of.record.data[${position}].name, "${member}")) return false;`
								, ...inputField(field, `&payload->of.record.data[${position}].val`, `out->cases.${branch.name}.${field.name}`, `child${position}`));
							output.push(`if (!lb_graph_field_out(&payload->of.record.data[${position}], "${member}", context->scope)) return false;`
								, outputField(field, `value->cases.${branch.name}.${field.name}`, `&payload->of.record.data[${position}].val`));
						}
					}
					else input.push("if (value->of.variant.val) return false;");
					input.push("}"); output.push("break;", "}");
				}
				input.push("else return false;"); output.push("}");
			}
			else if(node.kind === "option" || node.kind === "result")
			{
				const option = node.kind === "option", flag = option ? "has_value" : "is_ok";
				input.push(`if (value->kind != WASMTIME_COMPONENT_${option ? "OPTION" : "RESULT"}) return false;`);
				if(option) input.push("bool present = value->of.option != NULL;");
				else input.push("bool present; if (!value->of.result.val || !lb_boolean(&value->of.result.is_ok, &present)) return false;");
				input.push(`if (out) out->${flag} = present;`);
				output.push(`if (value->${flag} > 1) return false;`
					, `out->kind = WASMTIME_COMPONENT_${option ? "OPTION" : "RESULT"};`
					, ...option ? ["out->of.option = NULL;", "if (value->has_value) {"] : ["out->of.result.is_ok = value->is_ok;"]
					, "if (!lb_charge(&context->scope->memory, 1, sizeof(wasmtime_component_val_t))) return false;"
					, `wasmtime_component_val_t empty = {0}; out->of.${option ? "option" : "result.val"} = wasmtime_component_val_new(&empty);`);
				for(const [index, field] of node.fields.entries())
				{
					const payload = option ? "option" : "result.val";
					input.push(`${index ? "else " : ""}if (${index ? "!" : ""}present) {`
						, ...inputField(field, `value->of.${payload}`, `out->${field.name}`, `child${index}`), "}");
					if(!option) output.push(`${index ? "else " : ""}if (${index ? "!" : ""}value->${flag}) {`);
					output.push(outputField(field, `value->${field.name}`, `out->of.${payload}`), "}");
				}
			}
			else if(node.kind === "tuple")
			{
				input.push("if (value->kind != WASMTIME_COMPONENT_TUPLE || value->of.tuple.size != 2 || !lb_buffer(value->of.tuple.data, 2, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(&context->scope->memory, 2, sizeof(wasmtime_component_val_t))) return false;");
				output.push("if (!lb_charge(&context->scope->memory, 2, sizeof(wasmtime_component_val_t))) return false;"
					, "out->kind = WASMTIME_COMPONENT_TUPLE; wasmtime_component_valtuple_new_uninit(&out->of.tuple, 2);"
					, "memset(out->of.tuple.data, 0, 2 * sizeof(*out->of.tuple.data));");
				for(const [index, field] of node.fields.entries())
				{
					input.push(...inputField(field, `&value->of.tuple.data[${index}]`, `out->${field.name}`, `child${index}`));
					output.push(outputField(field, `value->${field.name}`, `&out->of.tuple.data[${index}]`));
				}
			}
			else if(node.fields.length)
			{
				input.push(`if (!lb_graph_record_in(value, ${node.fields.length}, context->scope)) return false;`);
				output.push(`if (!lb_graph_record_out(out, ${node.fields.length}, context->scope)) return false;`);
				for(const [index, field] of node.fields.entries())
				{
					const member = row.fields[index].witName;
					input.push(`if (!lb_name(&value->of.record.data[${index}].name, "${member}")) return false;`
						, ...inputField(field, `&value->of.record.data[${index}].val`, `out->${field.name}`, `child${index}`));
					output.push(`if (!lb_graph_field_out(&out->of.record.data[${index}], "${member}", context->scope)) return false;`
						, outputField(field, `value->${field.name}`, `&out->of.record.data[${index}].val`));
				}
			}
			else
			{
				input.push('if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "empty")) return false;');
				output.push('if (!lb_charge(&context->scope->memory, 5, 1)) return false;', 'out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 5, "empty");');
			}
			input.push("--context->active;", "return true;"); output.push("--context->active;", "return true;");
		}
		return `static inline bool lb_graph_read_${node.index}(const wasmtime_component_val_t *value, lb_graph_input *context, unsigned depth, ${node.name} *out) {
  (void)out;
  if (!lb_graph_visit(context->scope, depth, sizeof(${node.name}) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
${input.map(line => `  ${line}`).join("\n")}
}
static inline bool lb_graph_write_${node.index}(const ${node.name} *value, lb_graph_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!lb_graph_visit(context->scope, depth, sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(${node.name}))) return false;
${output.map(line => `  ${line}`).join("\n")}
}`;
	});
	const roots = new Set(model.layout.roots.flatMap(root => [...root.parameters, root.result]));
	const wrappers = model.nodes.filter(node => roots.has(node.id)).map(node => `
static inline bool lb_graph_decode_${node.index}(const wasmtime_component_val_t *value, lb_graph_scope *scope, ${node.name} *out) {
  if (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(${node.name}))) return false;
  ${node.name} converted = {0};
${leaf(node) ? `  lb_graph_input context = {.scope = scope};
  if (!lb_graph_read_${node.index}(value, &context, 0, out ? &converted : NULL)) return false;` : `  lb_graph_input *context = lb_graph_open(value, scope);
  if (!context || !lb_graph_read_${node.index}(&value->of.record.data[0].val, context, 0, out ? &converted : NULL) || context->visited != context->total) return false;`}
  if (out) *out = converted;
  return true;
}
static inline bool lb_graph_encode_${node.index}(const ${node.name} *value, lb_graph_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t converted = {0};
${leaf(node) ? `  lb_graph_output context = {.scope = scope};
  bool valid = lb_graph_write_${node.index}(value, &context, 0, &converted);` : `  if (!lb_charge(&scope->memory, 1, sizeof(lb_graph_output))) return false;
  lb_graph_output *context = lb_alloc(&scope->memory, 1, sizeof(*context));
  if (!context) return false;
  context->scope = scope;
  bool valid = lb_graph_record_out(&converted, 2, scope)
    && lb_graph_field_out(&converted.of.record.data[0], "root", scope)
    && lb_graph_field_out(&converted.of.record.data[1], "nodes", scope)
    && lb_graph_write_${node.index}(value, context, 0, &converted.of.record.data[0].val)
    && lb_graph_finish(context, &converted.of.record.data[1].val);
  lb_graph_output_close(context);`}
  if (valid) *out = converted; else wasmtime_component_val_delete(&converted);
  return valid;
}
`);
	return graphPrelude() + renderWitConversions(scalarModel) + model.nodes.filter(node => node.ref.name === "string").map(stringConversions).join("\n") + witGraphRuntime(model)
		+ declarations.join("\n") + "\n" + definitions.join("\n\n") + wrappers.join("\n");
};
