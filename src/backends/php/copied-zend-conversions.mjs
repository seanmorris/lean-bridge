/**
 * Generate checked PHP wire-value conversions using only the public copied C ABI.
 *
 * @file
 */

/**
 * Render C conversions in dependency order; aggregate owners stay with the caller.
 *
 * @param model - Copied PHP model with an explicit integer width.
 */
export const copiedZendConversions = model => model.surface.copies.map(copy => {
	const input = [], output = [], name = copy.scalarName;
	if(name === "unit")
	{ input.push('if (Z_TYPE_P(value) != IS_NULL) return lb_fail(s, "Unit requires null", 1);', "*out = 0;"); output.push("(void)value; ZVAL_NULL(out);"); }
	else if(name === "bool")
	{ input.push('if (Z_TYPE_P(value) != IS_TRUE && Z_TYPE_P(value) != IS_FALSE) return lb_fail(s, "Bool requires bool", 1);', "*out = Z_TYPE_P(value) == IS_TRUE;"); output.push("ZVAL_BOOL(out, *value);"); }
	else if(name === "char")
	{
		input.push('if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Char requires a string", 1);', 'if (!lb_char_in((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value), out)) return lb_fail(s, "Char requires one Unicode scalar", 0);');
		output.push('if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return lb_fail(s, "Invalid native Unicode scalar", 0);', "char text[4]; size_t length = lb_char_out(*value, text);", "ZVAL_STRINGL(out, text, length);");
	}
	else if(copy.publicType === "\\Brick\\Math\\BigInteger" && !["nat", "int"].includes(name))
	{
		input.push(`uint64_t bits; if (!lb_u64_in(value, s, &bits, ${name === "int64" ? "true" : "false"}, ${name === "uint32" ? 32 : 64})) return 0;`);
		input.push(name === "int64" ? "memcpy(out, &bits, sizeof(bits));" : `*out = (${copy.ctype})bits;`);
		output.push(`char text[32]; int length = snprintf(text, sizeof(text), "%" ${name === "int64" ? "PRId64" : "PRIu64"}, (${name === "int64" ? "int64_t" : "uint64_t"})*value);`, "ZVAL_STRINGL(out, text, (size_t)length);");
	} else if(/^(?:u?int)(?:8|16|32|64)$/.test(name))
	{
		const bits = Number(name.match(/\d+/)[0]), signed = name.startsWith("int");
		input.push('if (Z_TYPE_P(value) != IS_LONG) return lb_fail(s, "Expected an int without numeric coercion", 1);');
		if(signed && bits < 32) input.push(`if (Z_LVAL_P(value) < INT${bits}_MIN || Z_LVAL_P(value) > INT${bits}_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);`);
		else if(!signed) input.push(`if (Z_LVAL_P(value) < 0 || (uint64_t)Z_LVAL_P(value) > UINT${bits}_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);`);
		else if(bits === 32) input.push('if ((int64_t)Z_LVAL_P(value) < INT32_MIN || (int64_t)Z_LVAL_P(value) > INT32_MAX) return lb_fail(s, "Integer is outside the declared Lean range", 0);');
		input.push(`*out = (${copy.ctype})Z_LVAL_P(value);`); output.push("ZVAL_LONG(out, (zend_long)*value);");
	} else if(name === "float32" || name === "float64")
	{ input.push('if (Z_TYPE_P(value) != IS_DOUBLE) return lb_fail(s, "Expected a float without numeric coercion", 1);', `*out = (${copy.ctype})Z_DVAL_P(value);`); output.push("ZVAL_DOUBLE(out, (double)*value);"); }
	else if(name === "nat" || name === "int")
	{
		input.push(`uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, ${name === "int" ? "true" : "false"})) return 0;`, "out->data = words;", ...(name === "int" ? ["out->negative = negative;"] : []));
		output.push(`return lb_big_out(value->data, value->length, ${name === "int" ? "value->negative" : "false"}, out, s);`);
	} else if(name === "string" || name === "bytes")
	{
		input.push('if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected string bytes", 1);', "if (!lb_charge(s, Z_STRLEN_P(value), 1)) return 0;");
		if(name === "string") input.push('if (!lb_utf8((const unsigned char *)Z_STRVAL_P(value), Z_STRLEN_P(value))) return lb_fail(s, "String requires valid UTF-8", 0);');
		input.push(`out->data = (const ${name === "string" ? "char" : "uint8_t"} *)Z_STRVAL_P(value); out->length = Z_STRLEN_P(value);`);
		output.push('if (!lb_charge(s, value->length, 1) || (value->length && !value->data)) return lb_fail(s, "Invalid string buffer", 0);');
		if(name === "string") output.push('if (!lb_utf8((const unsigned char *)value->data, value->length)) return lb_fail(s, "Native string is not valid UTF-8", 0);');
		output.push('ZVAL_STRINGL(out, value->length ? (const char *)value->data : "", value->length);');
	} else
	{
		input.push('if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);');
		if(copy.record)
		{
			input.push(`if (zend_hash_num_elements(Z_ARRVAL_P(value)) != ${copy.fields.length}) return lb_fail(s, "Record wire field count differs", 0);`);
			for(const [i, field] of copy.fields.entries()) input.push(`if (!lb_to${field.type.index}(zend_hash_index_find(Z_ARRVAL_P(value), ${i}), &out->${field.name}, s)) return 0;`);
			if(!copy.fields.length) input.push("out->empty = 0;");
			output.push(`if (!lb_charge(s, ${copy.fields.length}, 32)) return 0;`, `array_init_size(out, ${copy.fields.length});`);
			for(const [i, field] of copy.fields.entries()) output.push(`zval item${i}; ZVAL_NULL(&item${i});`, `if (!lb_from${field.type.index}(&value->${field.name}, &item${i}, s)) { zval_ptr_dtor(&item${i}); return 0; }`, `add_next_index_zval(out, &item${i});`);
			if(!copy.fields.length) output.push("(void)value;");
		} else
		{
			input.push("size_t count = zend_hash_num_elements(Z_ARRVAL_P(value));", "if (!lb_charge(s, count, 32)) return 0;", `${copy.element.ctype} *data = lb_allocate(s, count, sizeof(*data)); if (!data) return 0;`, "out->data = data; out->length = count;", `for (size_t i = 0; i < count; i++) if (!lb_to${copy.element.index}(zend_hash_index_find(Z_ARRVAL_P(value), i), &data[i], s)) return 0;`);
			output.push('if (!lb_charge(s, value->length, 32) || (value->length && !value->data)) return lb_fail(s, "Invalid array output", 0);', "array_init_size(out, (uint32_t)value->length);", "for (size_t i = 0; i < value->length; i++) {", "  zval item; ZVAL_NULL(&item);", `  if (!lb_from${copy.element.index}(&value->data[i], &item, s)) { zval_ptr_dtor(&item); return 0; }`, "  add_next_index_zval(out, &item);", "}");
		}
	}
	return `static int lb_to${copy.index}(zval *value, ${copy.ctype} *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
${input.map(line => `  ${line}`).join("\n")}
  return 1;
}
static int lb_from${copy.index}(const ${copy.ctype} *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
${output.map(line => `  ${line}`).join("\n")}
  return 1;
}`;
}).join("\n\n");
