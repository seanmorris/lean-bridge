/**
 * Bounded Perl readers and writers for public ownership-aware C values.
 *
 * @file
 */
import { generateOwnedPerlValues } from "./owned-values.mjs";
import { ownedPerlRuntime } from "./owned-runtime.mjs";

const integers = `
static void lpo_clear_integer(pTHX_ void *value) {
  PERL_UNUSED_CONTEXT; mpz_clear(value);
}
static mpz_srcptr lpo_read_integer(pTHX_ lpg_scope *scope, SV *value, int natural) {
  SV *text = lpg_bigint_text(aTHX_ scope, value, natural);
  STRLEN length; const char *bytes = SvPV_nomg(text, length);
  lpg_charge(aTHX_ &scope->native_bytes, length, 1);
  mpz_ptr number = lpg_allocate(aTHX_ scope, 1, sizeof(*number));
  SSGROW(4); mpz_init(number); SAVEDESTRUCTOR_X(lpo_clear_integer, number);
  LB_PERL_GRAPH_CHECKPOINT();
  if (mpz_set_str(number, bytes, 10)) croak("Invalid integral Math::BigInt");
  return number;
}
static SV *lpo_write_integer(pTHX_ lpg_scope *scope, mpz_srcptr value, int natural) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(__mpz_struct));
  if (natural && mpz_sgn(value) < 0) lpg_invalid(aTHX_ scope, "negative Nat");
  if (mpz_size(value) > scope->native_bytes / sizeof(mp_limb_t))
    croak("Perl ownership integer storage limit exceeded");
  size_t count = mpz_sgn(value) ? (mpz_sizeinbase(value, 2) - 1) / 32 + 1 : 0;
  lpg_charge(aTHX_ &scope->native_bytes, count, sizeof(uint32_t));
  uint32_t *limbs = lpg_allocate(aTHX_ scope, count, sizeof(uint32_t));
  size_t written = 0;
  if (count) mpz_export(limbs, &written, -1, sizeof(uint32_t), 0, 0, value);
  if (written != count) lpg_invalid(aTHX_ scope, "integer limb count");
  return lpg_bigint(aTHX_ scope, limbs, count, mpz_sgn(value) < 0);
}
`;

/**
 * Generate finite nominal converters. Native function invocation and host
 * callback construction are separate; callable leaves here are owned identities.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param moduleName - Validated public CPAN namespace.
 */
export const generateOwnedPerlConversions = (ir, moduleName) => {
	const model = generateOwnedPerlValues(ir, moduleName), nodes = new Map(model.types.map(node => [node.id, node]));
	const finite = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.identity || node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabited && !finite.has(node.id))
			{ finite.add(node.id); changed = true; }
		}
	}
	const lines = [`#include "${model.c.prefix}.h"`, ownedPerlRuntime(model.c.prefix), integers];
	for(const node of nodes.values()) lines.push(`static void lpo_read${node.index}(pTHX_ lpg_scope *, SV *, ${node.cName} *, size_t, int);`
		, `static SV *lpo_write${node.index}(pTHX_ lpg_scope *, lpo_owner *, ${node.cName} const *, size_t, int);`);
	for(const node of nodes.values())
	{
		const input = [], output = [], scalar = node.name;
		const readField = (field, slot, target) => {
			const child = nodes.get(field.type);
			return field.pointer
				? `{ ${child.cName} *child = lpg_allocate(aTHX_ scope, 1, sizeof(*child)); ${target} = child; lpo_read${child.index}(aTHX_ scope, ${slot}, child, depth + 1, 1); }`
				: `lpo_read${child.index}(aTHX_ scope, ${slot}, &${target}, depth + 1, 0);`;
		};
		const writeField = (field, source) => `lpo_write${nodes.get(field.type).index}(aTHX_ scope, owner, ${field.pointer ? "" : "&"}${source}, depth + 1, ${field.pointer ? 1 : 0})`;
		const fields = (name, fields, targets) => [
			`static const char *const fields[] = {${fields.length ? fields.map(field => JSON.stringify(field.publicName ?? field.name)).join(", ") : "NULL"}};`
			, `SV **slots = lpg_fields(aTHX_ scope, value, ${JSON.stringify(name)}, fields, ${fields.length}); (void)slots;`
			, ...fields.map((field, index) => readField(field, `slots[${index}]`, targets[index]))
		];
		const object = (name, fields, sources) => ["HV *result = lpg_hash(aTHX_ scope);"
			, ...fields.map((field, index) => `lpg_store(aTHX_ scope, result, ${JSON.stringify(field.publicName ?? field.name)}, ${writeField(field, sources[index])});`)
			, `return lpg_reference(aTHX_ scope, (SV *)result, ${JSON.stringify(name)});`];
		if(!finite.has(node.id))
		{
			input.push('croak("The declared type has no finite value");');
			output.push('lpg_invalid(aTHX_ scope, "uninhabited type"); return NULL;');
		}
		else if(node.identity)
		{
			input.push(`*out = (${node.cName})lpo_borrow(aTHX_ value, ${node.index});`);
			output.push(`return lpo_wrap(aTHX_ scope, owner, (void *)*value, ${node.index}, ${JSON.stringify(node.publicType)});`);
		}
		else if(node.kind === "primitive")
		{
			if(!node.integer) input.push('if (SvROK(value)) croak("Expected a scalar value");');
			if(scalar === "unit")
			{
				input.push('if (SvOK(value)) croak("Unit requires undef");', "*out = 0;");
				output.push('if (*value) lpg_invalid(aTHX_ scope, "Unit");', "return &PL_sv_undef;");
			}
			else if(scalar === "bool")
			{
				input.push('if (!SvIsBOOL(value)) croak("Bool requires true() or false()");', "*out = SvTRUE(value) ? 1 : 0;");
				output.push('uint8_t flag; memcpy(&flag, value, 1); if (flag > 1) lpg_invalid(aTHX_ scope, "Bool");', "return boolSV(flag);");
			}
			else if(scalar === "char")
			{
				input.push('if (!SvPOK(value)) croak("Char requires a text scalar");'
					, "STRLEN length, consumed; const U8 *bytes = (const U8 *)SvPV_nomg(value, length);"
					, 'if (!SvUTF8(value)) { if (length != 1) croak("Char requires one Unicode scalar"); *out = bytes[0]; }'
					, "else {"
					, '  if (!length || length > 4 || !is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("Char requires one Unicode scalar");'
					, "  UV point = utf8_to_uvchr_buf(bytes, bytes + length, &consumed);"
					, '  if (consumed != length) croak("Char requires one Unicode scalar");', "  *out = point;", "}");
				output.push('if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) lpg_invalid(aTHX_ scope, "Unicode scalar");'
					, "U8 text[UTF8_MAXBYTES]; U8 *end = uvchr_to_utf8(text, *value);"
					, "return lpg_text(aTHX_ scope, (const char *)text, end - text, 1);");
			}
			else if(node.integer)
			{
				input.push(`*out = lpo_read_integer(aTHX_ scope, value, ${scalar === "nat" ? 1 : 0});`);
				output.push(`return lpo_write_integer(aTHX_ scope, *value, ${scalar === "nat" ? 1 : 0});`);
			}
			else if(["float32", "float64"].includes(scalar))
			{
				input.push('if (!SvNOK(value) && !SvIOK(value)) croak("Float requires a numeric scalar");', `*out = (${node.cName})SvNV(value);`);
				output.push("SV *result = lpg_sv(aTHX_ scope); LB_PERL_GRAPH_CHECKPOINT(); sv_setnv(result, *value); return result;");
			}
			else if(["string", "bytes"].includes(scalar))
			{
				input.push('if (!SvPOK(value)) croak("Expected a string scalar");'
					, "STRLEN length; const U8 *bytes = (const U8 *)SvPV_nomg(value, length); size_t size = length;");
				if(scalar === "bytes") input.push('if (SvUTF8(value)) croak("ByteArray requires an octet string");');
				else input.push('if (SvUTF8(value)) { if (length && !is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("String contains invalid Unicode"); }'
					, 'else { for (size_t i = 0; i < length; ++i) if (bytes[i] >= 128) { if (size == SIZE_MAX) croak("String size overflow"); ++size; } }');
				input.push("lpg_charge(aTHX_ &scope->native_bytes, size, 1);"
					, "U8 *data = lpg_allocate(aTHX_ scope, size, 1); out->data = (const void *)data; out->length = size;");
				if(scalar === "string") input.push("if (!SvUTF8(value)) { size_t j = 0; for (size_t i = 0; i < length; ++i) { U8 point = bytes[i]; if (point >= 128) { data[j++] = 0xc0 | (point >> 6); data[j++] = 0x80 | (point & 63); } else data[j++] = point; } }"
					, "else if (length) memcpy(data, bytes, length);");
				else input.push("if (length) memcpy(data, bytes, length);");
				output.push("lpg_charge(aTHX_ &scope->native_bytes, value->length, 1);", "lpg_pointer(aTHX_ scope, value->data, value->length, 1, 1);");
				if(scalar === "string") output.push('if (value->length && !is_utf8_string_flags((const U8 *)value->data, value->length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) lpg_invalid(aTHX_ scope, "UTF-8");');
				output.push(`return lpg_text(aTHX_ scope, (const char *)value->data, value->length, ${scalar === "string" ? 1 : 0});`);
			}
			else
			{
				const unsigned = scalar.startsWith("u"), bits = scalar.endsWith("size") ? 64 : Number(scalar.match(/\d+/)[0]);
				input.push(`*out = (${node.cName})lpg_${unsigned ? "unsigned" : "signed"}(aTHX_ value, ${unsigned ? `UINT${bits}_MAX` : `INT${bits}_MIN, INT${bits}_MAX`});`);
				output.push(`SV *result = lpg_sv(aTHX_ scope); LB_PERL_GRAPH_CHECKPOINT(); sv_set${unsigned ? "uv" : "iv"}(result, *value); return result;`);
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push("size_t length; SV **slots = lpg_sequence(aTHX_ scope, value, &length);"
				, `lpg_charge(aTHX_ &scope->native_bytes, length, sizeof(${child.cName}));`
				, `${child.cName} *data = lpg_allocate(aTHX_ scope, length, sizeof(*data)); out->data = data; out->length = length;`
				, `for (size_t i = 0; i < length; ++i) lpo_read${child.index}(aTHX_ scope, slots[i], &data[i], depth + 1, 0);`);
			output.push(`lpg_charge(aTHX_ &scope->native_bytes, value->length, sizeof(${child.cName}));`
				, 'if (value->length > scope->nodes) croak("Perl ownership node limit exceeded");'
				, `lpg_pointer(aTHX_ scope, value->data, value->length, sizeof(${child.cName}), _Alignof(${child.cName}));`
				, "AV *result = lpg_array(aTHX_ scope, value->length);"
				, `for (size_t i = 0; i < value->length; ++i) lpg_append(aTHX_ result, i, lpo_write${child.index}(aTHX_ scope, owner, &value->data[i], depth + 1, 0));`
				, "return lpg_reference(aTHX_ scope, (SV *)result, NULL);");
		}
		else if(node.kind === "tuple")
		{
			input.push("size_t length; SV **slots = lpg_sequence(aTHX_ scope, value, &length);"
				, 'if (length != 2) croak("Prod requires exactly two elements");'
				, ...node.fields.map((field, index) => readField(field, `slots[${index}]`, `out->${field.name}`)));
			output.push("AV *result = lpg_array(aTHX_ scope, 2);"
				, ...node.fields.map((field, index) => `lpg_append(aTHX_ result, ${index}, ${writeField(field, `value->${field.name}`)});`)
				, "return lpg_reference(aTHX_ scope, (SV *)result, NULL);");
		}
		else if(node.kind === "record")
		{
			input.push(...fields(node.publicType, node.fields, node.fields.map(field => `out->${field.name}`)));
			output.push(...object(node.publicType, node.fields, node.fields.map(field => `value->${field.name}`)));
		}
		else if(node.kind === "variant")
		{
			output.push("switch (value->kind) {");
			for(const branch of node.cases)
			{
				input.push(`if (lpg_branch(value, ${JSON.stringify(branch.publicName)})) {`, `out->kind = ${branch.tag};`
					, ...fields(branch.publicName, branch.fields, branch.fields.map(field => `out->cases.${branch.name}.${field.name}`)), "return;", "}");
				output.push(`case ${branch.tag}: {`, ...object(branch.publicName, branch.fields, branch.fields.map(field => `value->cases.${branch.name}.${field.name}`)), "}");
			}
			input.push('croak("Expected an exact generated variant constructor");');
			output.push('default: lpg_invalid(aTHX_ scope, "constructor tag"); return NULL;', "}");
		}
		else
		{
			const optional = node.kind === "option", flag = optional ? "has_value" : "is_ok";
			if(optional) input.push("if (!SvOK(value)) { out->has_value = 0; return; }");
			output.push(`uint8_t flag; memcpy(&flag, &value->${flag}, 1); if (flag > 1) lpg_invalid(aTHX_ scope, "branch flag");`);
			if(optional) output.push("if (!flag) return &PL_sv_undef;");
			for(const [index, field] of node.fields.entries())
			{
				const name = `${moduleName}::${optional ? "Some" : index === 0 ? "Ok" : "Err"}`;
				const member = { ...field, publicName: "value" };
				input.push(`if (lpg_branch(value, ${JSON.stringify(name)})) { out->${flag} = ${index === 0 ? 1 : 0};`
					, ...fields(name, [member], [`out->${field.name}`]), "return;", "}");
				output.push(`${optional ? "" : index === 0 ? "if (flag) " : "else "}{`, ...object(name, [member], [`value->${field.name}`]), "}");
			}
			input.push(`croak("Expected ${optional ? "undef or Some" : "Ok or Err"}");`);
		}
		lines.push(`static void lpo_read${node.index}(pTHX_ lpg_scope *scope, SV *value, ${node.cName} *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, ${node.index}, depth, storage ? sizeof(*out) : 0, 0);
  ${input.join("\n  ")}
}
static SV *lpo_write${node.index}(pTHX_ lpg_scope *scope, lpo_owner *owner, ${node.cName} const *value, size_t depth, int storage) {
  (void)owner;
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(${node.cName}));
  lpg_enter(aTHX_ scope, value, ${node.index}, depth, storage ? sizeof(*value) : 0, 1);
  ${output.join("\n  ")}
}
`);
	}
	return { ...model, valuesSource: model.source, source: lines.join("\n") };
};
