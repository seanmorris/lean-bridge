/**
 * Synthetic variant providers isolate Zend ownership and malformed-wire checks.
 *
 * @file
 */
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { phpVariantReviewedIr } from "./php-variant-fixture.mjs";
import { zendAllocationFixture } from "./php-copied-zend.mjs";

/** Describe a synthetic C boundary, not a compiled or installed Lean library. */
export const zendVariantFaultIr = () => {
	const ir = phpVariantReviewedIr(), base = structuredClone(ir.declarations[0]);
	ir.declarations = ir.declarations.filter(fn => fn.name.startsWith("echo_") || fn.name === "signals");
	for(const [name, parameters, result] of [["configure", ["int32"], "unit"], ["fail_after", ["int32"], "unit"], ["live_allocations", [], "uint16"], ["native_calls", [], "uint16"], ["output_clears", [], "uint16"]])
	{
		const declaration = `Variants.${name}`;
		ir.declarations.push({ ...structuredClone(base)
			, id: "lean:" + declaration, name
			, overloadKey: declaration, source: { ...base.source, declaration }
			, parameters: parameters.map((name, index) => ({ ...base.parameters[0], name: `value${index}`, type: { kind: "primitive", name } }))
			, result: { ...base.result, type: { kind: "primitive", name: result } } });
	}
	return ir;
};

/**
 * Own copied payloads independently of any corrupted output header.
 *
 * @param ir - Synthetic boundary with the seven independently specified families.
 */
export const zendVariantFaultProvider = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32, lists: true, variants: true });
	const helpers = surface.copies.map(copy => {
		let clear = "", clone, owner = "", restore = "";
		if(!copy.aggregate) clone = "*out = *input; return 1;";
		else if(copy.variant)
		{
			owner = `static ${copy.ctype} saved${copy.index}; static ${copy.ctype} *poisoned${copy.index};`;
			restore = `if (value == poisoned${copy.index}) { *value = saved${copy.index}; poisoned${copy.index} = NULL; memset(&saved${copy.index}, 0, sizeof(saved${copy.index})); }`;
			clear = `switch (value->kind) { ${copy.cases.map((branch, index) => `case ${index}: ${branch.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->cases.${branch.name}.${field.name});`).join(" ")} break;`).join(" ")} }`;
			clone = `out->kind = input->kind; switch (input->kind) { ${copy.cases.map((branch, index) => `case ${index}: return ${branch.fields.map(field => `clone${field.type.index}(&input->cases.${branch.name}.${field.name}, &out->cases.${branch.name}.${field.name})`).join(" && ") || "1"};`).join(" ")} default: return 0; }`;
		} else if(copy.record || copy.compound)
		{
			clear = copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join(" ");
			const field = copy.fields[0];
			if(copy.compound === "option") clone = `out->has_value = input->has_value; return !input->has_value || clone${field.type.index}(&input->value, &out->value);`;
			else if(copy.compound === "result") clone = `out->is_ok = input->is_ok; return input->is_ok ? clone${field.type.index}(&input->ok, &out->ok) : clone${copy.fields[1].type.index}(&input->error, &out->error);`;
			else clone = `return ${copy.fields.map(field => `clone${field.type.index}(&input->${field.name}, &out->${field.name})`).join(" && ")};`;
		} else if(copy.element)
		{
			const element = copy.element;
			owner = `typedef struct { size_t count; ${element.ctype} data[]; } owner${copy.index};
static void release${copy.index}(void *opaque) {
  owner${copy.index} *owner = opaque;
  ${element.aggregate ? `for (size_t i = 0; i < owner->count; ++i) ${element.name}_clear(&owner->data[i]);` : ""}
  fixture_release(owner);
}`;
			clear = "if (value->release) value->release(value->owner);";
			clone = `owner${copy.index} *owner = fixture_allocate(1, sizeof(*owner) + input->length * sizeof(*input->data));
  if (!owner) return 0; owner->count = input->length;
  out->data = owner->data; out->length = input->length; out->owner = owner; out->release = release${copy.index};
  for (size_t i = 0; i < input->length; ++i) if (!clone${element.index}(&input->data[i], &owner->data[i])) return 0;
  return 1;`;
		} else
		{
			clear = "if (value->release) value->release(value->owner);";
			clone = `void *data = fixture_allocate(input->length ? input->length : 1, sizeof(*input->data)); if (!data) return 0;
  if (input->length) memcpy(data, input->data, input->length * sizeof(*input->data));
  out->data = data; out->length = input->length; out->owner = data; out->release = fixture_release;
  ${copy.scalarName === "int" ? "out->negative = input->negative;" : ""} return 1;`;
		}
		return `${owner}
${copy.aggregate ? `void ${copy.name}_clear(${copy.ctype} *value) {
  if ((void *)value == tracked_output && tracked_type == ${copy.index}) { ++clears; tracked_output = NULL; }
  ${restore} ${clear} *value = (${copy.ctype}){0};
}` : ""}
static int clone${copy.index}(const ${copy.ctype} *input, ${copy.ctype} *out) { ${clone} }`;
	}).join("\n");
	const calls = surface.functions.map(fn => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		const args = fn.declaration.parameters.map((site, i) => { const copy = surface.copy(site.type); return `${copy.ctype}${copy.aggregate ? " const *" : " "}arg${i}`; }).concat(unit ? [] : [`${result.ctype} *out`]).concat("variants_error *error");
		let body;
		if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "configure") body = "mode = arg0;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else if(fn.field === "native_calls") body = "*out = calls;";
		else if(fn.field === "output_clears") body = "*out = clears;";
		else
		{
			body = `++calls; tracked_output = out; tracked_type = ${result.index}; if (!clone${result.index}(arg0, out)) return 1;`;
			if(result.variant)
			{
				body += `\n  if (mode == 1 || mode == 2) {
    saved${result.index} = *out; poisoned${result.index} = out;
    memset(&out->cases, 255, sizeof(out->cases));
    if (mode == 1) out->kind = ${result.cases.length + 17};
  }`;
				const corrupt = {
					echo_signal: `if (mode == 3) { out->cases.data.label.data = "\\xff"; out->cases.data.label.length = 1; }
  if (mode == 13) { error->message = out->cases.data.label.data; error->message_length = out->cases.data.label.length; return 7; }`
					, echo_buffers: `if (mode == 4) { out->cases.pair.second.data = NULL; out->cases.pair.second.length = 1; }
  if (mode == 9) out->cases.pair.second.length = 16 * 1024 * 1024;`
					, echo_scalars: "if (mode == 5) out->cases.all.char_ = 0x110000;"
					, echo_nested: `if (mode == 6) out->cases.packet.value.fallback.has_value = 2;
  if (mode == 10) out->cases.packet.value.current.kind = UINT32_MAX;
  if (mode == 12) { out->cases.packet.value.events.data = NULL; out->cases.packet.value.events.length = 1; }`
				}[fn.field];
				if(corrupt) body += `\n  if (mode >= 3 && mode != 7 && mode != 8 && mode != 13) { saved${result.index} = *out; poisoned${result.index} = out; }\n  ${corrupt}`;
			}
			body += "\n  if (mode == 7) zend_bailout(); if (mode == 8) fixture_output_bailout = 2;";
		}
		return `variants_status ${fn.name}(${args.join(", ")}) { (void)error; ${body} return 0; }`;
	}).join("\n");
	const allocations = zendAllocationFixture.replace("if (fixture_output_bailout)", "if (fixture_output_bailout && --fixture_output_bailout == 0)");
	return `#include <php.h>\n#include "variants.h"\n${allocations}
static int mode, tracked_type; static uint16_t calls, clears; static void *tracked_output;
${helpers}\n${calls}\n`;
};
