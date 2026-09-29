/**
 * Convert owned WIT node tables to private native views without copying identities.
 *
 * @file
 */
import { fixedPlatformInteger } from "../../abi/component-scalars.mjs";
import { renderWitConversions } from "./copied-conversions.mjs";
import { ownedWitGraphRuntime } from "./owned-graph-runtime.mjs";

/**
 * Render both borrowed-input and owned-output conversions. Each root carries
 * its own reachable tables. Native scratch storage belongs to the supplied
 * scope; resource leases belong to the session's checked identity hooks.
 *
 * @param model - A validated ownership-aware WIT graph and native value layout.
 */
export const renderOwnedWitGraphConversions = model => {
	const nodes = new Map(model.layout.nodes.map(node => [node.id, node]));
	const active = model.layout.nodes.filter(node => node.leaf || model.graph.rows.has(`input:${node.id}`) || model.graph.rows.has(`output:${node.id}`));
	const scalarModel = { surface: { copies: active.filter(node => node.kind === "primitive").map(node => ({
		index: node.index, name: node.cName
		, scalarName: fixedPlatformInteger(node.name, 64)
	})) } };
	const declarations = active.flatMap(node => [
		`static inline bool ow_read_${node.index}(const wasmtime_component_val_t *, ow_input *, unsigned, ${node.cName} *);`
		, `static inline bool ow_write_${node.index}(const ${node.cName} *, ow_output *, unsigned, wasmtime_component_val_t *);`
	]);
	const inputField = (field, value, target, label) => {
		const child = nodes.get(field.type);
		return [
			...field.pointer ? [
				`if (!lb_charge(&context->scope->memory, 1, sizeof(${child.cName}))) return false;`
				, `${child.cName} *${label} = out ? lb_alloc(&context->scope->memory, 1, sizeof(${child.cName})) : NULL;`
				, `if (out && !${label}) return false;`
				, `if (out) ${target} = ${label};`
			] : []
			, `if (!ow_read_${child.index}(${value}, context, depth + 1, ${field.pointer ? label : `out ? &${target} : NULL`})) return false;`
		];
	};
	const outputField = (field, value, target) => `if (!ow_write_${nodes.get(field.type).index}(${field.pointer ? value : `&${value}`}, context, depth + 1, ${target})) return false;`;
	const definitions = active.map(node => {
		const input = [], output = [];
		const row = model.graph.rows.get(`input:${node.id}`) ?? model.graph.rows.get(`output:${node.id}`);
		if(node.kind === "primitive")
		{
			input.push(`if (!lb_in_${node.index}(value, &context->scope->memory, out)) return false;`);
			if(node.name === "string") input.push("if (out && out->length) {"
				, "  char *text = lb_alloc(&context->scope->memory, out->length, 1);"
				, "  if (!text) return false;"
				, "  memcpy(text, out->data, out->length); out->data = text;", "}");
			input.push("return true;");
			output.push(`return lb_out_${node.index}(value, &context->scope->memory, out);`);
		}
		else if(node.leaf)
		{
			input.push("if (value->kind != WASMTIME_COMPONENT_RESOURCE || !value->of.resource || !context->scope->identities.read) return false;"
				, `if (!context->scope->identities.read(context->scope->identities.data, ${node.index}, context->borrowed, value, out ? &out->token : NULL)) return false;`
				, "return !out || out->token != 0;");
			output.push("if (!value->token || !context->scope->identities.write || !context->scope->identities.discard) return false;"
				, `if (!context->scope->identities.write(context->scope->identities.data, ${node.index}, context->borrowed, value->token, out)) return false;`
				, "return out->kind == WASMTIME_COMPONENT_RESOURCE && out->of.resource;");
		}
		else
		{
			input.push(`value = ow_dereference(context, ${node.index}, value);`, "if (!value) return false;");
			output.push(`out = ow_append(context, ${node.index}, value, out);`, "if (!out) return false;");
			if(node.element)
			{
				const child = nodes.get(node.element);
				input.push("if (value->kind != WASMTIME_COMPONENT_LIST) return false;"
					, "size_t count = value->of.list.size;"
					, `if (!ow_count(context->scope, count) || !lb_buffer(value->of.list.data, count, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(&context->scope->memory, count, sizeof(${child.cName}) + sizeof(wasmtime_component_val_t))) return false;`
					, `${child.cName} *items = out ? lb_alloc(&context->scope->memory, count, sizeof(${child.cName})) : NULL;`
					, "if (out && count && !items) return false;"
					, "if (out) { out->data = items; out->length = count; }"
					, `for (size_t i = 0; i < count; ++i) if (!ow_read_${child.index}(&value->of.list.data[i], context, depth + 1, out ? &items[i] : NULL)) return false;`);
				output.push(`if (!ow_count(context->scope, value->length) || !lb_buffer(value->data, value->length, sizeof(${child.cName}), _Alignof(${child.cName})) || !lb_charge(&context->scope->memory, value->length, sizeof(wasmtime_component_val_t))) return false;`
					, "out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);"
					, "if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));"
					, `for (size_t i = 0; i < value->length; ++i) if (!ow_write_${child.index}(&value->data[i], context, depth + 1, &out->of.list.data[i])) return false;`);
			}
			else if(node.kind === "variant")
			{
				input.push("if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;");
				output.push(`if (value->tag >= ${node.cases.length}) return false;`
					, "out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};"
					, "switch (value->tag) {");
				for(const [index, branch] of node.cases.entries())
				{
					const projected = row.cases[index], count = branch.fields.length;
					input.push(`${index ? "else " : ""}if (lb_name(&value->of.variant.discriminant, "${projected.witName}")) {`, `if (out) out->tag = ${index};`);
					output.push(`case ${index}: {`
						, `if (!lb_charge(&context->scope->memory, ${projected.witName.length}, 1)) return false;`
						, `wasm_name_new(&out->of.variant.discriminant, ${projected.witName.length}, "${projected.witName}");`);
					if(count)
					{
						input.push("const wasmtime_component_val_t *payload = value->of.variant.val;", `if (!ow_record_in(payload, ${count}, context->scope)) return false;`);
						output.push("if (!lb_charge(&context->scope->memory, 1, sizeof(wasmtime_component_val_t))) return false;"
							, "wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);"
							, "wasmtime_component_val_t *payload = out->of.variant.val;", `if (!ow_record_out(payload, ${count}, context->scope)) return false;`);
						for(const [position, field] of branch.fields.entries())
						{
							const member = projected.fields[position].witName;
							input.push(`if (!lb_name(&payload->of.record.data[${position}].name, "${member}")) return false;`
								, ...inputField(field, `&payload->of.record.data[${position}].val`, `out->cases.${branch.name}.${field.name}`, `child${position}`));
							output.push(`if (!ow_field_out(&payload->of.record.data[${position}], "${member}", context->scope)) return false;`
								, outputField(field, `value->cases.${branch.name}.${field.name}`, `&payload->of.record.data[${position}].val`));
						}
					}
					else input.push("if (value->of.variant.val) return false;");
					input.push("}"); output.push("break;", "}");
				}
				input.push("else return false;"); output.push("}");
			}
			else if(["option", "result"].includes(node.kind))
			{
				const option = node.kind === "option", payload = option ? "option" : "result.val";
				input.push(`if (value->kind != WASMTIME_COMPONENT_${option ? "OPTION" : "RESULT"}) return false;`);
				input.push(option ? "bool selected = value->of.option != NULL;" : "bool selected; if (!value->of.result.val || !lb_boolean(&value->of.result.is_ok, &selected)) return false;");
				input.push(`if (out) out->tag = ${option ? "selected" : "!selected"};`);
				output.push("if (value->tag > 1) return false;", `out->kind = WASMTIME_COMPONENT_${option ? "OPTION" : "RESULT"};`
					, ...option ? ["out->of.option = NULL;", "if (value->tag) {"] : ["out->of.result.is_ok = value->tag == 0;"]
					, "if (!lb_charge(&context->scope->memory, 1, sizeof(wasmtime_component_val_t))) return false;"
					, `wasmtime_component_val_t empty = {0}; out->of.${payload} = wasmtime_component_val_new(&empty);`);
				for(const [index, field] of node.fields.entries())
				{
					input.push(`${index ? "else " : ""}if (${index ? "!" : ""}selected) {`
						, ...inputField(field, `value->of.${payload}`, `out->${field.name}`, `child${index}`), "}");
					if(!option) output.push(`${index ? "else " : ""}if (value->tag == ${index}) {`);
					output.push(outputField(field, `value->${field.name}`, `out->of.${payload}`), "}");
				}
			}
			else if(node.kind === "tuple")
			{
				input.push(`if (value->kind != WASMTIME_COMPONENT_TUPLE || value->of.tuple.size != ${node.fields.length} || !lb_buffer(value->of.tuple.data, ${node.fields.length}, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(&context->scope->memory, ${node.fields.length}, sizeof(wasmtime_component_val_t))) return false;`);
				output.push(`if (!lb_charge(&context->scope->memory, ${node.fields.length}, sizeof(wasmtime_component_val_t))) return false;`
					, `out->kind = WASMTIME_COMPONENT_TUPLE; wasmtime_component_valtuple_new_uninit(&out->of.tuple, ${node.fields.length});`
					, `memset(out->of.tuple.data, 0, ${node.fields.length} * sizeof(*out->of.tuple.data));`);
				for(const [index, field] of node.fields.entries())
				{
					input.push(...inputField(field, `&value->of.tuple.data[${index}]`, `out->${field.name}`, `child${index}`));
					output.push(outputField(field, `value->${field.name}`, `&out->of.tuple.data[${index}]`));
				}
			}
			else if(node.fields.length)
			{
				input.push(`if (!ow_record_in(value, ${node.fields.length}, context->scope)) return false;`);
				output.push(`if (!ow_record_out(out, ${node.fields.length}, context->scope)) return false;`);
				for(const [index, field] of node.fields.entries())
				{
					const member = row.fields[index].witName;
					input.push(`if (!lb_name(&value->of.record.data[${index}].name, "${member}")) return false;`
						, ...inputField(field, `&value->of.record.data[${index}].val`, `out->${field.name}`, `child${index}`));
					output.push(`if (!ow_field_out(&out->of.record.data[${index}], "${member}", context->scope)) return false;`
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
		const overhead = node.kind === "primitive" && node.name === "int" ? " + 2 * sizeof(wasmtime_component_valrecord_entry_t) + 13" : node.kind === "primitive" && node.name === "unit" ? " + 4" : "";
		return `static inline bool ow_read_${node.index}(const wasmtime_component_val_t *value, ow_input *context, unsigned depth, ${node.cName} *out) {
  (void)out;
  if (!ow_visit(context->scope, depth, sizeof(${node.cName}) + sizeof(wasmtime_component_val_t)) || !lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t))) return false;
${input.map(line => "  " + line).join("\n")}
}
static inline bool ow_write_${node.index}(const ${node.cName} *value, ow_output *context, unsigned depth, wasmtime_component_val_t *out) {
  if (!ow_visit(context->scope, depth, sizeof(wasmtime_component_val_t)${overhead}) || !lb_buffer(value, 1, sizeof(*value), _Alignof(${node.cName}))) return false;
${output.map(line => "  " + line).join("\n")}
}`;
	});
	const wrappers = active.flatMap(node => ["input", "output"].flatMap(direction => {
		const copy = model.graph.values.get(`${direction}:${node.id}`);
		if(!node.leaf && !copy) return [];
		const borrowed = direction === "input" ? "true" : "false", schema = `ow_schema_${node.index}_${direction}`;
		return [`${copy ? `static const ow_table_schema ${schema}_tables[] = {${copy.tables.map(table => `{${table.node.index}, "${table.field}"}`).join(", ")}};
static const ow_schema ${schema} = {${copy.tables.length}, ${schema}_tables};\n` : ""}
static inline bool ow_decode_${node.index}_${direction}(const wasmtime_component_val_t *value, ow_scope *scope, ${node.cName} *out) {
  if (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(${node.cName}))) return false;
  ${node.cName} converted = {0};
${node.leaf ? `  ow_input context = {.scope = scope, .borrowed = ${borrowed}};
  if (!ow_read_${node.index}(value, &context, 0, out ? &converted : NULL)) return false;` : `  ow_input *context = ow_open(value, scope, &${schema}, ${borrowed});
  if (!context || !ow_read_${node.index}(&value->of.record.data[0].val, context, 0, out ? &converted : NULL) || context->visited != context->total) return false;`}
  if (out) *out = converted;
  return true;
}
static inline bool ow_encode_${node.index}_${direction}(const ${node.cName} *value, ow_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t))) return false;
  wasmtime_component_val_t converted = {0};
${node.leaf ? `  ow_output context = {.scope = scope, .borrowed = ${borrowed}};
  bool valid = ow_write_${node.index}(value, &context, 0, &converted);` : `  if (!lb_charge(&scope->memory, 1, sizeof(ow_output))) return false;
  ow_output *context = lb_alloc(&scope->memory, 1, sizeof(*context)); if (!context) return false;
  context->scope = scope; context->borrowed = ${borrowed}; context->schema = &${schema};
  bool valid = ow_record_out(&converted, 2, scope)
    && ow_field_out(&converted.of.record.data[0], "root", scope)
    && ow_field_out(&converted.of.record.data[1], "nodes", scope)
    && ow_write_${node.index}(value, context, 0, &converted.of.record.data[0].val)
    && ow_finish(context, &converted.of.record.data[1].val);
  ow_output_close(context);`}
  if (valid) *out = converted; else ow_value_delete(scope, &converted);
  return valid;
}
`];
	}));
	return ownedWitGraphRuntime(model) + renderWitConversions(scalarModel) + declarations.join("\n") + "\n" + definitions.join("\n\n") + wrappers.join("\n");
};
