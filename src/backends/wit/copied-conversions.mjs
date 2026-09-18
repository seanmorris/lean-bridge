/**
 * Generate bounded Wasmtime values and scoped C input views.
 *
 * @file
 */
const scalar = { char: ["CHAR", "character"], bool: ["BOOL", "boolean"], uint8: ["U8", "u8"], uint16: ["U16", "u16"], uint32: ["U32", "u32"], uint64: ["U64", "u64"], int8: ["S8", "s8"], int16: ["S16", "s16"], int32: ["S32", "s32"], int64: ["S64", "s64"], float32: ["F32", "f32"], float64: ["F64", "f64"] };

/** Shared conversion helpers, private to each compiled host library. */
export const witConversionPrelude = `
typedef struct lb_allocation { struct lb_allocation *next; } lb_allocation;
typedef struct { size_t remaining; lb_allocation *allocations; } lb_scope;
static inline bool lb_charge(lb_scope *scope, size_t count, size_t width) {
  if (count && width > scope->remaining / count) return false;
  scope->remaining -= count * width; return true;
}
static inline void *lb_alloc(lb_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) return NULL;
  lb_allocation *allocation = calloc(1, sizeof(*allocation) + count * width);
  if (!allocation) return NULL;
  allocation->next = scope->allocations; scope->allocations = allocation;
  return allocation + 1;
}
static inline void lb_scope_close(lb_scope *scope) {
  while (scope->allocations) { lb_allocation *next = scope->allocations->next; free(scope->allocations); scope->allocations = next; }
}
static inline bool lb_name(const wasm_name_t *name, const char *expected) {
  size_t length = strlen(expected);
  return name->size == length && (!length || (name->data && memcmp(name->data, expected, length) == 0));
}
static inline bool lb_utf8(const char *text, size_t length) {
  const uint8_t *p = (const uint8_t *)text;
  if (length && !p) return false;
  for (size_t i = 0; i < length;) {
    uint32_t c = p[i++]; size_t extra = 0; uint32_t minimum = 0;
    if (c < 0x80) continue;
    if (c >= 0xc2 && c <= 0xdf) { extra = 1; minimum = 0x80; c &= 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { extra = 2; minimum = 0x800; c &= 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { extra = 3; minimum = 0x10000; c &= 7; }
    else return false;
    if (extra > length - i) return false;
    while (extra--) { uint8_t b = p[i++]; if ((b & 0xc0) != 0x80) return false; c = (c << 6) | (b & 0x3f); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return false;
  }
  return true;
}
static inline bool lb_limbs_in(const wasmtime_component_val_t *value, lb_scope *scope, uint32_t **out, size_t *length) {
  if (value->kind != WASMTIME_COMPONENT_LIST) return false;
  size_t count = value->of.list.size;
  if ((count && !value->of.list.data) || !lb_charge(scope, count, sizeof(wasmtime_component_val_t) + sizeof(uint32_t))) return false;
  for (size_t i = 0; i < count; ++i) if (value->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  if (count && value->of.list.data[count - 1].of.u32 == 0) return false;
  if (out) {
    *out = lb_alloc(scope, count, sizeof(uint32_t)); if (count && !*out) return false;
    for (size_t i = 0; i < count; ++i) (*out)[i] = value->of.list.data[i].of.u32;
    *length = count;
  }
  return true;
}
static inline bool lb_limbs_out(const uint32_t *data, size_t length, lb_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_charge(scope, length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST;
  wasmtime_component_vallist_new_uninit(&out->of.list, length);
  for (size_t i = 0; i < length; ++i) out->of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = data[i]};
  return true;
}
`;

/**
 * Render recursive input checks/copies and independently owned output values.
 *
 * @param root0 - Admitted copied WIT model.
 * @param root0.surface - Shared C value layout and function descriptions.
 */
export const renderWitConversions = ({ surface }) => surface.copies.map(copy => {
	const input = [], output = [], name = copy.scalarName;
	const data = "value->of.list";
	if(scalar[name])
	{
		const [kind, field] = scalar[name];
		input.push(`if (value->kind != WASMTIME_COMPONENT_${kind}) return false;`);
		if(name === "char")
		{
			input.push("if (value->of.character > 0x10ffff || (value->of.character >= 0xd800 && value->of.character <= 0xdfff)) return false;");
			output.push("if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return false;");
		}
		input.push(`if (out) *out = value->of.${field};`);
		output.push(`out->kind = WASMTIME_COMPONENT_${kind}; out->of.${field} = *value;`);
	} else if(name === "unit")
	{
		input.push('if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "unit")) return false;', "if (out) *out = 0;");
		output.push('out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 4, "unit");');
	} else if(name === "string")
	{
		input.push("if (value->kind != WASMTIME_COMPONENT_STRING || !lb_charge(scope, value->of.string.size, 1) || !lb_utf8(value->of.string.data, value->of.string.size)) return false;", `if (out) *out = (${copy.name}){.data = value->of.string.data, .length = value->of.string.size};`);
		output.push("if (!lb_charge(scope, value->length, 1)) return false;", "out->kind = WASMTIME_COMPONENT_STRING; wasm_name_new(&out->of.string, value->length, value->data);");
	} else if(name === "nat" || name === "int")
	{
		if(name === "int") input.push('if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 2 || !value->of.record.data || !lb_name(&value->of.record.data[0].name, "negative") || !lb_name(&value->of.record.data[1].name, "limbs") || value->of.record.data[0].val.kind != WASMTIME_COMPONENT_BOOL) return false;', "bool negative = value->of.record.data[0].val.of.boolean;", "value = &value->of.record.data[1].val;", "if (negative && value->kind == WASMTIME_COMPONENT_LIST && !value->of.list.size) return false;");
		input.push("uint32_t *limbs = NULL; size_t length = 0;", "if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;", `if (out) *out = (${copy.name}){.data = limbs, .length = length${name === "int" ? ", .negative = negative" : ""}};`);
		if(name === "nat") output.push("return lb_limbs_out(value->data, value->length, scope, out);");
		else output.push("out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 2);", "memset(out->of.record.data, 0, 2 * sizeof(*out->of.record.data));", 'wasm_name_new(&out->of.record.data[0].name, 8, "negative"); wasm_name_new(&out->of.record.data[1].name, 5, "limbs");', "out->of.record.data[0].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = value->negative};", "return lb_limbs_out(value->data, value->length, scope, &out->of.record.data[1].val);");
	} else if(copy.record)
	{
		if(!copy.fields.length)
		{
			input.push('if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "empty")) return false;');
			output.push('out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 5, "empty");');
		} else
		{
			input.push(`if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != ${copy.fields.length} || !value->of.record.data) return false;`);
			output.push(`if (!lb_charge(scope, ${copy.fields.length}, sizeof(wasmtime_component_valrecord_entry_t))) return false;`, `out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, ${copy.fields.length});`, `memset(out->of.record.data, 0, ${copy.fields.length} * sizeof(*out->of.record.data));`);
			for(const [i, field] of copy.fields.entries())
			{
				input.push(`if (!lb_name(&value->of.record.data[${i}].name, "${field.witName}") || !lb_in_${field.type.index}(&value->of.record.data[${i}].val, scope, out ? &out->${field.name} : NULL)) return false;`);
				output.push(`wasm_name_new(&out->of.record.data[${i}].name, ${field.witName.length}, "${field.witName}");`, `if (!lb_out_${field.type.index}(&value->${field.name}, scope, &out->of.record.data[${i}].val)) return false;`);
			}
		}
	} else
	{
		const element = copy.element, type = element?.name ?? "uint8_t";
		input.push(`if (value->kind != WASMTIME_COMPONENT_LIST || (${data}.size && !${data}.data) || !lb_charge(scope, ${data}.size, sizeof(wasmtime_component_val_t) + sizeof(${type}))) return false;`, `${type} *items = out ? lb_alloc(scope, ${data}.size, sizeof(${type})) : NULL;`, `if (out && ${data}.size && !items) return false;`, `for (size_t i = 0; i < ${data}.size; ++i) {`, element ? `  if (!lb_in_${element.index}(&${data}.data[i], scope, out ? &items[i] : NULL)) return false;` : `  if (${data}.data[i].kind != WASMTIME_COMPONENT_U8) return false;\n    if (out) items[i] = ${data}.data[i].of.u8;`, "}", `if (out) *out = (${copy.name}){.data = items, .length = ${data}.size};`);
		output.push("if (!lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;", "out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);", "if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));", "for (size_t i = 0; i < value->length; ++i) {", element ? `  if (!lb_out_${element.index}(&value->data[i], scope, &out->of.list.data[i])) return false;` : "  out->of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U8, .of.u8 = value->data[i]};", "}");
	}
	return `static inline bool lb_in_${copy.index}(const wasmtime_component_val_t *value, lb_scope *scope, ${copy.name} *out) {
  (void)out;
  if (!value || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
${input.map(line => `  ${line}`).join("\n")}
  return true;
}
static inline bool lb_out_${copy.index}(const ${copy.name} *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
${output.map(line => `  ${line}`).join("\n")}
  return true;
}`;
}).join("\n\n");
