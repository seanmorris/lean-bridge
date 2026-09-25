/**
 * Synthetic C providers isolate Zend callback ownership from Lean semantics.
 *
 * @file
 */
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";

/** Test-only controls do not enter any published or installed Lean package. */
export const zendStructuredCallableFaultIr = () => {
	const ir = structuredCallableReviewedIr(), base = structuredClone(ir.declarations.find(fn => fn.name === "makeArray"));
	ir.declarations = ir.declarations.filter(fn => !["retainRecord", "afterFailure"].includes(fn.name));
	for(const [name, parameters, result] of [
		["fail_after", ["int32"], "unit"]
		, ["live_allocations", [], "uint16"]
		, ["owned_buffers", [], "uint32"]
	]) {
		const declaration = `Structured.${name}`;
		ir.declarations.push({ ...structuredClone(base)
			, id: `lean:${declaration}`, name, overloadKey: declaration
			, source: { ...base.source, declaration }
			, parameters: parameters.map((name, index) => ({ ...base.parameters[0], name: `value${index}`, type: { kind: "primitive", name } }))
			, result: { type: { kind: "primitive", name: result }, ownership: "copy", lifetime: null } });
	}
	return ir;
};

export const zendStructuredAllocationHeader = String.raw`
#include <stdlib.h>
void *fixture_allocate(size_t count, size_t size);
void fixture_release(void *pointer);
#define LB_ZEND_CALLOC fixture_allocate
#define LB_ZEND_FREE fixture_release
`;

/**
 * Verify each callback buffer belongs to the surviving C scope before reading it.
 * A borrowed Zend string fails deterministically instead of relying on heap reuse.
 *
 * @param ir - Independently declared synthetic callback boundary.
 */
export const zendStructuredCallableFaultProvider = ir => {
	const { surface } = compileCopiedPhpModel(ir, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
	const value = ref => surface.copy(ref) ?? surface.callbacks.get(ref.id);
	const argument = (copy, name) => `${copy.ctype}${copy.aggregate || copy.type?.callable ? " const *" : " "}${name}`;
	const helpers = surface.copies.map(copy => {
		let clear = "", clone, borrowed, owner = "";
		if(!copy.aggregate)
		{ clone = "*out = *input; return 1;"; borrowed = "(void)input; return 1;"; }
		else if(copy.variant)
		{
			clear = `switch (value->kind) { ${copy.cases.map((branch, index) => `case ${index}: ${branch.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->cases.${branch.name}.${field.name});`).join(" ")} break;`).join(" ")} }`;
			clone = `out->kind = input->kind; switch (input->kind) { ${copy.cases.map((branch, index) => `case ${index}: return ${branch.fields.map(field => `clone${field.type.index}(&input->cases.${branch.name}.${field.name}, &out->cases.${branch.name}.${field.name})`).join(" && ") || "1"};`).join(" ")} default: return 0; }`;
			borrowed = `switch (input->kind) { ${copy.cases.map((branch, index) => `case ${index}: return ${branch.fields.map(field => `borrowed${field.type.index}(&input->cases.${branch.name}.${field.name})`).join(" && ") || "1"};`).join(" ")} default: return 0; }`;
		} else if(copy.record || copy.compound)
		{
			clear = copy.fields.filter(field => field.type.aggregate).map(field => `${field.type.name}_clear(&value->${field.name});`).join(" ");
			const field = copy.fields[0];
			if(copy.compound === "option")
			{
				clone = `out->has_value = input->has_value; return !input->has_value || clone${field.type.index}(&input->value, &out->value);`;
				borrowed = `return !input->has_value || borrowed${field.type.index}(&input->value);`;
			} else if(copy.compound === "result")
			{
				clone = `out->is_ok = input->is_ok; return input->is_ok ? clone${field.type.index}(&input->ok, &out->ok) : clone${copy.fields[1].type.index}(&input->error, &out->error);`;
				borrowed = `return input->is_ok ? borrowed${field.type.index}(&input->ok) : borrowed${copy.fields[1].type.index}(&input->error);`;
			} else
			{
				clone = `return ${copy.fields.map(field => `clone${field.type.index}(&input->${field.name}, &out->${field.name})`).join(" && ") || "1"};`;
				borrowed = `return ${copy.fields.map(field => `borrowed${field.type.index}(&input->${field.name})`).join(" && ") || "1"};`;
			}
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
			borrowed = `if (!fixture_owned(input->data, input->length * sizeof(*input->data))) return 0;
  for (size_t i = 0; i < input->length; ++i) if (!borrowed${element.index}(&input->data[i])) return 0;
  return 1;`;
		} else
		{
			clear = "if (value->release) value->release(value->owner);";
			clone = `void *data = fixture_allocate(input->length ? input->length : 1, sizeof(*input->data)); if (!data) return 0;
  if (input->length) memcpy(data, input->data, input->length * sizeof(*input->data));
  out->data = data; out->length = input->length; out->owner = data; out->release = fixture_release;
  ${copy.scalarName === "int" ? "out->negative = input->negative;" : ""} return 1;`;
			borrowed = "return fixture_owned(input->data, input->length * sizeof(*input->data));";
		}
		return `${owner}
${copy.aggregate ? `void ${copy.name}_clear(${copy.ctype} *value) { ${clear} *value = (${copy.ctype}){0}; }` : ""}
static int clone${copy.index}(const ${copy.ctype} *input, ${copy.ctype} *out) { ${clone} }
static int borrowed${copy.index}(const ${copy.ctype} *input) { ${borrowed} }`;
	}).join("\n");
	const owners = [...surface.callbacks.values()].map(callback => {
		const output = value(callback.type.callable.result.type), args = callback.type.callable.parameters.map(site => value(site.type));
		return `struct ${callback.ownedType} { ${output.ctype} captured; };
void ${callback.ownedType}_dispose(${callback.ownedType} **pointer) {
  if (!pointer || !*pointer) return;
  ${callback.ownedType} *owner = *pointer; *pointer = NULL;
  ${output.name}_clear(&owner->captured); fixture_release(owner);
}
${surface.prefix}_status ${callback.ownedType}_call(const ${callback.ownedType} *owner, ${args.map((copy, i) => argument(copy, `arg${i}`)).join(", ")}, ${output.ctype} *out, ${surface.prefix}_error *error) {
  (void)error;
  return clone${output.index}(${args.length === 2 ? "arg0 ? &owner->captured : arg1" : "arg0"}, out) ? 0 : 1;
}`;
	}).join("\n");
	const functions = surface.functions.map(fn => {
		const args = fn.declaration.parameters.map(site => value(site.type)), output = value(fn.declaration.result.type);
		const owned = Boolean(output.type?.callable), unit = output.scalarName === "unit";
		let body;
		if(fn.field === "fail_after") body = "fixture_fail = arg0;";
		else if(fn.field === "live_allocations") body = "*out = (uint16_t)(fixture_live - 1);";
		else if(fn.field === "owned_buffers") body = "*out = fixture_owner_checks;";
		else if(owned) body = `*out = fixture_allocate(1, sizeof(**out)); if (!*out) return 1;
  if (!clone${args[0].index}(arg0, &(*out)->captured)) return 1;`;
		else
		{
			body = `${output.ctype} reply = {0};
  int status = arg1->call(arg1->context, arg0, &reply, error); if (status) return status;
  if (!borrowed${output.index}(&reply)) { error->message = "Callback buffer is not owned by the C scope"; error->message_length = strlen(error->message); return 7; }`;
			if(fn.field.startsWith("twice_")) body += `
  ${output.ctype} second = {0};
  status = arg1->call(arg1->context, &reply, &second, error); if (status) return status;
  if (!borrowed${output.index}(&second)) return 7;
  reply = second;`;
			body += `\n  if (!clone${output.index}(&reply, out)) return 1;`;
		}
		return `${surface.prefix}_status ${fn.name}(${[...args.map((copy, i) => argument(copy, `arg${i}`)), ...unit ? [] : [owned ? `${output.ownedType} **out` : `${output.ctype} *out`], `${surface.prefix}_error *error`].join(", ")}) {
  (void)error; ${body} return 0;
}`;
	}).join("\n");
	return `#include <php.h>
#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include "${surface.prefix}.h"
typedef struct tracked { void *pointer; size_t bytes; struct tracked *next; } tracked;
static tracked *allocations;
static int fixture_live, fixture_fail = -1;
static uint32_t fixture_owner_checks;
void *fixture_allocate(size_t count, size_t size) {
  if (fixture_fail == 0) { fixture_fail = -1; return NULL; }
  if (fixture_fail > 0) --fixture_fail;
  if (size && count > SIZE_MAX / size) return NULL;
  void *pointer = calloc(count, size); if (!pointer) return NULL;
  tracked *entry = malloc(sizeof(*entry)); if (!entry) { free(pointer); return NULL; }
  *entry = (tracked){ pointer, count * size, allocations }; allocations = entry; ++fixture_live;
  return pointer;
}
void fixture_release(void *pointer) {
  if (!pointer) return;
  tracked **link = &allocations; while (*link && (*link)->pointer != pointer) link = &(*link)->next;
  assert(*link); tracked *entry = *link; *link = entry->next;
  memset(pointer, 0xa5, entry->bytes); free(pointer); free(entry); --fixture_live;
}
static int fixture_owned(const void *pointer, size_t bytes) {
  ++fixture_owner_checks;
  for (tracked *entry = allocations; entry; entry = entry->next) if (entry->pointer == pointer && entry->bytes >= bytes) return 1;
  return 0;
}
${helpers}
${owners}
${functions}
`;
};
