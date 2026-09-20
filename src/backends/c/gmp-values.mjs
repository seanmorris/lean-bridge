/**
 * Owned GMP values and recursive conversion to the unchanged private C ABI.
 *
 * @file
 */
/**
 * Identify a public GMP integer.
 *
 * @param copy - Checked copied type.
 */
export const gmpInteger = copy => ["nat", "int"].includes(copy.scalarName);
/**
 * Keep the facade's type names separate from the private C ABI.
 *
 * @param surface - Checked private surface.
 * @param copy - Copied type.
 */
export const gmpName = (surface, copy) => copy.name.startsWith(`${surface.prefix}_`) ? copy.name.replace(`${surface.prefix}_`, `${surface.prefix}_gmp_`) : copy.name;
/**
 * Pass GMP arrays by decay and other values by address.
 *
 * @param copy - Copied type.
 * @param value - Generated C expression.
 */
export const gmpAddress = (copy, value) => gmpInteger(copy) ? value : `&${value}`;
/**
 * Declare a borrowed public argument.
 *
 * @param surface - Checked private surface.
 * @param copy - Copied type.
 * @param name - C parameter name.
 */
export const gmpInput = (surface, copy, name) => `${gmpInteger(copy) ? "mpz_srcptr" : `${gmpName(surface, copy)}${copy.aggregate ? " const*" : ""}`} ${name}`;
/**
 * Declare an initialized public output.
 *
 * @param surface - Checked private surface.
 * @param copy - Copied type.
 * @param name - C parameter name.
 */
export const gmpOutput = (surface, copy, name) => `${gmpInteger(copy) ? "mpz_ptr" : `${gmpName(surface, copy)}*`} ${name}`;

/**
 * Render C declarations and failure-safe recursive copied-value helpers.
 *
 * @param surface - Checked private C surface.
 */
export const renderGmpValues = surface => {
	const declarations = [], definitions = [];
	for(const copy of surface.copies)
	{
		const n = gmpName(surface, copy);
		if(gmpInteger(copy)) declarations.push(`typedef mpz_t ${n};`);
		else if(copy.aggregate) declarations.push(`typedef struct ${n} ${n};`);
	}
	for(const copy of surface.copies)
	{
		const n = gmpName(surface, copy), id = copy.index, raw = copy.name;
		const pointer = gmpInteger(copy) ? "mpz_ptr" : `${n}*`, input = gmpInteger(copy) ? "mpz_srcptr" : `${n} const*`;
		const init = [], clear = [], swap = [], to = [], from = [], extra = [];
		const pubChild = (child, value) => gmpAddress(child, value);
		if(gmpInteger(copy))
		{
			init.push("mpz_init(value);"); clear.push("mpz_clear(value); mpz_init(value);"); swap.push("mpz_swap(left, right);");
			if(copy.scalarName === "nat") to.push("if (mpz_sgn(value) < 0) return 0;");
			to.push("size_t count = mpz_sgn(value) ? (mpz_sizeinbase(value, 2) - 1) / 32 + 1 : 0;"
				, "if (!lb_gmp_charge(budget, count, sizeof(uint32_t))) return 0;"
				, "uint32_t *data = count ? malloc(count * sizeof(uint32_t)) : NULL;"
				, "if (count && !data) return -1;"
				, "if (count) mpz_export(data, &count, -1, sizeof(uint32_t), 0, 0, value);"
				, `*out = (${raw}){data, count, data, free${copy.scalarName === "int" ? ", mpz_sgn(value) < 0" : ""}};`);
			from.push("if (!lb_gmp_charge(budget, value->length, sizeof(uint32_t))) return 0;"
				, "mpz_import(out, value->length, -1, sizeof(uint32_t), 0, 0, value->data);");
			if(copy.scalarName === "int") from.push("if (value->negative) mpz_neg(out, out);");
		} else if(copy.record || copy.compound)
		{
			const flag = { option: "has_value", result: "is_ok" }[copy.compound];
			declarations.push(`struct ${n} {\n${flag ? `  uint8_t ${flag};\n` : ""}${copy.fields.length ? copy.fields.map(field => `  ${gmpName(surface, field.type)} ${field.name};`).join("\n") : "  uint8_t empty;"}\n};`);
			init.push("memset(value, 0, sizeof(*value));");
			to.push(`if (!lb_gmp_charge(budget, 1, sizeof(${raw}))) return 0;`);
			from.push(`if (!lb_gmp_charge(budget, 1, sizeof(${n}))) return 0;`);
			if(flag)
			{
				for(const lines of [to, from]) lines.push(`if (value->${flag} > 1) return 0;`, `out->${flag} = value->${flag};`);
				clear.push(`value->${flag} = 0;`);
				swap.push(`uint8_t flag = left->${flag}; left->${flag} = right->${flag}; right->${flag} = flag;`);
			}
			for(const field of copy.fields)
			{
				const child = field.type, address = pubChild(child, `value->${field.name}`);
				init.push(`lb_gmp_init${child.index}(${address});`);
				clear.push(`lb_gmp_clear${child.index}(${address});`);
				swap.push(`lb_gmp_swap${child.index}(${pubChild(child, `left->${field.name}`)}, ${pubChild(child, `right->${field.name}`)});`);
				if(flag) for(const lines of [to, from]) lines.push(`if (${field.name === "error" ? "!" : ""}value->${flag}) {`);
				to.push(`int status${child.index}_${field.name} = lb_gmp_to${child.index}(${address}, &out->${field.name}, budget);`
					, `if (status${child.index}_${field.name} != 1) return status${child.index}_${field.name};`);
				from.push(`int status${child.index}_${field.name} = lb_gmp_from${child.index}(&value->${field.name}, ${pubChild(child, `out->${field.name}`)}, budget);`
					, `if (status${child.index}_${field.name} != 1) return status${child.index}_${field.name};`);
				if(flag) for(const lines of [to, from]) lines.push("}");
			}
		} else if(copy.aggregate)
		{
			const element = copy.element, e = element ? gmpName(surface, element) : copy.scalarName === "string" ? "char" : "uint8_t";
			declarations.push(`struct ${n} { const ${e} *data; size_t length; void *owner; void (*release)(void*); };`);
			init.push("memset(value, 0, sizeof(*value));");
			clear.push("if (value->owner && value->release) value->release(value->owner);", "memset(value, 0, sizeof(*value));");
			swap.push(`${n} temporary = *left; *left = *right; *right = temporary;`);
			if(element)
			{
				for(const direction of ["to", "from"])
				{
					const isTo = direction === "to", child = element.index, resultType = isTo ? raw : n, childType = isTo ? element.name : e;
					const owner = `lb_gmp_${direction}${id}_owner`, release = `lb_gmp_${direction}${id}_release`, lines = isTo ? to : from;
					extra.push(`typedef struct { size_t length; ${childType} data[]; } ${owner};`
						, `static void ${release}(void *pointer) { ${owner} *owner = pointer;`
						, ...(isTo ? element.aggregate ? [`  for (size_t i = 0; i < owner->length; ++i) ${element.name}_clear(&owner->data[i]);`] : []
							: [`  for (size_t i = 0; i < owner->length; ++i) lb_gmp_clear${child}(${pubChild(element, "owner->data[i]")});`])
						, "  free(owner);", "}");
					lines.push(`if ((value->length && !value->data) || !lb_gmp_charge(budget, value->length, sizeof(${childType}) > sizeof(void*) ? sizeof(${childType}) : sizeof(void*)) || !lb_gmp_charge(budget, 1, sizeof(${owner}))) return 0;`
						, "if (!value->length) return 1;"
						, `${owner} *owner = calloc(1, sizeof(*owner) + value->length * sizeof(${childType}));`
						, "if (!owner) return -1;"
						, `*out = (${resultType}){owner->data, value->length, owner, ${release}};`
						, "for (size_t i = 0; i < value->length; ++i) {"
						, ...(isTo ? [] : [`  lb_gmp_init${child}(${pubChild(element, "owner->data[i]")});`])
						, "  ++owner->length;"
						, `  int status = lb_gmp_${direction}${child}(${isTo ? pubChild(element, "value->data[i]") : "&value->data[i]"}, ${isTo ? "&owner->data[i]" : pubChild(element, "owner->data[i]")}, budget);`
						, "  if (status != 1) return status;", "}");
				}
			} else
			{
				for(const [lines, type] of [[to, raw], [from, n]]) lines.push("if ((value->length && !value->data) || !lb_gmp_charge(budget, value->length, 1)) return 0;"
					, "void *data = value->length ? malloc(value->length) : NULL;"
					, "if (value->length && !data) return -1;"
					, "if (value->length) memcpy(data, value->data, value->length);"
					, `*out = (${type}){data, value->length, data, free};`);
			}
		} else
		{
			init.push("*value = 0;"); clear.push("*value = 0;"); swap.push(`${n} temporary = *left; *left = *right; *right = temporary;`);
			to.push("*out = *value;"); from.push("*out = *value;");
		}
		const functionBody = lines => lines.map(line => `  ${line}`).join("\n");
		definitions.push(`static inline void lb_gmp_init${id}(${pointer} value) { (void)value;\n${functionBody(init)}\n}`
			, `static inline void lb_gmp_clear${id}(${pointer} value) { (void)value;\n${functionBody(clear)}\n}`
			, `static inline void lb_gmp_swap${id}(${pointer} left, ${pointer} right) { (void)left; (void)right;\n${functionBody(swap)}\n}`
			, ...extra
			, `static inline int lb_gmp_to${id}(${input} value, ${raw} *out, size_t *budget) { (void)value; (void)out; (void)budget;\n${functionBody(to)}\n  return 1;\n}`
			, `static inline int lb_gmp_from${id}(${raw} const* value, ${pointer} out, size_t *budget) { (void)value; (void)out; (void)budget;\n${functionBody(from)}\n  return 1;\n}`);
		if(copy.aggregate)
		{
			declarations.push(`void ${n}_init(${pointer} value);`, `void ${n}_clear(${pointer} value);`);
			definitions.push(`void ${n}_init(${pointer} value) { if (value) lb_gmp_init${id}(value); }`
				, `void ${n}_clear(${pointer} value) { if (value) lb_gmp_clear${id}(value); }`);
		}
	}
	return { declarations: declarations.join("\n"), definitions: definitions.join("\n\n") };
};
