/**
 * Fixed Zend entry points for synchronous Lean IO on PHP-Wasm. No FFI, raw
 * pointers, resource handles or runtime symbol dispatch cross into user PHP.
 *
 * @file
 */
import { generatePhpIOPort } from "./io-port.mjs";

/**
 * Compile one private function per reconciled Lean declaration. A Zend reply
 * contains a status byte, the active sum tags and a copy of the payload.
 *
 * @param model - Compiler-reconciled wasm32 IO surface.
 * @param identity - Identity of the compiled component, not the Composer name.
 */
export const generatePhpWasmIOZend = (model, identity) => {
	if(model.phpWasm !== true || !/^[a-f0-9]{64}$/u.test(identity)) throw new TypeError("Expected a compiled PHP-Wasm IO component");
	const port = generatePhpIOPort(model), stem = "lb_wasm_io_" + identity;
	const transport = "LeanBridge\\WasmIO\\C" + identity;
	const calls = model.methods.map((m, i) => {
		const args = m.args.length;
		return `ZEND_BEGIN_ARG_INFO_EX(lb_args${i}, 0, 0, ${args})
${m.parameters.map((_, k) => `    ZEND_ARG_INFO(0, arg${k})`).join("\n")}
ZEND_END_ARG_INFO()
static PHP_FUNCTION(lb_call${i}) {
    if (ZEND_NUM_ARGS() != ${args}) { zend_wrong_parameters_count_error(${args}, ${args}); RETURN_THROWS(); }
    lbphp_buffer in[${Math.max(1,args)}] = {0}, out = {0};
    for (unsigned i = 0; i < ${args}; ++i) {
        zval *v = ZEND_CALL_ARG(execute_data, i + 1); ZVAL_DEREF(v);
        if (Z_TYPE_P(v) != IS_STRING) { zend_argument_type_error(i + 1, "must be encoded bytes"); RETURN_THROWS(); }
        in[i].data = (uint8_t *)Z_STRVAL_P(v); in[i].length = Z_STRLEN_P(v);
    }
    uint8_t tags[${m.tagBytes}] = {0};
    int status = ${port.symbols[i+1]}(in, ${args}, &out, tags, sizeof(tags));
    if (out.length > 16777216 || (out.length && !out.data) || status < 0 || status > 12) {
        ${port.dispose}(&out); lean_bridge_native_runtime_retire();
        /* Invalid envelope: let the public PHP decoder raise its own bridge exception. */
        RETURN_EMPTY_STRING();
    }
    zend_try {
        size_t len = 1 + sizeof(tags) + (size_t)out.length;
        zend_string *reply = zend_string_alloc(len, 0);
        ZSTR_VAL(reply)[0] = (char)status;
        memcpy(ZSTR_VAL(reply) + 1, tags, sizeof(tags));
        if (out.length) memcpy(ZSTR_VAL(reply) + 1 + sizeof(tags), out.data, (size_t)out.length);
        ZSTR_VAL(reply)[len] = 0; RETVAL_STR(reply);
    } zend_catch {
        ${port.dispose}(&out); lean_bridge_native_runtime_retire(); zend_bailout();
    } zend_end_try();
    ${port.dispose}(&out);
}`;
	});
	const source = `#include <php.h>
#include "php-io-port.h"
#include "lean_bridge_native_runtime.h"
#if PHP_VERSION_ID != 80401 || defined(ZTS) || !defined(__wasm32__) || defined(__EMSCRIPTEN_PTHREADS__)
#error Expected the pinned single-threaded PHP-Wasm 8.4.1 host
#endif
_Static_assert(sizeof(zend_long) == 4 && sizeof(void *) == 4, "Expected wasm32 Zend ABI");
${calls.join("\n")}
ZEND_BEGIN_ARG_INFO_EX(lb_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static PHP_FUNCTION(lb_retire) {
    ZEND_PARSE_PARAMETERS_NONE();
    lean_bridge_native_runtime_retire(); RETURN_NULL();
}
static const zend_function_entry lb_methods[] = {
    ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, retire, zif_lb_retire, lb_no_args)
${model.methods.map((_, i) => `    ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, call${i}, zif_lb_call${i}, lb_args${i})`).join("\n")}
    PHP_FE_END
};
zend_module_entry ${stem}_module_entry = {
    STANDARD_MODULE_HEADER, "${stem}", lb_methods, NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${stem})
`;
	return { source, port, transport, library: "php8.4-" + stem + ".so" };
};
