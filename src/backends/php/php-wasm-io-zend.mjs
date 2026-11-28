/**
 * Fixed Zend entry points for synchronous Lean IO on PHP-Wasm. No FFI, raw
 * pointers, resource handles or runtime symbol dispatch cross into user PHP.
 *
 * @file
 */
import { generatePhpIOPort } from "./io-port.mjs";

// Each declaration registers a distinct Zend resource type. PHP owns the
// reference, not the native token; request teardown and early exit use the
// same close operation. A different component or cursor cannot substitute it.
const cursorEntry = (m, i, port, inputs) => {
	const name = port.symbols[i + 1], title = JSON.stringify(m.declaration + " Lean cursor");
	const operand = `zval *value;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_RESOURCE(value) ZEND_PARSE_PARAMETERS_END();
    uint64_t *h = zend_fetch_resource(Z_RES_P(value), ${title}, lb_type${i});
    if (!h) RETURN_THROWS();`;
	return `static int lb_type${i};
static void lb_free${i}(zend_resource *r) {
    uint64_t *h = r->ptr;
    if (h[0] && ${m.names.close}(h) != 0) lean_bridge_native_runtime_retire();
    efree(h);
}
${inputs}
    uint64_t *h = ecalloc(2, sizeof(*h));
    ZVAL_RES(return_value, zend_register_resource(h, lb_type${i}));
    int status = ${name}(in, ${m.args.length}, &out, tags, sizeof(tags), h);
    if (!status && h[0] && h[1] && !out.data && !out.length && lb_zero_tags(tags, sizeof(tags))) return;
    if (!status || h[0] || h[1]) { status = -1; lean_bridge_native_runtime_retire(); }
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    lb_reply(return_value, status, tags, sizeof(tags), &out);
}
static PHP_FUNCTION(lb_next${i}) {
    ${operand}
    uint8_t tags[${m.tagBytes}] = {0}; lbphp_buffer out = {0};
    int status = h[0] ? ${name}_next(h, &out, tags, sizeof(tags)) : 2;
    if ((status == 0 && !h[0]) || ((status == 2 || status == 3 || status == 4) && h[0])) status = -1;
    lb_reply(return_value, status, tags, sizeof(tags), &out);
}
static PHP_FUNCTION(lb_close${i}) {
    ${operand}
    int status = h[0] ? ${m.names.close}(h) : 0;
    if (status) lean_bridge_native_runtime_retire();
    RETURN_LONG(status);
}`;
};

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
		const inputs = `ZEND_BEGIN_ARG_INFO_EX(lb_args${i}, 0, 0, ${args})
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
    uint8_t tags[${m.tagBytes}] = {0};`;
		if(m.delivery === "iterator") return cursorEntry(m, i, port, inputs);
		return `${inputs}
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
	const cursors = model.methods.flatMap((m,i) => m.delivery === "iterator" ? [i] : []);
	const support = cursors.length ? `static int lb_zero_tags(const uint8_t *p, size_t n) {
    for (size_t i = 0; i < n; ++i) if (p[i]) return 0;
    return 1;
}
static void lb_reply(zval *return_value, int status, const uint8_t *tags, size_t n, lbphp_buffer *out) {
    if (status < 0 || status > 12 || out->length > 16777216 || (out->length && !out->data)) {
        ${port.dispose}(out); lean_bridge_native_runtime_retire(); RETURN_EMPTY_STRING();
    }
    zend_try {
        size_t len = 1 + n + (size_t)out->length;
        zend_string *reply = zend_string_alloc(len, 0);
        ZSTR_VAL(reply)[0] = (char)status; memcpy(ZSTR_VAL(reply) + 1, tags, n);
        if (out->length) memcpy(ZSTR_VAL(reply) + 1 + n, out->data, (size_t)out->length);
        ZSTR_VAL(reply)[len] = 0; RETVAL_STR(reply);
    } zend_catch {
        ${port.dispose}(out); lean_bridge_native_runtime_retire(); zend_bailout();
    } zend_end_try();
    ${port.dispose}(out);
}
ZEND_BEGIN_ARG_INFO_EX(lb_cursor_arg, 0, 0, 1)
    ZEND_ARG_INFO(0, cursor)
ZEND_END_ARG_INFO()
` : "";
	const init = cursors.length ? `static PHP_MINIT_FUNCTION(lb_cursors) {
${cursors.map(i => `    lb_type${i} = zend_register_list_destructors_ex(lb_free${i}, NULL, ${JSON.stringify(model.methods[i].declaration + " Lean cursor")}, module_number);
    if (lb_type${i} < 0) return FAILURE;`).join("\n")}
    return SUCCESS;
}
` : "";
	const source = `#include <php.h>
#include "php-io-port.h"
#include "lean_bridge_native_runtime.h"
#if PHP_VERSION_ID != 80401 || defined(ZTS) || !defined(__wasm32__) || defined(__EMSCRIPTEN_PTHREADS__)
#error Expected the pinned single-threaded PHP-Wasm 8.4.1 host
#endif
_Static_assert(sizeof(zend_long) == 4 && sizeof(void *) == 4, "Expected wasm32 Zend ABI");
${support}${calls.join("\n")}
ZEND_BEGIN_ARG_INFO_EX(lb_no_args, 0, 0, 0)
ZEND_END_ARG_INFO()
static PHP_FUNCTION(lb_retire) {
    ZEND_PARSE_PARAMETERS_NONE();
    lean_bridge_native_runtime_retire(); RETURN_NULL();
}
${init}static const zend_function_entry lb_methods[] = {
    ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, retire, zif_lb_retire, lb_no_args)
${model.methods.flatMap((_, i) => [`    ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, call${i}, zif_lb_call${i}, lb_args${i})`, ...cursors.includes(i) ? ["next","close"].map(k => `    ZEND_NS_NAMED_FE(${JSON.stringify(transport)}, ${k}${i}, zif_lb_${k}${i}, lb_cursor_arg)`) : []]).join("\n")}
    PHP_FE_END
};
zend_module_entry ${stem}_module_entry = {
    STANDARD_MODULE_HEADER, "${stem}", lb_methods, ${cursors.length ? "PHP_MINIT(lb_cursors)" : "NULL"}, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(${stem})
`;
	return { source, port, transport, library: "php8.4-" + stem + ".so" };
};
