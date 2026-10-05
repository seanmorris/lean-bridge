/**
 * Synthetic collection providers isolate Zend conversion and owner cleanup.
 *
 * @file
 */
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { primitiveFields, primitives, packet } from "./record-fixture.mjs";
import { collectionSignatures } from "./collection-fixture.mjs";
import { zendAllocationFixture } from "./php-copied-zend.mjs";

/** Test-only copied C boundary, not compiled Lean or installed-package evidence. */
export const zendCollectionFaultIr = () => corpusReviewedIr({ id: "collection_probe" }, [
	...Object.values(primitiveFields).map(name => ({ name: `Probe.echo_${name}`, parameters: [{ array: { array: name } }], result: { array: { array: name } } }))
	, ...[["primitives", primitives], ["packet", packet], ["deep", collectionSignatures.find(entry => entry.name === "Collections.deep").result]]
		.map(([name, type]) => ({ name: `Probe.echo_${name}`, parameters: [type], result: type }))
	, { name: "Probe.configure", parameters: ["int32"], result: "unit" }
	, { name: "Probe.fail_after", parameters: ["int32"], result: "unit" }
	, ...["live_allocations", "native_calls", "output_clears"].map(name => ({ name: `Probe.${name}`, parameters: [], result: "uint16" }))
]);

/**
 * Keep allocation owners separate from deliberately malformed output headers.
 *
 * @param ir - Independently specified copied-array and record boundary.
 */
export const zendCollectionFaultProvider = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32 });
	const helpers = surface.copies.map(copy => {
		let clear = "", clone, owner = "";
		if(!copy.aggregate) clone = "*out = *input; return 1;";
		else if(copy.record)
		{
			clear = copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join(" ");
			clone = `return ${copy.fields.map(field => `clone${field.type.index}(&input->${field.name}, &out->${field.name})`).join(" && ") || "1"};`;
		}
		else if(copy.element)
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
  ${clear} *value = (${copy.ctype}){0};
}` : ""}
static int clone${copy.index}(const ${copy.ctype} *input, ${copy.ctype} *out) { ${clone} }`;
	}).join("\n");
	const calls = surface.functions.map(fn => {
		const result = surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
		const args = fn.declaration.parameters.map((site, i) => { const copy = surface.copy(site.type); return `${copy.ctype}${copy.aggregate ? " const *" : " "}arg${i}`; }).concat(unit ? [] : [`${result.ctype} *out`]).concat("collection_probe_error *error");
		let body;
		if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "configure") body = "mode = arg0;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else if(fn.field === "native_calls") body = "*out = calls;";
		else if(fn.field === "output_clears") body = "*out = clears;";
		else
		{
			body = `++calls; tracked_output = out; tracked_type = ${result.index}; if (!clone${result.index}(arg0, out)) return 1;`;
			if(result.element) body += `
  if (mode == 1) { out->data = NULL; out->length = 1; }
  if (mode == 2) { out->data = (const ${result.element.ctype} *)1; out->length = 1; }
  if (mode == 3) out->length = SIZE_MAX;
  if (mode == 4) out->length = 524289;
  if (mode == 5) { out->data = (const ${result.element.ctype} *)(__builtin_wasm_memory_size(0) * 65536 - 4); out->length = 2; }
  if (mode == 6) { out->data = (const ${result.element.ctype} *)(UINTPTR_MAX - 3); out->length = 1; }
  if (mode == 10) { out->data = (const ${result.element.ctype} *)1; out->length = 0; }`;
			const scalar = result.element?.element;
			if(scalar && ["unit", "bool", "char", "nat", "int", "string", "bytes"].includes(scalar.scalarName))
			{
				// Only form the leaf address in modes with an intact outer header.
				body += `\n  ${scalar.ctype} *leaf = mode >= 20 ? (${scalar.ctype} *)out->data[0].data : NULL;`;
				if(scalar.scalarName === "unit") body += "\n  if (mode == 20) *leaf = 1;";
				if(scalar.scalarName === "bool") body += "\n  if (mode == 20) { unsigned char raw = 2; memcpy(leaf, &raw, 1); }";
				if(scalar.scalarName === "char") body += "\n  if (mode == 20) *leaf = 0x110000;";
				if(["nat", "int"].includes(scalar.scalarName)) body += `
  if (mode == 21) { leaf->data = NULL; leaf->length = 1; }
  if (mode == 22) { leaf->data = (const uint32_t *)1; leaf->length = 1; }
  if (mode == 23) leaf->length = 1702;
  if (mode == 24) ((uint32_t *)leaf->data)[leaf->length - 1] = 0;
  if (mode == 25) { leaf->data = (const uint32_t *)(__builtin_wasm_memory_size(0) * 65536 - 4); leaf->length = 2; }
  if (mode == 26) { leaf->data = (const uint32_t *)(UINTPTR_MAX - 3); leaf->length = 1; }
  if (mode == 27) {
    uint32_t *large = fixture_allocate(1701, sizeof(uint32_t)); if (!large) return 1;
    memset(large, 255, 1701 * sizeof(uint32_t));
    if (leaf->release) leaf->release(leaf->owner);
    leaf->data = large; leaf->length = 1701; leaf->owner = large; leaf->release = fixture_release;
  }
  if (mode == 28) { leaf->data = (const uint32_t *)1; leaf->length = 0; ${scalar.scalarName === "int" ? "leaf->negative = false;" : ""} }
  ${scalar.scalarName === "int" ? `if (mode == 29) { unsigned char raw = 2; memcpy(&leaf->negative, &raw, 1); }
  if (mode == 30) { leaf->length = 0; leaf->negative = true; }` : ""}`;
				if(["string", "bytes"].includes(scalar.scalarName)) body += `
  if (mode == 40) { leaf->data = NULL; leaf->length = 1; }
  if (mode == 41) { leaf->data = (const ${scalar.scalarName === "string" ? "char" : "uint8_t"} *)(__builtin_wasm_memory_size(0) * 65536 - 1); leaf->length = 2; }
  if (mode == 42) { leaf->data = (const ${scalar.scalarName === "string" ? "char" : "uint8_t"} *)UINTPTR_MAX; leaf->length = 2; }
  if (mode == 43) leaf->length = 16 * 1024 * 1024;
  if (mode == 44) { leaf->data = (const ${scalar.scalarName === "string" ? "char" : "uint8_t"} *)1; leaf->length = 0; }
  ${scalar.scalarName === "string" ? `if (mode == 45) { leaf->data = "\\xff"; leaf->length = 1; }
  if (mode == 90) { error->message = leaf->data; error->message_length = leaf->length; return 7; }
  if (mode == 91) { error->message = (const char *)UINTPTR_MAX; error->message_length = 2; return 7; }` : ""}`;
			}
			if(fn.field === "echo_primitives") body += `
  if (mode == 50) out->unit = 1;
  if (mode == 51) { unsigned char raw = 255; memcpy(&out->flag, &raw, 1); }
  if (mode == 52) out->char_ = 0xd800;
  if (mode == 53) { out->text.data = NULL; out->text.length = 1; }
  if (mode == 54) { out->integer.data = (const uint32_t *)1; out->integer.length = 1; }`;
			body += "\n  if (mode == 7) zend_bailout(); if (mode == 8) fixture_output_bailout = 2;";
		}
		return `collection_probe_status ${fn.name}(${args.join(", ")}) { (void)error; ${body} return 0; }`;
	}).join("\n");
	const allocations = zendAllocationFixture.replace("if (fixture_output_bailout)", "if (fixture_output_bailout && --fixture_output_bailout == 0)");
	return `#include <php.h>\n#include "collection_probe.h"\n${allocations}
static int mode, tracked_type; static uint16_t calls, clears; static void *tracked_output;
${helpers}\n${calls}\n`;
};
