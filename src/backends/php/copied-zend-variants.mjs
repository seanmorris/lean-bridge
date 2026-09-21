/**
 * Private PHP/Zend wire cases for copied named variants.
 *
 * @file
 */

/**
 * Convert named public objects to private lists and reconstruct checked cases.
 *
 * @param model - Component namespace and admitted payload types.
 * @param copy - A concrete copied variant.
 */
export const phpZendVariantWire = (model, copy) => `    private static function to${copy.index}(mixed $value): mixed {
${copy.cases.map((branch, index) => `        if ($value instanceof \\${model.namespace}\\${branch.publicName}) return [${[index, ...branch.fields.map(field => `self::to${field.type.index}($value->${field.publicName})`)].join(", ")}];`).join("\n")}
        throw new \\TypeError('Expected an exact ${copy.publicName} constructor');
    }
    private static function from${copy.index}(mixed $value): mixed {
        if (!is_array($value) || !array_is_list($value) || !isset($value[0]) || !is_int($value[0])) throw new \\RuntimeException('Invalid ${copy.publicName} wire tag');
        switch ($value[0]) {
${copy.cases.map((branch, index) => `        case ${index}:
            if (count($value) !== ${branch.fields.length + 1}) throw new \\RuntimeException('Invalid ${branch.publicName} wire fields');
            return new \\${model.namespace}\\${branch.publicName}(${branch.fields.map((field, position) => `self::from${field.type.index}($value[${position + 1}])`).join(", ")});`).join("\n")}
        default: throw new \\RuntimeException('Invalid ${copy.publicName} wire constructor');
        }
    }`;

/**
 * Select a C union only after validating its tag and the exact wire field count.
 *
 * @param copy - C facade layout, not a Lean runtime layout.
 */
export const zendVariantConversions = copy => ({
	input: [
		'if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) < 1) return lb_fail(s, "Variant wire requires a constructor tag and fields", 1);'
		, "zval *tag = zend_hash_index_find(Z_ARRVAL_P(value), 0); ZVAL_DEREF(tag);"
		, 'if (Z_TYPE_P(tag) != IS_LONG) return lb_fail(s, "Variant wire tag requires int", 1);'
		, `if (Z_LVAL_P(tag) < 0 || (uint64_t)Z_LVAL_P(tag) >= ${copy.cases.length}) return lb_fail(s, "Invalid variant wire constructor", 0);`
		, "out->kind = (uint32_t)Z_LVAL_P(tag);", "switch (out->kind) {"
		, ...copy.cases.flatMap((branch, index) => [`case ${index}: {`
			, `  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != ${branch.fields.length + 1}) return lb_fail(s, "Variant wire field count differs", 0);`
			, `  if (!lb_charge(s, ${branch.fields.length + 1}, 32)) return 0;`
			, ...branch.fields.map((field, position) => `  if (!lb_to${field.type.index}(zend_hash_index_find(Z_ARRVAL_P(value), ${position + 1}), &out->cases.${branch.name}.${field.name}, s)) return 0;`)
			, "  break;", "}"])
		, "}"
	]
	, output: [
		`if (value->kind >= ${copy.cases.length}) return lb_fail(s, "Invalid native variant constructor", 0);`
		, "switch (value->kind) {"
		, ...copy.cases.flatMap((branch, index) => [`case ${index}: {`
			, `  if (!lb_charge(s, ${branch.fields.length + 1}, 32)) return 0;`
			, `  array_init_size(out, ${branch.fields.length + 1});`
			, `  add_next_index_long(out, ${index});`
			, ...branch.fields.flatMap((field, position) => [`  zval item${position}; ZVAL_NULL(&item${position});`
				, `  if (!lb_from${field.type.index}(&value->cases.${branch.name}.${field.name}, &item${position}, s)) { zval_ptr_dtor(&item${position}); return 0; }`
				, `  add_next_index_zval(out, &item${position});`])
			, "  break;", "}"])
		, "}"
	]
});
