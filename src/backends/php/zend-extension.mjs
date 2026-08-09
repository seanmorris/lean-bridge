import { createHash } from "node:crypto";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { generateCBindingPackage } from "../c/generate.mjs";
import { compilePhpProjection } from "./projection.mjs";

export class PhpZendGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpZendGenerationError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpZendGenerationError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");
const snake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();
const upper = value => snake(value).toUpperCase();
const packageName = ir => ir.component.id.slice(0, ir.component.id.lastIndexOf("@"));
const packageStem = ir => snake(packageName(ir).split("/").at(-1));

const exactAlphaShape = (ir, projection) => {
  const types = Object.fromEntries(ir.types.map(type => [type.kind, type]));
  const operationIds = projection.operations.map(operation => operation.id);
  const expected = [
    "lean:Alpha.box",
    "lean:Alpha.Box.read",
    "bridge:Alpha.Box.identity",
    "lean:Alpha.roundTrip",
    "lean:Alpha.withCallback",
    "lean:Alpha.makeAdder",
  ];
  const payload = ir.types.find(type => type.kind === "record");
  const resource = ir.types.find(type => type.kind === "resource");
  const callback = ir.types.find(type => type.kind === "callback");
  const payloadFields = payload?.fields.map(field => `${field.name}:${field.type.kind === "primitive" ? field.type.name : field.type.constructor}`).join(",");
  if (
    ir.types.filter(type => type.kind === "record").length !== 1 ||
    ir.types.filter(type => type.kind === "resource").length !== 1 ||
    ir.types.filter(type => type.kind === "callback").length !== 1 ||
    payloadFields !== "enabled:bool,count:uint32,label:string,bytes:bytes,values:array" ||
    resource.resource.disposal !== "required" ||
    callback.callable.resultMode !== "value" ||
    JSON.stringify(operationIds) !== JSON.stringify(expected)
  ) {
    fail("unsupported-zend-shape", "the Zend POC requires the reviewed Alpha value, resource, and callback fixture", {
      types,
      operationIds,
      payloadFields,
    });
  }
  return { payload, resource, callback };
};

const configM4 = stem => `PHP_ARG_ENABLE([${stem.replaceAll("_", "-")}], [whether to enable the Lean ${stem} extension],
  [AS_HELP_STRING([--enable-${stem.replaceAll("_", "-")}], [Enable the generated Lean ${stem} extension])], [no])

if test "$PHP_${upper(stem)}" != "no"; then
  PHP_NEW_EXTENSION([${stem}], [${stem}_zend.c src/${stem}.c], [$ext_shared])
fi
`;

const extensionHeader = (stem, hash) => `#ifndef PHP_${upper(stem)}_H
#define PHP_${upper(stem)}_H

#include "php.h"

#define PHP_${upper(stem)}_VERSION "0.0.0-poc"
#define PHP_${upper(stem)}_BINDING_IR_SHA256 "${hash}"

extern zend_module_entry ${stem}_module_entry;
#define phpext_${stem}_ptr &${stem}_module_entry

#endif
`;

const zendSource = (ir, projection, shape) => {
  const stem = packageStem(ir);
  const macro = upper(stem);
  const namespace = projection.package.namespace;
  const resource = shape.resource.name;
  const callback = shape.callback.name;
  const payload = shape.payload.name;
  const transportMethods = Object.fromEntries(projection.operations.map(operation => [operation.id, operation.transportMethod]));
  const closeResource = projection.lifecycle.find(operation => operation.kind === "resource-close").transportMethod;
  const callCallback = projection.lifecycle.find(operation => operation.kind === "callable-call").transportMethod;
  const closeCallback = projection.lifecycle.find(operation => operation.kind === "callable-close").transportMethod;
  return `#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include "php.h"
#include "Zend/zend_exceptions.h"
#include "Zend/zend_interfaces.h"
#include "ext/spl/spl_exceptions.h"
#include "ext/standard/info.h"
#include "php_${stem}.h"
#include "${stem}.h"
#include "${stem}_runtime.h"
#include "lean_bridge_native_runtime.h"

#include <inttypes.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>

#ifdef ZTS
#error "The generated native Lean transport POC requires non-thread-safe PHP"
#endif

extern const ${stem}_runtime_v1 *${stem}_native_runtime_v1(void);
extern void ${stem}_native_runtime_detach(void);

static zend_class_entry *identity_ce;
static zend_class_entry *transport_error_ce;
static zend_class_entry *transport_ce;
static zend_class_entry *native_transport_ce;
static zend_object_handlers identity_handlers;

typedef enum lean_php_identity_kind {
    LEAN_PHP_IDENTITY_NONE = 0,
    LEAN_PHP_IDENTITY_RESOURCE = 1,
    LEAN_PHP_IDENTITY_CALLBACK = 2
} lean_php_identity_kind;

typedef struct lean_php_identity {
    lean_php_identity_kind kind;
    union {
        ${stem}_${snake(resource)} *resource;
        ${stem}_owned_${snake(callback)} *callback;
        void *pointer;
    } value;
    uint64_t opaque_id;
    bool closed;
    zend_object std;
} lean_php_identity;

static inline lean_php_identity *identity_from_object(zend_object *object)
{
    return (lean_php_identity *)((char *)object - XtOffsetOf(lean_php_identity, std));
}

static const char *identity_kind_name(lean_php_identity_kind kind)
{
    if (kind == LEAN_PHP_IDENTITY_RESOURCE) return "${namespace}\\${resource}";
    if (kind == LEAN_PHP_IDENTITY_CALLBACK) return "${namespace}\\${callback}";
    return "closed";
}

static void identity_release(lean_php_identity *identity)
{
    if (identity->closed) return;
    identity->closed = true;
    int release = lean_bridge_native_identity_release(
        identity->opaque_id,
        identity_kind_name(identity->kind),
        identity->value.pointer
    );
    if (release == 1) {
        if (identity->kind == LEAN_PHP_IDENTITY_RESOURCE) {
            ${stem}_${snake(resource)}_dispose(&identity->value.resource);
        } else if (identity->kind == LEAN_PHP_IDENTITY_CALLBACK) {
            ${stem}_owned_${snake(callback)}_dispose(&identity->value.callback);
        }
    }
    identity->value.pointer = NULL;
}

static zend_object *identity_create(zend_class_entry *ce)
{
    lean_php_identity *identity = zend_object_alloc(sizeof(*identity), ce);
    zend_object_std_init(&identity->std, ce);
    object_properties_init(&identity->std, ce);
    identity->kind = LEAN_PHP_IDENTITY_NONE;
    identity->value.pointer = NULL;
    identity->opaque_id = 0;
    identity->closed = true;
    identity->std.handlers = &identity_handlers;
    return &identity->std;
}

static void identity_free(zend_object *object)
{
    lean_php_identity *identity = identity_from_object(object);
    identity_release(identity);
    zend_object_std_dtor(&identity->std);
}

static zend_result identity_result(zval *return_value, lean_php_identity_kind kind, void *pointer)
{
    uint64_t token = lean_bridge_native_identity_acquire(identity_kind_name(kind), pointer);
    if (token == 0) {
        if (kind == LEAN_PHP_IDENTITY_RESOURCE) {
            ${stem}_${snake(resource)} *resource = pointer;
            ${stem}_${snake(resource)}_dispose(&resource);
        } else if (kind == LEAN_PHP_IDENTITY_CALLBACK) {
            ${stem}_owned_${snake(callback)} *callback = pointer;
            ${stem}_owned_${snake(callback)}_dispose(&callback);
        }
        zend_throw_exception(zend_ce_error, "the shared Lean identity domain is full", 0);
        return FAILURE;
    }
    object_init_ex(return_value, identity_ce);
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(return_value));
    identity->kind = kind;
    identity->value.pointer = pointer;
    identity->opaque_id = token;
    identity->closed = false;
    return SUCCESS;
}

static lean_php_identity *identity_argument(zval *value, lean_php_identity_kind expected)
{
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(value));
    if (identity->closed || identity->kind != expected || identity->value.pointer == NULL) {
        zend_throw_exception(transport_error_ce, "Lean identity is closed or has the wrong generated class", 0);
        zend_update_property_string(transport_error_ce, EG(exception), "errorId", sizeof("errorId") - 1, "error:disposed-resource");
        return NULL;
    }
    return identity;
}

static void throw_transport(const ${stem}_error *error)
{
    const char *id = "error:unexpected";
    const char *message = "native Lean transport failed";
    size_t length = strlen(message);
    if (error != NULL) {
        if (error->code == ${macro}_ERROR_DISPOSED_RESOURCE) id = "error:disposed-resource";
        if (error->code == ${macro}_ERROR_CALLBACK_THREW) id = "error:callback-threw";
        if (error->message != NULL) {
            message = error->message;
            length = error->message_length;
        }
    }
    if (length > INT_MAX) length = INT_MAX;
    zend_throw_exception_ex(transport_error_ce, 0, "%.*s", (int)length, message);
    zend_update_property_string(transport_error_ce, EG(exception), "errorId", sizeof("errorId") - 1, id);
}

static zend_class_entry *lookup_class(const char *name)
{
    zend_string *class_name = zend_string_init(name, strlen(name), 0);
    zend_class_entry *ce = zend_lookup_class(class_name);
    zend_string_release(class_name);
    if (ce == NULL && !EG(exception)) zend_throw_error(NULL, "Generated PHP class %s is unavailable", name);
    return ce;
}

static zend_result bytes_to_string(zval *bytes, zval *result)
{
    zend_function *method = zend_hash_str_find_ptr(&Z_OBJCE_P(bytes)->function_table, "tostring", sizeof("tostring") - 1);
    if (method == NULL) {
        zend_throw_error(NULL, "Generated Bytes::toString method is unavailable");
        return FAILURE;
    }
    zend_call_known_instance_method(method, Z_OBJ_P(bytes), result, 0, NULL);
    if (EG(exception) || Z_TYPE_P(result) != IS_STRING) return FAILURE;
    return SUCCESS;
}

static zend_result make_bytes(const uint8_t *data, size_t length, zval *result)
{
    zend_class_entry *ce = lookup_class("${namespace}\\\\Bytes");
    if (ce == NULL) return FAILURE;
    zend_function *method = zend_hash_str_find_ptr(&ce->function_table, "fromstring", sizeof("fromstring") - 1);
    if (method == NULL) {
        zend_throw_error(NULL, "Generated Bytes::fromString method is unavailable");
        return FAILURE;
    }
    zval argument;
    ZVAL_STRINGL(&argument, length == 0 ? "" : (const char *)data, length);
    zend_call_known_function(method, NULL, ce, result, 1, &argument, NULL);
    zval_ptr_dtor(&argument);
    return EG(exception) ? FAILURE : SUCCESS;
}

static zend_result payload_input(zval *value, ${stem}_${snake(payload)} *out, zval *bytes_string, uint32_t **values)
{
    zend_class_entry *ce = Z_OBJCE_P(value);
    zval rv_enabled, rv_count, rv_label, rv_bytes, rv_values;
    zval *enabled = zend_read_property(ce, Z_OBJ_P(value), "enabled", sizeof("enabled") - 1, 0, &rv_enabled);
    zval *count = zend_read_property(ce, Z_OBJ_P(value), "count", sizeof("count") - 1, 0, &rv_count);
    zval *label = zend_read_property(ce, Z_OBJ_P(value), "label", sizeof("label") - 1, 0, &rv_label);
    zval *bytes = zend_read_property(ce, Z_OBJ_P(value), "bytes", sizeof("bytes") - 1, 0, &rv_bytes);
    zval *items = zend_read_property(ce, Z_OBJ_P(value), "values", sizeof("values") - 1, 0, &rv_values);
    if (Z_TYPE_P(enabled) != IS_TRUE && Z_TYPE_P(enabled) != IS_FALSE) goto invalid;
    if (Z_TYPE_P(count) != IS_LONG || Z_LVAL_P(count) < 0 || (zend_ulong)Z_LVAL_P(count) > UINT32_MAX) goto invalid;
    if (Z_TYPE_P(label) != IS_STRING || Z_TYPE_P(bytes) != IS_OBJECT || Z_TYPE_P(items) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(items))) goto invalid;
    ZVAL_UNDEF(bytes_string);
    if (bytes_to_string(bytes, bytes_string) != SUCCESS) return FAILURE;
    size_t item_count = zend_hash_num_elements(Z_ARRVAL_P(items));
    if (item_count > SIZE_MAX / sizeof(uint32_t)) goto invalid_bytes;
    *values = item_count == 0 ? NULL : safe_emalloc(item_count, sizeof(uint32_t), 0);
    size_t index = 0;
    zval *item;
    ZEND_HASH_FOREACH_VAL(Z_ARRVAL_P(items), item) {
        if (Z_TYPE_P(item) != IS_LONG || Z_LVAL_P(item) < 0 || (zend_ulong)Z_LVAL_P(item) > UINT32_MAX) goto invalid_values;
        (*values)[index++] = (uint32_t)Z_LVAL_P(item);
    } ZEND_HASH_FOREACH_END();
    *out = (${stem}_${snake(payload)}){
        .enabled = Z_TYPE_P(enabled) == IS_TRUE,
        .count = (uint32_t)Z_LVAL_P(count),
        .label = {Z_STRVAL_P(label), Z_STRLEN_P(label), NULL, NULL},
        .bytes = {(const uint8_t *)Z_STRVAL_P(bytes_string), Z_STRLEN_P(bytes_string), NULL, NULL},
        .values = {*values, item_count, NULL, NULL},
    };
    return SUCCESS;
invalid_values:
    if (*values != NULL) efree(*values);
    *values = NULL;
invalid_bytes:
    zval_ptr_dtor(bytes_string);
invalid:
    zend_throw_exception(zend_ce_type_error, "Generated ${payload} fields do not match Binding IR", 0);
    return FAILURE;
}

static zend_result payload_result(const ${stem}_${snake(payload)} *value, zval *return_value)
{
    zend_class_entry *ce = lookup_class("${namespace}\\\\${payload}");
    if (ce == NULL || ce->constructor == NULL) return FAILURE;
    zval arguments[5], constructor_result;
    ZVAL_BOOL(&arguments[0], value->enabled);
    ZVAL_LONG(&arguments[1], value->count);
    ZVAL_STRINGL(&arguments[2], value->label.length == 0 ? "" : value->label.data, value->label.length);
    if (make_bytes(value->bytes.data, value->bytes.length, &arguments[3]) != SUCCESS) {
        zval_ptr_dtor(&arguments[2]);
        return FAILURE;
    }
    array_init_size(&arguments[4], value->values.length);
    for (size_t index = 0; index < value->values.length; index++) add_next_index_long(&arguments[4], value->values.data[index]);
    object_init_ex(return_value, ce);
    ZVAL_UNDEF(&constructor_result);
    zend_call_known_instance_method(ce->constructor, Z_OBJ_P(return_value), &constructor_result, 5, arguments);
    if (!Z_ISUNDEF(constructor_result)) zval_ptr_dtor(&constructor_result);
    for (size_t index = 2; index < 5; index++) zval_ptr_dtor(&arguments[index]);
    return EG(exception) ? FAILURE : SUCCESS;
}

typedef struct php_callback_context {
    zend_fcall_info fci;
    zend_fcall_info_cache fcc;
    zend_object *exception;
} php_callback_context;

static ${stem}_status php_callback_call(void *context, uint32_t value, uint32_t *out, ${stem}_error *error)
{
    php_callback_context *callback = context;
    zval argument, result;
    ZVAL_LONG(&argument, value);
    ZVAL_UNDEF(&result);
    callback->fci.retval = &result;
    callback->fci.params = &argument;
    callback->fci.param_count = 1;
    if (zend_call_function(&callback->fci, &callback->fcc) != SUCCESS || EG(exception)) {
        if (EG(exception)) {
            callback->exception = EG(exception);
            GC_ADDREF(callback->exception);
            zend_clear_exception();
        }
        error->code = ${macro}_ERROR_CALLBACK_THREW;
        error->message = "PHP callback threw";
        error->message_length = sizeof("PHP callback threw") - 1;
        if (!Z_ISUNDEF(result)) zval_ptr_dtor(&result);
        return ${macro}_STATUS_DECLARED_ERROR;
    }
    if (Z_TYPE(result) != IS_LONG || Z_LVAL(result) < 0 || (zend_ulong)Z_LVAL(result) > UINT32_MAX) {
        zval_ptr_dtor(&result);
        zend_throw_exception(zend_ce_type_error, "Generated callback must return UInt32", 0);
        error->code = ${macro}_ERROR_CALLBACK_THREW;
        error->message = "PHP callback returned an invalid value";
        error->message_length = sizeof("PHP callback returned an invalid value") - 1;
        return ${macro}_STATUS_DECLARED_ERROR;
    }
    *out = (uint32_t)Z_LVAL(result);
    zval_ptr_dtor(&result);
    return ${macro}_STATUS_OK;
}

ZEND_BEGIN_ARG_INFO_EX(arginfo_identity_construct, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_identity_kind, 0, 0, IS_STRING, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_identity_value, 0, 0, IS_MIXED, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(arginfo_transport_error_construct, 0, 0, 1)
    ZEND_ARG_TYPE_INFO(0, errorId, IS_STRING, 0)
    ZEND_ARG_TYPE_INFO_WITH_DEFAULT_VALUE(0, message, IS_STRING, 0, "'Lean transport reported a declared error'")
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_void, 0, 0, IS_VOID, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_runtime_snapshot, 0, 0, IS_ARRAY, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_box, 0, 1, ${namespace}\\Internal\\Identity, 0)
    ZEND_ARG_TYPE_INFO(0, value, IS_LONG, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_box_read, 0, 1, IS_LONG, 0)
    ZEND_ARG_OBJ_INFO(0, self, ${namespace}\\Internal\\Identity, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_box_identity, 0, 1, ${namespace}\\Internal\\Identity, 0)
    ZEND_ARG_OBJ_INFO(0, self, ${namespace}\\Internal\\Identity, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_round_trip, 0, 1, ${namespace}\\${payload}, 0)
    ZEND_ARG_OBJ_INFO(0, payload, ${namespace}\\${payload}, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_with_callback, 0, 2, IS_LONG, 0)
    ZEND_ARG_TYPE_INFO(0, value, IS_LONG, 0)
    ZEND_ARG_CALLABLE_INFO(0, transform, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_OBJ_INFO_EX(arginfo_make_adder, 0, 1, ${namespace}\\Internal\\Identity, 0)
    ZEND_ARG_TYPE_INFO(0, base, IS_LONG, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_identity_close, 0, 1, IS_VOID, 0)
    ZEND_ARG_OBJ_INFO(0, self, ${namespace}\\Internal\\Identity, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_WITH_RETURN_TYPE_INFO_EX(arginfo_transform_call, 0, 2, IS_LONG, 0)
    ZEND_ARG_OBJ_INFO(0, self, ${namespace}\\Internal\\Identity, 0)
    ZEND_ARG_TYPE_INFO(0, value, IS_LONG, 0)
ZEND_END_ARG_INFO()

PHP_METHOD(LeanAlpha_Identity, __construct)
{
    zend_throw_error(NULL, "Runtime identities are created by the generated native transport");
}

PHP_METHOD(LeanAlpha_Identity, kind)
{
    ZEND_PARSE_PARAMETERS_NONE();
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(ZEND_THIS));
    if (identity->kind == LEAN_PHP_IDENTITY_RESOURCE) RETURN_STRING("${resource}");
    if (identity->kind == LEAN_PHP_IDENTITY_CALLBACK) RETURN_STRING("${callback}");
    RETURN_STRING("closed");
}

PHP_METHOD(LeanAlpha_Identity, cacheKey)
{
    ZEND_PARSE_PARAMETERS_NONE();
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(ZEND_THIS));
    const char *kind = identity_kind_name(identity->kind);
    char number[32];
    int number_length = snprintf(number, sizeof(number), "%" PRIu64, identity->opaque_id);
    size_t kind_length = strlen(kind);
    zend_string *key = zend_string_alloc(kind_length + 1 + number_length, 0);
    memcpy(ZSTR_VAL(key), kind, kind_length);
    ZSTR_VAL(key)[kind_length] = '\\0';
    memcpy(ZSTR_VAL(key) + kind_length + 1, number, number_length);
    ZSTR_VAL(key)[kind_length + 1 + number_length] = '\\0';
    RETURN_NEW_STR(key);
}

PHP_METHOD(LeanAlpha_Identity, value)
{
    ZEND_PARSE_PARAMETERS_NONE();
    RETURN_NULL();
}

PHP_METHOD(LeanAlpha_TransportError, __construct)
{
    zend_string *id;
    zend_string *message = NULL;
    ZEND_PARSE_PARAMETERS_START(1, 2)
        Z_PARAM_STR(id)
        Z_PARAM_OPTIONAL
        Z_PARAM_STR(message)
    ZEND_PARSE_PARAMETERS_END();
    zend_update_property_str(transport_error_ce, Z_OBJ_P(ZEND_THIS), "errorId", sizeof("errorId") - 1, id);
    if (message != NULL) zend_update_property_str(zend_ce_exception, Z_OBJ_P(ZEND_THIS), "message", sizeof("message") - 1, message);
}

PHP_METHOD(LeanAlpha_TransportError, errorId)
{
    ZEND_PARSE_PARAMETERS_NONE();
    zval rv;
    zval *id = zend_read_property(transport_error_ce, Z_OBJ_P(ZEND_THIS), "errorId", sizeof("errorId") - 1, 0, &rv);
    RETURN_ZVAL(id, 1, 0);
}

PHP_METHOD(LeanAlpha_NativeTransport, initialize)
{
    ZEND_PARSE_PARAMETERS_NONE();
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_runtime_install_v1(${stem}_native_runtime_v1(), &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        RETURN_THROWS();
    }
}

PHP_METHOD(LeanAlpha_NativeTransport, runtimeSnapshot)
{
    ZEND_PARSE_PARAMETERS_NONE();
    lean_bridge_native_snapshot snapshot = {0};
    lean_bridge_native_snapshot_read(&snapshot);
    char runtime_id[32], identity_id[32];
    snprintf(runtime_id, sizeof(runtime_id), "%" PRIu64, snapshot.runtime_instance_id);
    snprintf(identity_id, sizeof(identity_id), "%" PRIu64, snapshot.identity_domain_id);
    array_init(return_value);
    add_assoc_long(return_value, "abiVersion", snapshot.abi_version);
    add_assoc_long(return_value, "runtimeState", snapshot.runtime_state);
    add_assoc_long(return_value, "runtimeInitRuns", snapshot.runtime_init_runs);
    add_assoc_long(return_value, "componentInitRuns", snapshot.component_init_runs);
    add_assoc_long(return_value, "attachedComponents", snapshot.attached_components);
    add_assoc_long(return_value, "liveIdentities", snapshot.live_identities);
    add_assoc_string(return_value, "runtimeInstanceId", runtime_id);
    add_assoc_string(return_value, "identityDomainId", identity_id);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.box"]})
{
    zend_long value;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(value) ZEND_PARSE_PARAMETERS_END();
    if (value < 0 || (zend_ulong)value > UINT32_MAX) {
        zend_throw_exception(zend_ce_value_error, "value must fit UInt32", 0);
        RETURN_THROWS();
    }
    ${stem}_${snake(resource)} *result = NULL;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_${snake(resource)}_create((uint32_t)value, &result, &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        RETURN_THROWS();
    }
    if (identity_result(return_value, LEAN_PHP_IDENTITY_RESOURCE, result) != SUCCESS) RETURN_THROWS();
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.Box.read"]})
{
    zval *self;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();
    lean_php_identity *identity = identity_argument(self, LEAN_PHP_IDENTITY_RESOURCE);
    if (identity == NULL) RETURN_THROWS();
    uint32_t result = 0;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_${snake(resource)}_read(identity->value.resource, &result, &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        RETURN_THROWS();
    }
    RETURN_LONG(result);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["bridge:Alpha.Box.identity"]})
{
    zval *self;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();
    lean_php_identity *identity = identity_argument(self, LEAN_PHP_IDENTITY_RESOURCE);
    if (identity == NULL) RETURN_THROWS();
    const ${stem}_${snake(resource)} *result = NULL;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_${snake(resource)}_identity(identity->value.resource, &result, &error);
    if (status != ${macro}_STATUS_OK || result != identity->value.resource) {
        if (status == ${macro}_STATUS_OK) {
            error.code = ${macro}_ERROR_UNEXPECTED;
            error.message = "native transport broke canonical resource identity";
            error.message_length = sizeof("native transport broke canonical resource identity") - 1;
        }
        throw_transport(&error);
        RETURN_THROWS();
    }
    RETURN_ZVAL(self, 1, 0);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.roundTrip"]})
{
    zval *payload;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT(payload) ZEND_PARSE_PARAMETERS_END();
    ${stem}_${snake(payload)} input = {0}, output = {0};
    zval bytes_string;
    uint32_t *values = NULL;
    if (payload_input(payload, &input, &bytes_string, &values) != SUCCESS) RETURN_THROWS();
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_round_trip(&input, &output, &error);
    zval_ptr_dtor(&bytes_string);
    if (values != NULL) efree(values);
    if (status != ${macro}_STATUS_OK) {
        ${stem}_${snake(payload)}_clear(&output);
        throw_transport(&error);
        RETURN_THROWS();
    }
    zend_result converted = payload_result(&output, return_value);
    ${stem}_${snake(payload)}_clear(&output);
    if (converted != SUCCESS) RETURN_THROWS();
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.withCallback"]})
{
    zend_long value;
    php_callback_context context = {0};
    ZEND_PARSE_PARAMETERS_START(2, 2)
        Z_PARAM_LONG(value)
        Z_PARAM_FUNC(context.fci, context.fcc)
    ZEND_PARSE_PARAMETERS_END();
    if (value < 0 || (zend_ulong)value > UINT32_MAX) {
        zend_throw_exception(zend_ce_value_error, "value must fit UInt32", 0);
        RETURN_THROWS();
    }
    ${stem}_${snake(callback)} transform = {php_callback_call, &context};
    uint32_t result = 0;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_with_callback((uint32_t)value, &transform, &result, &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        if (context.exception != NULL && EG(exception)) {
            zend_exception_set_previous(EG(exception), context.exception);
            context.exception = NULL;
        }
        RETURN_THROWS();
    }
    if (context.exception != NULL) {
        OBJ_RELEASE(context.exception);
        zend_throw_exception(zend_ce_error, "native callback transport ignored a PHP exception", 0);
        RETURN_THROWS();
    }
    RETURN_LONG(result);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.makeAdder"]})
{
    zend_long base;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(base) ZEND_PARSE_PARAMETERS_END();
    if (base < 0 || (zend_ulong)base > UINT32_MAX) {
        zend_throw_exception(zend_ce_value_error, "base must fit UInt32", 0);
        RETURN_THROWS();
    }
    ${stem}_owned_${snake(callback)} *result = NULL;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_make_adder((uint32_t)base, &result, &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        RETURN_THROWS();
    }
    if (identity_result(return_value, LEAN_PHP_IDENTITY_CALLBACK, result) != SUCCESS) RETURN_THROWS();
}

PHP_METHOD(LeanAlpha_NativeTransport, ${closeResource})
{
    zval *self;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(self));
    if (!identity->closed && identity->kind != LEAN_PHP_IDENTITY_RESOURCE) {
        identity_argument(self, LEAN_PHP_IDENTITY_RESOURCE);
        RETURN_THROWS();
    }
    identity_release(identity);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${callCallback})
{
    zval *self;
    zend_long value;
    ZEND_PARSE_PARAMETERS_START(2, 2)
        Z_PARAM_OBJECT_OF_CLASS(self, identity_ce)
        Z_PARAM_LONG(value)
    ZEND_PARSE_PARAMETERS_END();
    if (value < 0 || (zend_ulong)value > UINT32_MAX) {
        zend_throw_exception(zend_ce_value_error, "value must fit UInt32", 0);
        RETURN_THROWS();
    }
    lean_php_identity *identity = identity_argument(self, LEAN_PHP_IDENTITY_CALLBACK);
    if (identity == NULL) RETURN_THROWS();
    uint32_t result = 0;
    ${stem}_error error = {0};
    ${stem}_status status = ${stem}_owned_${snake(callback)}_call(identity->value.callback, (uint32_t)value, &result, &error);
    if (status != ${macro}_STATUS_OK) {
        throw_transport(&error);
        RETURN_THROWS();
    }
    RETURN_LONG(result);
}

PHP_METHOD(LeanAlpha_NativeTransport, ${closeCallback})
{
    zval *self;
    ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_OBJECT_OF_CLASS(self, identity_ce) ZEND_PARSE_PARAMETERS_END();
    lean_php_identity *identity = identity_from_object(Z_OBJ_P(self));
    if (!identity->closed && identity->kind != LEAN_PHP_IDENTITY_CALLBACK) {
        identity_argument(self, LEAN_PHP_IDENTITY_CALLBACK);
        RETURN_THROWS();
    }
    identity_release(identity);
}

static const zend_function_entry identity_methods[] = {
    PHP_ME(LeanAlpha_Identity, __construct, arginfo_identity_construct, ZEND_ACC_PRIVATE)
    PHP_ME(LeanAlpha_Identity, kind, arginfo_identity_kind, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_Identity, cacheKey, arginfo_identity_kind, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_Identity, value, arginfo_identity_value, ZEND_ACC_PUBLIC)
    PHP_FE_END
};

static const zend_function_entry transport_error_methods[] = {
    PHP_ME(LeanAlpha_TransportError, __construct, arginfo_transport_error_construct, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_TransportError, errorId, arginfo_identity_kind, ZEND_ACC_PUBLIC)
    PHP_FE_END
};

static const zend_function_entry transport_methods[] = {
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, initialize, arginfo_void)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["lean:Alpha.box"]}, arginfo_box)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["lean:Alpha.Box.read"]}, arginfo_box_read)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["bridge:Alpha.Box.identity"]}, arginfo_box_identity)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["lean:Alpha.roundTrip"]}, arginfo_round_trip)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["lean:Alpha.withCallback"]}, arginfo_with_callback)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${transportMethods["lean:Alpha.makeAdder"]}, arginfo_make_adder)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${closeResource}, arginfo_identity_close)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${callCallback}, arginfo_transform_call)
    ZEND_ABSTRACT_ME(LeanAlpha_Transport, ${closeCallback}, arginfo_identity_close)
    PHP_FE_END
};

static const zend_function_entry native_transport_methods[] = {
    PHP_ME(LeanAlpha_NativeTransport, initialize, arginfo_void, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, runtimeSnapshot, arginfo_runtime_snapshot, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.box"]}, arginfo_box, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.Box.read"]}, arginfo_box_read, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["bridge:Alpha.Box.identity"]}, arginfo_box_identity, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.roundTrip"]}, arginfo_round_trip, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.withCallback"]}, arginfo_with_callback, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${transportMethods["lean:Alpha.makeAdder"]}, arginfo_make_adder, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${closeResource}, arginfo_identity_close, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${callCallback}, arginfo_transform_call, ZEND_ACC_PUBLIC)
    PHP_ME(LeanAlpha_NativeTransport, ${closeCallback}, arginfo_identity_close, ZEND_ACC_PUBLIC)
    PHP_FE_END
};

PHP_MINIT_FUNCTION(${stem})
{
    zend_class_entry ce;
    INIT_NS_CLASS_ENTRY(ce, "${namespace}\\\\Internal", "Identity", identity_methods);
    identity_ce = zend_register_internal_class(&ce);
    identity_ce->ce_flags |= ZEND_ACC_FINAL;
    identity_ce->create_object = identity_create;
    memcpy(&identity_handlers, zend_get_std_object_handlers(), sizeof(identity_handlers));
    identity_handlers.offset = XtOffsetOf(lean_php_identity, std);
    identity_handlers.free_obj = identity_free;
    identity_handlers.clone_obj = NULL;

    INIT_NS_CLASS_ENTRY(ce, "${namespace}\\\\Internal", "TransportError", transport_error_methods);
    transport_error_ce = zend_register_internal_class_ex(&ce, spl_ce_RuntimeException);
    transport_error_ce->ce_flags |= ZEND_ACC_FINAL;
    zend_declare_property_null(transport_error_ce, "errorId", sizeof("errorId") - 1, ZEND_ACC_PRIVATE);

    INIT_NS_CLASS_ENTRY(ce, "${namespace}\\\\Internal", "Transport", transport_methods);
    transport_ce = zend_register_internal_interface(&ce);

    INIT_NS_CLASS_ENTRY(ce, "${namespace}\\\\Internal", "NativeTransport", native_transport_methods);
    native_transport_ce = zend_register_internal_class(&ce);
    native_transport_ce->ce_flags |= ZEND_ACC_FINAL;
    zend_class_implements(native_transport_ce, 1, transport_ce);
    zend_declare_class_constant_string(native_transport_ce, "BINDING_IR_SHA256", sizeof("BINDING_IR_SHA256") - 1, PHP_${macro}_BINDING_IR_SHA256);
    return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(${stem})
{
    ${stem}_native_runtime_detach();
    return SUCCESS;
}

PHP_MINFO_FUNCTION(${stem})
{
    php_info_print_table_start();
    php_info_print_table_header(2, "Lean ${stem} native transport", "enabled");
    php_info_print_table_row(2, "Binding IR SHA-256", PHP_${macro}_BINDING_IR_SHA256);
    php_info_print_table_end();
}

zend_module_entry ${stem}_module_entry = {
    STANDARD_MODULE_HEADER,
    "${stem}",
    NULL,
    PHP_MINIT(${stem}),
    PHP_MSHUTDOWN(${stem}),
    NULL,
    NULL,
    PHP_MINFO(${stem}),
    PHP_${macro}_VERSION,
    STANDARD_MODULE_PROPERTIES
};

#ifdef COMPILE_DL_${macro}
#ifdef ZTS
ZEND_TSRMLS_CACHE_DEFINE()
#endif
ZEND_GET_MODULE(${stem})
#endif
`;
};

export const generatePhpZendExtensionPackage = ir => {
  validateBindingIr(ir);
  const projection = compilePhpProjection(ir);
  const shape = exactAlphaShape(ir, projection);
  const cFiles = generateCBindingPackage(ir);
  const stem = packageStem(ir);
  const files = {
    "config.m4": configM4(stem),
    [`php_${stem}.h`]: extensionHeader(stem, hashBindingIr(ir)),
    [`${stem}_zend.c`]: zendSource(ir, projection, shape),
  };
  for (const [path, source] of Object.entries(cFiles)) {
    if (new Set(["README.md", "binding-manifest.json"]).has(path)) continue;
    files[path] = source;
  }
  files[`${stem}.h`] = cFiles[`include/${stem}.h`];
  files[`${stem}_runtime.h`] = cFiles[`internal/${stem}_runtime.h`];
  const sourceFiles = Object.keys(files).sort();
  const filesSha256 = Object.fromEntries(sourceFiles.map(path => [path, sha256(files[path])]));
  files["zend-manifest.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    generator: { id: "lean-wasm/php-zend", version: 1 },
    extension: stem,
    transportClass: `${projection.package.namespace}\\Internal\\NativeTransport`,
    transportInterface: projection.transport.interface,
    nativeRuntimeFactory: `${stem}_native_runtime_v1`,
    operations: [
      "initialize",
      ...projection.operations.map(operation => operation.transportMethod),
      ...projection.lifecycle.map(operation => operation.transportMethod),
    ],
    sourceFiles,
    filesSha256,
  }, null, 2)}\n`;
  return Object.freeze(files);
};
