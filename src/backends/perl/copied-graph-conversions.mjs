/**
 * Bounded XS converters over finite, compiler-independent native graph layouts.
 * Native calls and CPAN admission are separate stages.
 *
 * @file
 */
import { generateCopiedCGraphTypes } from "../c/copied-graph-layout.mjs";
import { generateCopiedPerlGraphValues } from "./copied-graph-values.mjs";
import { perlGraphRuntime } from "./copied-graph-runtime.mjs";

/**
 * Emit typed readers and writers without expanding nominal recursive edges.
 *
 * @param ir - Concrete copied graph contract.
 * @param moduleName - Selected Perl namespace.
 */
export const generateCopiedPerlGraphConversions = (ir, moduleName) => {
	const { source: valuesSource, ...model } = generateCopiedPerlGraphValues(ir, moduleName);
	const { header: typesHeader } = generateCopiedCGraphTypes(ir);
	const nodes = new Map(model.types.map((node, index) => [node.id, { ...node, index }]));
	const inhabited = new Set();
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => inhabited.has(field.type));
			const finite = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => inhabited.has(field.type)) : all(node.fields));
			if(finite && !inhabited.has(node.id))
			{ inhabited.add(node.id); changed = true; }
		}
	}
	const lines = [perlGraphRuntime, `#include "${model.layout.prefix}-graph-types.h"`];
	for(const node of nodes.values()) lines.push(`static void lpg_read${node.index}(pTHX_ lpg_scope *, SV *, ${node.name} *, size_t, int);`
		, `static SV *lpg_write${node.index}(pTHX_ lpg_scope *, const ${node.name} *, size_t, int);`);
	for(const node of nodes.values())
	{
		const input = [], output = [], scalar = node.ref.name;
		const readField = (field, slot, target) => {
			const child = nodes.get(field.type);
			return field.storage === "pointer"
				? `{ ${child.name} *child = lpg_allocate(aTHX_ scope, 1, sizeof(*child)); ${target} = child; lpg_read${child.index}(aTHX_ scope, ${slot}, child, depth + 1, 1); }`
				: `lpg_read${child.index}(aTHX_ scope, ${slot}, &${target}, depth + 1, 0);`;
		};
		const writeField = (field, source) => `lpg_write${nodes.get(field.type).index}(aTHX_ scope, ${field.storage === "pointer" ? "" : "&"}${source}, depth + 1, ${field.storage === "pointer" ? 1 : 0})`;
		const fields = (name, fields, targets) => [
			`static const char *const fields[] = {${fields.length ? fields.map(field => JSON.stringify(field.publicName ?? field.name)).join(", ") : "NULL"}};`
			, `SV **slots = lpg_fields(aTHX_ scope, value, ${JSON.stringify(name)}, fields, ${fields.length}); (void)slots;`
			, ...fields.map((field, index) => readField(field, `slots[${index}]`, targets[index]))
		];
		const object = (name, fields, sources) => ["HV *result = lpg_hash(aTHX_ scope);"
			, ...fields.map((field, index) => `lpg_store(aTHX_ scope, result, ${JSON.stringify(field.publicName ?? field.name)}, ${writeField(field, sources[index])});`)
			, `return lpg_reference(aTHX_ scope, (SV *)result, ${JSON.stringify(name)});`];
		if(!inhabited.has(node.id))
		{
			input.push('croak("The declared copied type has no finite value");');
			output.push('lpg_invalid(aTHX_ scope, "uninhabited type"); return NULL;');
		}
		else if(node.kind === "primitive")
		{
			if(!["nat", "int"].includes(scalar)) input.push('if (SvROK(value)) croak("Expected a scalar value");');
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
			else if(["float32", "float64"].includes(scalar))
			{
				input.push('if (!SvNOK(value) && !SvIOK(value)) croak("Float requires a numeric scalar");', `*out = (${node.name})SvNV(value);`);
				output.push("SV *result = lpg_sv(aTHX_ scope); LB_PERL_GRAPH_CHECKPOINT(); sv_setnv(result, *value); return result;");
			}
			else if(["nat", "int"].includes(scalar))
			{
				input.push(`int negative; out->data = lpg_limbs(aTHX_ scope, value, ${scalar === "nat" ? 1 : 0}, &out->length, &negative);`
					, scalar === "int" ? "out->negative = negative;" : "(void)negative;");
				output.push("lpg_charge(aTHX_ &scope->native_bytes, value->length, sizeof(uint32_t));"
					, "lpg_pointer(aTHX_ scope, value->data, value->length, sizeof(uint32_t), _Alignof(uint32_t));"
					, scalar === "int" ? 'uint8_t negative; memcpy(&negative, &value->negative, 1); if (negative > 1) lpg_invalid(aTHX_ scope, "Int sign");' : "uint8_t negative = 0;"
					, "return lpg_bigint(aTHX_ scope, value->data, value->length, negative);");
			}
			else if(["string", "bytes"].includes(scalar))
			{
				input.push('if (!SvPOK(value)) croak("Expected a string scalar");'
					, "STRLEN length; const U8 *bytes = (const U8 *)SvPV_nomg(value, length); size_t size = length;");
				if(scalar === "bytes") input.push('if (SvUTF8(value)) croak("ByteArray requires an octet string");');
				else input.push('if (SvUTF8(value)) { if (length && !is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("String contains invalid Unicode"); }'
					, "else { for (size_t i = 0; i < length; ++i) if (bytes[i] >= 128) { if (size == SIZE_MAX) croak(\"String size overflow\"); ++size; } }");
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
				input.push(`*out = (${node.name})lpg_${unsigned ? "unsigned" : "signed"}(aTHX_ value, ${unsigned ? `UINT${bits}_MAX` : `INT${bits}_MIN, INT${bits}_MAX`});`);
				output.push(`SV *result = lpg_sv(aTHX_ scope); LB_PERL_GRAPH_CHECKPOINT(); sv_set${unsigned ? "uv" : "iv"}(result, *value); return result;`);
			}
		}
		else if(node.element)
		{
			const child = nodes.get(node.element);
			input.push("size_t length; SV **slots = lpg_sequence(aTHX_ scope, value, &length);"
				, `lpg_charge(aTHX_ &scope->native_bytes, length, sizeof(${child.name}));`
				, `${child.name} *data = lpg_allocate(aTHX_ scope, length, sizeof(*data)); out->data = data; out->length = length;`
				, `for (size_t i = 0; i < length; ++i) lpg_read${child.index}(aTHX_ scope, slots[i], &data[i], depth + 1, 0);`);
			output.push(`lpg_charge(aTHX_ &scope->native_bytes, value->length, sizeof(${child.name}));`
				, 'if (value->length > scope->nodes) croak("Perl copied graph node limit exceeded");'
				, `lpg_pointer(aTHX_ scope, value->data, value->length, sizeof(${child.name}), _Alignof(${child.name}));`
				, "AV *result = lpg_array(aTHX_ scope, value->length);"
				, `for (size_t i = 0; i < value->length; ++i) lpg_append(aTHX_ result, i, lpg_write${child.index}(aTHX_ scope, &value->data[i], depth + 1, 0));`
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
			output.push(`if (value->${flag} > 1) lpg_invalid(aTHX_ scope, "branch flag");`);
			if(optional) output.push("if (!value->has_value) return &PL_sv_undef;");
			for(const [index, field] of node.fields.entries())
			{
				const packageName = `${moduleName}::${optional ? "Some" : index === 0 ? "Ok" : "Err"}`;
				const member = { ...field, publicName: "value" };
				input.push(`if (lpg_branch(value, ${JSON.stringify(packageName)})) { out->${flag} = ${index === 0 ? 1 : 0};`
					, ...fields(packageName, [member], [`out->${field.name}`]), "return;", "}");
				output.push(`${optional ? "" : index === 0 ? "if (value->is_ok) " : "else "}{`, ...object(packageName, [member], [`value->${field.name}`]), "}");
			}
			input.push(`croak("Expected ${optional ? "undef or Some" : "Ok or Err"}");`);
		}
		lines.push(`static void lpg_read${node.index}(pTHX_ lpg_scope *scope, SV *value, ${node.name} *out, size_t depth, int storage) {
  (void)out; SvGETMAGIC(value);
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, ${node.index}, depth, storage ? sizeof(*out) : 0, 0);
  ${input.join("\n  ")}
}
static SV *lpg_write${node.index}(pTHX_ lpg_scope *scope, const ${node.name} *value, size_t depth, int storage) {
  lpg_pointer(aTHX_ scope, value, 1, sizeof(*value), _Alignof(${node.name}));
  lpg_enter(aTHX_ scope, value, ${node.index}, depth, storage ? sizeof(*value) : 0, 1);
  ${output.join("\n  ")}
}
`);
	}
	return { ...model, types: [...nodes.values()], valuesSource, typesHeader, source: lines.join("\n") };
};
