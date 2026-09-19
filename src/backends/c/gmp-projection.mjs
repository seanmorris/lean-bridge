/**
 * Public C/GMP facade over the private copied-value and callable ABI.
 *
 * @file
 */
import { cIdentifier } from "./generate.mjs";
import { compilePrimitiveCSurface, rejectPrimitiveSurface } from "./primitive-surface.mjs";
import { gmpAddress, gmpInput, gmpInteger, gmpName, gmpOutput, renderGmpValues } from "./gmp-values.mjs";

/**
 * Reject public GMP identifiers that would collide before native compilation.
 *
 * @param surface - Checked private C surface.
 */
export const validateGmpSurface = surface => {
	if(!surface.copies.some(gmpInteger)) return;
	if(surface.prefix === "gmp") rejectPrimitiveSurface(surface.functions[0]?.declaration, "C component name gmp collides with the supplied gmp.h; choose another component name");
	const initializers = new Set(surface.copies.filter(copy => copy.aggregate).map(copy => `${copy.name}_init`));
	for(const fn of surface.functions) if(initializers.has(fn.name)) rejectPrimitiveSurface(fn.declaration, "C export collides with a generated GMP aggregate initializer");
	for(const copy of surface.copies) if(initializers.has(copy.name)) rejectPrimitiveSurface(surface.functions[0]?.declaration, "C record name collides with a generated GMP aggregate initializer");
};

/**
 * Generate the prepared C API without altering any other host's C transport.
 *
 * @param ir - Compiler-checked Binding IR.
 */
export const generateGmpProjection = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true }), p = surface.prefix, g = `${p}_gmp`, m = p.toUpperCase(), gm = g.toUpperCase();
	validateGmpSurface(surface);
	const copied = renderGmpValues(surface), functions = [], implementations = [], callbacks = [];
	const site = ref => surface.callbacks.get(ref.id) ?? surface.copy(ref);
	const callable = copy => Boolean(copy.type?.callable), unit = copy => copy.scalarName === "unit";
	const owned = copy => `${p}_owned_${copy.field}`, publicOwned = copy => `${g}_owned_${copy.field}`;
	const input = (copy, name) => callable(copy) ? `${gmpName(surface, copy)} const* ${name}` : gmpInput(surface, copy, name);
	const output = (copy, name) => callable(copy) ? `${publicOwned(copy)}** ${name}` : gmpOutput(surface, copy, name);
	const errorValues = [["NONE", 0], ["INVALID_ARGUMENT", 1], ["RUNTIME_UNAVAILABLE", 2], ...ir.errors.map((error, i) => [cIdentifier(error.name).toUpperCase(), i + 100]), ["UNEXPECTED", 65535]];
	const statusNames = ["OK", "INVALID_ARGUMENT", "RUNTIME_UNAVAILABLE", "RUNTIME_REJECTED", "DECLARED_ERROR", "UNEXPECTED_ERROR"];
	const describe = (name, result, parameters, args) => { const fn = { name, result, parameters, args }; functions.push(fn); return `${result} ${name}(${parameters.join(", ")})`; };
	const converters = [...surface.callbacks.values()];
	for(const [index, callback] of converters.entries())
	{
		const c = callback.type.callable, params = c.parameters.map(parameter => surface.copy(parameter.type)), result = surface.copy(c.result.type);
		const n = gmpName(surface, callback), o = publicOwned(callback);
		callbacks.push(`typedef ${g}_status (*${n}_fn)(${["void* context", ...params.map((copy, i) => input(copy, `arg${i}`)), ...unit(result) ? [] : [output(result, "out")], `${g}_error* error`].join(", ")});`
			, `typedef struct ${n} { ${n}_fn call; void* context; } ${n};`, `typedef struct ${o} ${o};`);
		const rawParameters = ["void* context", ...params.map((copy, i) => `${copy.name}${copy.aggregate ? " const*" : ""} arg${i}`), ...unit(result) ? [] : [`${result.name}* out`], `${p}_error* error`];
		const lines = [`struct lb_gmp_callback${index} { ${n} const* callback; };`
			, `static inline ${p}_status lb_gmp_callback${index}_call(${rawParameters.join(", ")}) {`
			, `  struct lb_gmp_callback${index}* self = context; ${p}_status status = ${m}_STATUS_OK;`
			, `  ${g}_error host_error = {0}; ${p}_error failure = {0}; char message[1024]; size_t budget = 16u * 1024u * 1024u; int converted = 1; (void)converted; (void)budget;`];
		for(const [i, copy] of params.entries()) lines.push(`  ${gmpName(surface, copy)} value${i}; lb_gmp_init${copy.index}(${gmpAddress(copy, `value${i}`)});`);
		if(!unit(result)) lines.push(`  ${gmpName(surface, result)} result; lb_gmp_init${result.index}(${gmpAddress(result, "result")});`, `  ${result.name} wire = {0};`);
		for(const [i, copy] of params.entries()) lines.push(`  if ((converted = lb_gmp_from${copy.index}(${copy.aggregate ? "" : "&"}arg${i}, ${gmpAddress(copy, `value${i}`)}, &budget)) != 1) { status = lb_gmp_failure(converted, &failure); goto finish; }`);
		for(const [i, copy] of params.entries()) if(copy.aggregate && !gmpInteger(copy)) lines.push(`  ${gmpName(surface, copy)} borrow${i} = value${i}; borrow${i}.owner = NULL; borrow${i}.release = NULL;`);
		lines.push(`  status = (${p}_status)self->callback->call(${["self->callback->context", ...params.map((copy, i) => copy.aggregate && !gmpInteger(copy) ? `&borrow${i}` : `value${i}`), ...unit(result) ? [] : [gmpAddress(result, "result")], "&host_error"].join(", ")});`
			, `  failure = (${p}_error){(${p}_error_code)host_error.code, host_error.message, host_error.message_length};`
			, `  if (status != ${m}_STATUS_OK) goto finish;`);
		if(!unit(result)) lines.push(`  if ((converted = lb_gmp_to${result.index}(${gmpAddress(result, "result")}, &wire, &budget)) != 1) { status = lb_gmp_failure(converted, &failure); goto finish; }`
			, `  *out = wire; memset(&wire, 0, sizeof(wire));`);
		lines.push("finish:", "  lb_gmp_save_error(&failure, message);");
		for(const [i, copy] of params.entries()) lines.push(`  lb_gmp_clear${copy.index}(${gmpAddress(copy, `value${i}`)});`);
		if(!unit(result)) lines.push(`  lb_gmp_clear${result.index}(${gmpAddress(result, "result")});`, ...result.aggregate ? [`  ${result.name}_clear(&wire);`] : []);
		lines.push("  lb_gmp_publish_error(&failure); if (error) *error = failure; return status;", "}");
		implementations.push(lines.join("\n"));
	}
	const wrap = (name, rawName, parameters, result, closure = null) => {
		const publicParameters = [...closure ? [`${publicOwned(closure)} const* self`] : [], ...parameters.map(({ copy, name }) => input(copy, name)), ...unit(result) ? [] : [output(result, "out")], `${g}_error* error`];
		const argumentNames = [...closure ? ["self"] : [], ...parameters.map(parameter => parameter.name), ...unit(result) ? [] : ["out"], "error"];
		const signature = describe(name, `${g}_status`, publicParameters, argumentNames);
		const lines = [`${signature} {`
			, `  ${p}_status status = ${m}_STATUS_OK; ${p}_error failure = {0}; char message[1024];`
			, "  size_t budget = 16u * 1024u * 1024u; int converted = 1; (void)budget; (void)converted;"];
		const nonnull = parameters.filter(({ copy }) => copy.aggregate || callable(copy)).map(({ name }) => `!${name}${callable(parameters.find(parameter => parameter.name === name).copy) ? ` || !${name}->call` : ""}`);
		if(!unit(result)) nonnull.push("!out");
		if(nonnull.length) lines.push(`  if (${nonnull.join(" || ")}) return lb_gmp_finish(lb_gmp_failure(0, &failure), &failure, error);`);
		for(const [i, { copy, name }] of parameters.entries())
		{
			if(callable(copy))
			{
				const id = converters.findIndex(callback => callback === copy);
				lines.push(`  struct lb_gmp_callback${id} context${i} = {${name}};`, `  ${copy.name} wire${i} = {lb_gmp_callback${id}_call, &context${i}};`);
			} else lines.push(`  ${copy.name} wire${i} = {0};`);
		}
		if(!unit(result))
		{
			if(callable(result)) lines.push(`  ${owned(result)}* wire_result = NULL;`);
			else lines.push(`  ${result.name} wire_result = {0};`, `  ${gmpName(surface, result)} result; lb_gmp_init${result.index}(${gmpAddress(result, "result")});`);
		}
		for(const [i, { copy, name }] of parameters.entries()) if(!callable(copy))
			lines.push(`  if ((converted = lb_gmp_to${copy.index}(${copy.aggregate ? name : `&${name}`}, &wire${i}, &budget)) != 1) { status = lb_gmp_failure(converted, &failure); goto finish; }`);
		const callArgs = [...closure ? [`(const ${owned(closure)}*)self`] : [], ...parameters.map(({ copy }, i) => `${copy.aggregate || callable(copy) ? "&" : ""}wire${i}`), ...unit(result) ? [] : ["&wire_result"], "&failure"];
		lines.push(`  status = ${rawName}(${callArgs.join(", ")});`, `  if (status != ${m}_STATUS_OK) goto finish;`);
		if(!unit(result))
		{
			if(callable(result)) lines.push(`  *out = (${publicOwned(result)}*)wire_result; wire_result = NULL;`);
			else lines.push(`  if ((converted = lb_gmp_from${result.index}(&wire_result, ${gmpAddress(result, "result")}, &budget)) != 1) { status = lb_gmp_failure(converted, &failure); goto finish; }`
				, `  lb_gmp_swap${result.index}(out, ${gmpAddress(result, "result")});`);
		}
		lines.push("finish:", "  lb_gmp_save_error(&failure, message);");
		for(const [i, { copy }] of parameters.entries()) if(!callable(copy) && copy.aggregate) lines.push(`  ${copy.name}_clear(&wire${i});`);
		if(!unit(result))
		{
			if(callable(result)) lines.push(`  ${owned(result)}_dispose(&wire_result);`);
			else lines.push(...result.aggregate ? [`  ${result.name}_clear(&wire_result);`] : [], `  lb_gmp_clear${result.index}(${gmpAddress(result, "result")});`);
		}
		lines.push("  return lb_gmp_finish(status, &failure, error);", "}");
		implementations.push(lines.join("\n"));
	};
	for(const callback of converters)
	{
		const c = callback.type.callable, o = publicOwned(callback), raw = owned(callback);
		wrap(`${o}_call`, `${raw}_call`, c.parameters.map((parameter, i) => ({ copy: surface.copy(parameter.type), name: `arg${i}` })), surface.copy(c.result.type), callback);
		const signature = describe(`${o}_dispose`, "void", [`${o}** self`], ["self"]);
		implementations.push(`${signature} { if (!self) return; ${raw}* value = (${raw}*)*self; ${raw}_dispose(&value); *self = (${o}*)value; }`);
	}
	for(const fn of surface.functions) wrap(`${g}_${fn.field}`, fn.name, fn.parameters.map((parameter, i) => ({ name: `_lb_arg${i}`, copy: site(fn.declaration.parameters[i].type) })), site(fn.declaration.result.type));
	const aliases = [`typedef ${g}_status ${p}_status;`
		, `typedef ${g}_error_code ${p}_error_code;`
		, `typedef ${g}_error ${p}_error;`
		, ...statusNames.map(name => `#define ${m}_STATUS_${name} ${gm}_STATUS_${name}`)
		, ...errorValues.map(([name]) => `#define ${m}_ERROR_${name} ${gm}_ERROR_${name}`)];
	for(const copy of surface.copies.filter(copy => copy.aggregate))
	{
		const n = gmpName(surface, copy); aliases.push(`typedef ${n} ${copy.name};`);
		for(const action of ["init", "clear"]) aliases.push(`static inline void ${copy.name}_${action}(${gmpOutput(surface, copy, "value")}) { ${n}_${action}(value); }`);
	}
	for(const callback of converters) for(const [raw, name] of [[callback.name, gmpName(surface, callback)], [`${callback.name}_fn`, `${gmpName(surface, callback)}_fn`], [owned(callback), publicOwned(callback)]]) aliases.push(`typedef ${name} ${raw};`);
	for(const fn of functions) aliases.push(`static inline ${fn.result.replace(`${g}_`, `${p}_`)} ${fn.name.replace(`${g}_`, `${p}_`)}(${fn.parameters.join(", ").replaceAll(`${g}_`, `${p}_`)}) { ${fn.result === "void" ? "" : "return "}${fn.name}(${fn.args.join(", ")}); }`);
	const header = `#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <gmp.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef enum ${g}_status { ${statusNames.map((name, i) => `${gm}_STATUS_${name} = ${i}`).join(", ")} } ${g}_status;
typedef enum ${g}_error_code { ${errorValues.map(([name, i]) => `${gm}_ERROR_${name} = ${i}`).join(", ")} } ${g}_error_code;
typedef struct { ${g}_error_code code; const char* message; size_t message_length; } ${g}_error;
${copied.declarations}
${callbacks.join("\n")}
${functions.map(fn => `${fn.result} ${fn.name}(${fn.parameters.join(", ")});`).join("\n")}
#ifdef __cplusplus
}
#endif
`;
	return { surface, library: `lib${g}.so`
		, files: {
			[`include/detail/${g}.h`]: header
			, [`include/${p}.h`]: `#pragma once\n#include "detail/${g}.h"\n${aliases.join("\n")}\n`
			, [`src/${g}.c`]: `#include "${p}.h"
#include "detail/${g}.h"
#include <stdlib.h>
#include <string.h>
static _Thread_local char lb_gmp_message[1024];
static int lb_gmp_charge(size_t* budget, size_t count, size_t width) { if (count > *budget / width) return 0; *budget -= count * width; return 1; }
static ${p}_status lb_gmp_failure(int converted, ${p}_error* error) {
  const char* text = converted == 0 ? "Invalid copied value, negative Nat or 16 MiB call limit exceeded" : "Cannot allocate copied GMP value";
  *error = (${p}_error){converted == 0 ? ${m}_ERROR_INVALID_ARGUMENT : ${m}_ERROR_UNEXPECTED, text, strlen(text)};
  return converted == 0 ? ${m}_STATUS_INVALID_ARGUMENT : ${m}_STATUS_UNEXPECTED_ERROR;
}
static void lb_gmp_save_error(${p}_error* error, char* text) {
  size_t length = error->message ? error->message_length : 0; if (length > 1023) length = 1023;
  if (length) memcpy(text, error->message, length);
  text[length] = 0; error->message = text; error->message_length = length;
}
static void lb_gmp_publish_error(${p}_error* error) {
  if (error->message_length) {
    memmove(lb_gmp_message, error->message, error->message_length);
    lb_gmp_message[error->message_length] = 0; error->message = lb_gmp_message;
  } else error->message = NULL;
}
static ${g}_status lb_gmp_finish(${p}_status status, ${p}_error* failure, ${g}_error* error) {
  lb_gmp_publish_error(failure);
  if (error) *error = (${g}_error){(${g}_error_code)failure->code, failure->message, failure->message_length};
  return (${g}_status)status;
}
${copied.definitions}
${implementations.join("\n\n")}
` } };
};
