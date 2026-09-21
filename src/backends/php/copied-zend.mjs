/**
 * Model-driven Zend boundary for pure copied APIs, including 32-bit PHP-Wasm.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateCBindingPackage } from "../c/generate.mjs";
import { compileCopiedPhpModel } from "./copied-model.mjs";
import { phpCopiedAliases } from "./copied-aliases.mjs";
import { copiedPhpPublicSource } from "./copied-values.mjs";
import { copiedPhpChecks } from "./copied-conversions.mjs";
import { copiedZendSupport } from "./copied-zend-support.mjs";
import { copiedZendConversions } from "./copied-zend-conversions.mjs";
import { phpZendVariantWire } from "./copied-zend-variants.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";
import { phpZendLease, phpZendCall, phpZendCallableMethods, zendCallableOwners, zendCallableTrampolines, zendCallableCalls } from "./zend-callables.mjs";

const phpWire = model => model.surface.copies.map(copy => {
	if(copy.variant) return phpZendVariantWire(model, copy);
	const name = copy.scalarName, ns = `\\${model.namespace}\\`;
	let input = "$value", output = "$value";
	if(copy.publicType === "\\Brick\\Math\\BigInteger")
	{ input = "(string) $value"; output = "\\Brick\\Math\\BigInteger::of($value)"; }
	else if(name === "bytes")
	{ input = "$value->toString()"; output = `${ns}Bytes::fromString($value)`; }
	else if(copy.compound === "option")
	{
		input = `$value === null ? null : [self::to${copy.fields[0].type.index}($value->value)]`;
		output = `$value === null ? null : new ${ns}Some(self::from${copy.fields[0].type.index}($value[0]))`;
	} else if(copy.compound === "result")
	{
		input = `$value instanceof ${ns}Ok ? [true, self::to${copy.fields[0].type.index}($value->value)] : [false, self::to${copy.fields[1].type.index}($value->value)]`;
		output = `$value[0] ? new ${ns}Ok(self::from${copy.fields[0].type.index}($value[1])) : new ${ns}Err(self::from${copy.fields[1].type.index}($value[1]))`;
	} else if(copy.compound === "tuple")
	{
		input = `[${copy.fields.map((field, i) => `self::to${field.type.index}($value[${i}])`).join(", ")}]`;
		output = `[${copy.fields.map((field, i) => `self::from${field.type.index}($value[${i}])`).join(", ")}]`;
	}
	else if(copy.record)
	{
		input = `[${copy.fields.map(field => `self::to${field.type.index}($value->${field.name})`).join(", ")}]`;
		output = `new ${ns}${copy.publicName}(${copy.fields.map((field, i) => `self::from${field.type.index}($value[${i}])`).join(", ")})`;
	} else if(copy.element)
	{
		input = `array_map(self::to${copy.element.index}(...), $value)`;
		output = `array_map(self::from${copy.element.index}(...), $value)`;
	}
	return `    private static function to${copy.index}(mixed $value): mixed { return ${input}; }
    private static function from${copy.index}(mixed $value): mixed { return ${output}; }`;
}).join("\n");

const nativePhp = (model, transport, library) => `<?php
declare(strict_types=1);
${library ? copiedPhpWasmLoader : ""}
namespace ${model.namespace}\\Internal {

final class Budget
{
    private int $remaining = 16 * 1024 * 1024;
    public function charge(int $count, int $width = 1): void {
        if ($count < 0 || $width < 1 || $count > intdiv($this->remaining, $width)) {
            throw new \\ValueError('16 MiB PHP conversion limit exceeded');
        }
        $this->remaining -= $count * $width;
    }
}
final class Checks
{
${copiedPhpChecks(model)}
}
${model.surface.callbacks.size ? phpZendLease : ""}
final class Native
{
${phpWire(model)}
${model.surface.callbacks.size ? phpZendCallableMethods(model, transport) : ""}
${model.surface.functions.map((fn, index) => model.surface.callbacks.size ? phpZendCall(model, transport, library, { name: `call${index}`, entry: `call${index}`, parameters: fn.declaration.parameters, result: fn.declaration.result }) : `    public static function call${index}(${fn.parameters.map((_, i) => `mixed $arg${i}`).join(", ")}): mixed {
        $budget = new Budget();
${fn.declaration.parameters.map((site, i) => { const c = model.surface.copy(site.type); return `        $input${i} = self::to${c.index}(Checks::check${c.index}($arg${i}, $budget));`; }).join("\n")}
        if (!function_exists('${transport}\\\\call${index}')) {
            ${library ? `try { \\LeanBridge\\CopiedPhpWasmV1\\Loader::load('${library}', '${transport}\\\\call${index}'); }
            catch (\\Throwable $error) { throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), 0, $error); }` : `throw new \\${model.namespace}\\LeanBridgeError('The generated Zend transport is not loaded');`}
        }
        try { $output = \\${transport}\\call${index}(${fn.parameters.map((_, i) => `$input${i}`).join(", ")}); }
        catch (\\Exception $error) { throw new \\${model.namespace}\\LeanBridgeError($error->getMessage(), $error->getCode(), $error); }
        return self::from${model.surface.copy(fn.declaration.result.type).index}($output);
    }`).join("\n")}
}
}
`;

const zendCalls = model => model.surface.functions.map((fn, index) => {
	const result = model.surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
	const args = fn.declaration.parameters.map(site => model.surface.copy(site.type));
	return `typedef struct {
  lb_scope scope;
  ${args.map((type, i) => `${type.ctype} input${i};`).join("\n  ")}
  ${unit ? "" : `${result.ctype} output;`}
  ${model.surface.prefix}_error error;
  int status;
} lb_context${index};
static void lb_cleanup${index}(lb_context${index} *ctx) {
  ${result.aggregate ? `${result.name}_clear(&ctx->output);` : "/* No copied output owner. */"}
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute${index}(lb_context${index} *ctx, zval *args, zval *out) {
  (void)args;
${args.map((type, i) => `  if (!lb_to${type.index}(&args[${i}], &ctx->input${i}, &ctx->scope)) return;`).join("\n")}
  ctx->status = ${fn.name}(${args.map((type, i) => `${type.aggregate ? "&" : ""}ctx->input${i}`).concat(unit ? [] : ["&ctx->output"]).concat("&ctx->error").join(", ")});
  if (ctx->status) return;
  ${unit ? "ZVAL_NULL(out);" : `(void)lb_from${result.index}(&ctx->output, out, &ctx->scope);`}
}
ZEND_BEGIN_ARG_INFO_EX(lb_args${index}, 0, 0, ${args.length})
${args.map((_, i) => `  ZEND_ARG_INFO(0, arg${i})`).join("\n")}
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call${index}) {
  if (ZEND_NUM_ARGS() != ${args.length}) { zend_argument_count_error("Expected exactly ${args.length} arguments"); RETURN_THROWS(); }
  zval args[${Math.max(1, args.length)}];
  ${args.length ? `if (zend_get_parameters_array_ex(${args.length}, args) != SUCCESS) RETURN_THROWS();` : ""}
  if (sizeof(lb_context${index}) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context${index} *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute${index}(ctx, args, return_value); }
  zend_catch { lb_cleanup${index}(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (length) memcpy(native_message, ctx->error.message, length);
    native_message[length] = 0;
    message = length ? native_message : "Compiled Lean call failed";
  }
  lb_cleanup${index}(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}`;
}).join("\n\n");

/**
 * Generate a Zend source adapter, not an installed release or a compiler receipt.
 *
 * @param ir - Authoritative copied Binding IR.
 * @param options - Explicit PHP integer width; PHP-Wasm uses 32.
 * @param options.integerBits - Signed PHP integer width, either 32 or 64.
 */
export const generateCopiedPhpZendAdapter = (ir, { integerBits = 32 } = {}) => {
	const model = compileCopiedPhpModel(ir, { integerBits, lists: true, variants: true }), identity = hashBindingIr(ir);
	const stem = `lb_${model.surface.prefix}_${identity.slice(0, 16)}`;
	const transport = `${model.namespace}\\Internal\\Zend${identity.slice(0, 16)}`;
	const c = generateCBindingPackage(ir);
	const files = { "src/Api.php": copiedPhpPublicSource(model)
		, "src/Internal/Native.php": nativePhp(model, transport, integerBits === 32 ? `php8.4-${stem}.so` : null)
		, [model.surface.paths.publicHeader]: c[model.surface.paths.publicHeader]
		, [`extension/${stem}.c`]: `#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "${model.surface.prefix}.h"

_Static_assert(sizeof(zend_long) * CHAR_BIT == ${integerBits}, "PHP integer width differs from the generated adapter");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif
${copiedZendSupport}
${copiedZendConversions(model)}
${model.surface.callbacks.size ? zendCallableOwners(model) + zendCallableTrampolines(model) + zendCallableCalls(model) : zendCalls(model)}

${model.surface.callbacks.size ? `static PHP_MINIT_FUNCTION(lb_callables) {
  lb_owned_type = zend_register_list_destructors_ex(lb_owned_destroy, NULL, "Lean closure", module_number);
  return SUCCESS;
}` : ""}

static const zend_function_entry lb_functions[] = {
${model.surface.functions.map((_, index) => `  ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, call${index}, zif_lb_call${index}, lb_args${model.surface.callbacks.size ? "_call" : ""}${index})`).join("\n")}
${[...model.surface.callbacks.values()].map(value => `  ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, invoke${value.index}, zif_lb_invoke${value.index}, lb_args_invoke${value.index})
  ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, close${value.index}, zif_lb_close${value.index}, lb_close_args${value.index})`).join("\n")}
  PHP_FE_END
};
zend_module_entry ${stem}_module_entry = {
  STANDARD_MODULE_HEADER, "${stem}", lb_functions,
  ${model.surface.callbacks.size ? "PHP_MINIT(lb_callables)" : "NULL"}, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${stem})
` };
	files["copied-zend-manifest.json"] = canonicalJson({ schemaVersion: 1, kind: "lean-bridge-copied-zend-source", component: ir.component.id, bindingIrSha256: identity, integerBits, extension: stem, transport, namespace: model.namespace, ...(model.surface.aliases.length ? { aliases: phpCopiedAliases(model) } : {}), exports: model.surface.functions.map((fn, index) => ({ declaration: fn.declaration.id, function: `${model.namespace}\\${fn.field}`, transport: `${transport}\\call${index}`, cSymbol: fn.name })), files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, { sha256: sha256(source), bytes: Buffer.byteLength(source) }])) });
	return Object.freeze(files);
};
