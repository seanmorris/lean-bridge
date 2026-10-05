/**
 * Test-only entries exercise the real generated Zend lease implementation.
 *
 * @file
 */
import { ownedZendOwnershipSource } from "../../src/backends/php/owned-zend-ownership.mjs";

/**
 * Retain and borrow genuine compiled Lean tickets, with counted C allocations.
 * These probe entrypoints are not a public package API.
 *
 * @param model - Matching PHP-Wasm schema.
 * @param generated - Fresh compiler-derived private native adapters.
 */
export const ownedPhpZendOwnershipProbe = (model, generated) => {
	const ticket = model.types.find(node => node.id === "lean:Owned.Ticket");
	const nat = model.types.find(node => node.id === "primitive:nat");
	const string = model.types.find(node => node.id === "primitive:string");
	const fn = name => model.functions.find(fn => fn.name === name).symbol;
	return `#include <php.h>
#include <stdint.h>
#include <stdlib.h>
static size_t probe_live, probe_attempts, probe_fail_at, probe_failures;
static void *probe_allocate(size_t count, size_t width) {
  if (++probe_attempts == probe_fail_at) { ++probe_failures; return NULL; }
  void *value = calloc(count, width); if (value) ++probe_live; return value;
}
static void probe_free(void *value) { if (value) { --probe_live; free(value); } }
#define LB_OWNED_ALLOC(bytes) probe_allocate(1, bytes)
#define LB_OWNED_FREE probe_free
#define LB_ZEND_CALLOC probe_allocate
#define LB_ZEND_FREE probe_free
#include "owned-values-codec.h"
${ownedZendOwnershipSource(model)}
extern lean_object *initialize_${generated.carriers.module}(uint8_t);
static void *probe_initialize(uint8_t builtin) { return initialize_${generated.carriers.module}(builtin); }
static int lgo_initialize(void) {
  return lean_bridge_native_component_initialize(${JSON.stringify(model.layout.model.component.id)}, probe_initialize)
    ? LB_OWNED_OK : LB_OWNED_RUNTIME;
}
static void probe_error(int status) {
  if (status && !EG(exception)) zend_throw_exception(zend_ce_exception, "Owned Zend probe rejected operation", status);
}
static int probe_fetch(zval *value, lgo_handle **handle) {
  return lgo_handle_fetch(value, ${ticket.index}, NULL, handle);
}
ZEND_BEGIN_ARG_INFO_EX(probe_none, 0, 0, 0)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_one, 0, 0, 1)
  ZEND_ARG_INFO(0, value)
ZEND_END_ARG_INFO()
ZEND_BEGIN_ARG_INFO_EX(probe_two, 0, 0, 2)
  ZEND_ARG_INFO(0, value)
  ZEND_ARG_INFO(0, callback)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(owned_probe_new) {
  lgo_state *state = NULL; lgo_lease *lease = NULL;
  int status = lgo_state_current(&state);
  if (!status) status = lgo_lease_new(state, &lease);
  if (status) { probe_error(status); RETURN_THROWS(); }
  uint32_t limb = 42; ${nat.cName} number = { &limb, 1 };
  ${string.cName} label = { "ticket", 6 }; ${ticket.cName} ticket = {0};
  status = ${fn("newTicket")}(&state->native, &number, &label, &ticket, &lease->owner);
  if (!status) {
    zend_try { status = lgo_wrap(${ticket.index}, ticket.token, lease, NULL, return_value); }
    zend_catch { lgo_lease_release(lease); zend_bailout(); } zend_end_try();
  }
  lgo_lease_release(lease); if (status) { probe_error(status); RETURN_THROWS(); }
}
static ZEND_FUNCTION(owned_probe_check) {
  zval *value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = probe_fetch(value, &handle);
  if (status) { probe_error(status); RETURN_THROWS(); }
  lgo_state *state = lgo_handle_state(handle); status = lgo_drain(state);
  ${ticket.cName} ticket = { handle->token }; ${nat.cName} serial = {0}; ov_result_owner owner = {0};
  if (!status) status = ${fn("serial")}(&state->native, &ticket, &serial, &owner);
  int valid = !status && serial.length == 1 && serial.data[0] == 42;
  int released = ov_owner_clear(&owner); if (!status) status = released;
  if (status) { probe_error(status); RETURN_THROWS(); }
  RETURN_BOOL(valid && handle->token > UINT32_MAX);
}
static ZEND_FUNCTION(owned_probe_retain) {
  zval *value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = probe_fetch(value, &handle);
  if (!status) status = lgo_handle_retain(handle, return_value);
  if (status) { probe_error(status); RETURN_THROWS(); }
}
static ZEND_FUNCTION(owned_probe_view) {
  zval *value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = probe_fetch(value, &handle);
  if (!status) status = lgo_wrap(handle->type, handle->token, handle->lease, handle->borrow, return_value);
  if (status) { probe_error(status); RETURN_THROWS(); }
}
static ZEND_FUNCTION(owned_probe_close) {
  zval *value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_resource_type || !Z_RES_P(value)->ptr) {
    probe_error(LB_OWNED_INVALID); RETURN_THROWS();
  }
  int status = lgo_handle_close(Z_RES_P(value)->ptr);
  if (status) { probe_error(status); RETURN_THROWS(); } RETURN_NULL();
}
// Keep mutable callback outputs in the caller's frame. Only this helper owns
// the setjmp boundary, so those outputs remain defined after a Zend bailout.
static void probe_borrow_invoke(lgo_borrow *borrow, uint64_t token, zval *callback,
    zval *values, int *status, int *bailout) {
  zend_try {
    if (!*status) *status = lgo_wrap(${ticket.index}, token, NULL, borrow, &values[0]);
    if (!*status && (call_user_function(EG(function_table), NULL, callback, &values[1], 1, &values[0]) != SUCCESS || EG(exception))) *status = 10;
  } zend_catch { *bailout = 1; } zend_end_try();
}
static ZEND_FUNCTION(owned_probe_borrow) {
  zval *value, *callback;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_ZVAL(value) Z_PARAM_ZVAL(callback) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL; int status = probe_fetch(value, &handle);
  if (!status && !zend_is_callable(callback, 0, NULL)) status = LB_OWNED_INVALID;
  if (status) { probe_error(status); RETURN_THROWS(); }
  lgo_state *state = lgo_handle_state(handle); lgo_borrow *borrow = NULL;
  ov_transaction transaction = {0}; ov_result_owner empty = {0}; lean_object *native = NULL; uint64_t token = 0;
  status = ov_begin(&transaction, &state->native, &empty, ${JSON.stringify(model.layout.model.component.id)});
  if (!status) status = lb_owned_scope_borrow(&transaction.scope, lgo_kind(${ticket.index}), handle->token, &native);
  if (!status) status = lb_owned_scope_acquire(&transaction.scope, lgo_kind(${ticket.index}), native, &token);
  if (!status) status = lgo_borrow_new(state, &transaction.scope, &borrow);
  int bailout = 0; zval values[2]; ZVAL_UNDEF(&values[0]); ZVAL_UNDEF(&values[1]);
  probe_borrow_invoke(borrow, token, callback, values, &status, &bailout);
  status = lgo_borrow_finish(&borrow, &transaction, values, 2, status, &bailout);
  if (bailout) zend_bailout();
  if (status || EG(exception)) { probe_error(status); RETURN_THROWS(); } RETURN_NULL();
}
static ZEND_FUNCTION(owned_probe_wrong_type) {
  zval *value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_ZVAL(value) ZEND_PARSE_PARAMETERS_END();
  lgo_handle *handle = NULL;
  int status = lgo_handle_fetch(value, ${model.types.find(node => node.kind === "callback").index}, NULL, &handle);
  if (status) { probe_error(status); RETURN_THROWS(); } RETURN_NULL();
}
static ZEND_FUNCTION(owned_probe_cleanup) {
  zval *failure, *callback;
  ZEND_PARSE_PARAMETERS_START(2, 2) Z_PARAM_OBJECT(failure) Z_PARAM_ZVAL(callback) ZEND_PARSE_PARAMETERS_END();
  if (!instanceof_function(Z_OBJCE_P(failure), zend_ce_throwable) || !zend_is_callable(callback, 0, NULL)) {
    probe_error(LB_OWNED_INVALID); RETURN_THROWS();
  }
  zval reply; ZVAL_UNDEF(&reply); int bailout = 0;
  if (call_user_function(EG(function_table), NULL, callback, &reply, 0, NULL) != SUCCESS || EG(exception)) {
    lgo_clear_zvals(&reply, 1, &bailout);
    if (bailout) zend_bailout();
    RETURN_THROWS();
  }
  zval original; ZVAL_COPY(&original, failure); zend_throw_exception_object(&original);
  lgo_clear_zvals(&reply, 1, &bailout);
  if (bailout) zend_bailout();
  RETURN_THROWS();
}
static ZEND_FUNCTION(owned_probe_fault) {
  zend_long value; ZEND_PARSE_PARAMETERS_START(1, 1) Z_PARAM_LONG(value) ZEND_PARSE_PARAMETERS_END();
  if (value < 0) { probe_error(LB_OWNED_INVALID); RETURN_THROWS(); }
  probe_attempts = 0; probe_fail_at = (size_t)value; RETURN_NULL();
}
static ZEND_FUNCTION(owned_probe_stats) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  size_t leases = 0, pending = 0;
  if (lgo_current) for (lgo_lease *lease = lgo_current->leases; lease; lease = lease->next) {
    ++leases; if (lease->pending) ++pending;
  }
  array_init(return_value); add_assoc_long(return_value, "live", probe_live);
  add_assoc_long(return_value, "attempts", probe_attempts);
  add_assoc_long(return_value, "failures", probe_failures);
  add_assoc_long(return_value, "leases", leases); add_assoc_long(return_value, "pending", pending);
  add_assoc_long(return_value, "identities", snapshot.live_identities);
  add_assoc_long(return_value, "scopes", lgo_current ? lgo_current->native.scopes : 0);
  add_assoc_long(return_value, "phpBits", sizeof(zend_long) * 8);
  add_assoc_bool(return_value, "current", lgo_current != NULL);
  add_assoc_bool(return_value, "retired", snapshot.component_init_runs && !lean_bridge_native_component_ready(${JSON.stringify(model.layout.model.component.id)}));
}
static ZEND_FUNCTION(owned_probe_drain) {
  int status = lgo_current ? lgo_drain(lgo_current) : LB_OWNED_OK;
  if (status) { probe_error(status); RETURN_THROWS(); } RETURN_NULL();
}
static ZEND_FUNCTION(owned_probe_shutdown) {
  int status = lgo_shutdown(); if (status) { probe_error(status); RETURN_THROWS(); } RETURN_NULL();
}
static ZEND_FUNCTION(owned_probe_bailout) { EG(exit_status) = 0; zend_bailout(); }
static PHP_MINIT_FUNCTION(owned_probe) {
  lgo_resource_type = zend_register_list_destructors_ex(lgo_resource_destroy, NULL, "Lean owned value", module_number);
  return SUCCESS;
}
static PHP_RSHUTDOWN_FUNCTION(owned_probe) { (void)lgo_shutdown(); return SUCCESS; }
static const zend_function_entry probe_functions[] = {
  ZEND_FE(owned_probe_new, probe_none)
  ZEND_FE(owned_probe_check, probe_one)
  ZEND_FE(owned_probe_retain, probe_one)
  ZEND_FE(owned_probe_view, probe_one)
  ZEND_FE(owned_probe_close, probe_one)
  ZEND_FE(owned_probe_borrow, probe_two)
  ZEND_FE(owned_probe_wrong_type, probe_one)
  ZEND_FE(owned_probe_cleanup, probe_two)
  ZEND_FE(owned_probe_fault, probe_one)
  ZEND_FE(owned_probe_stats, probe_none)
  ZEND_FE(owned_probe_drain, probe_none)
  ZEND_FE(owned_probe_shutdown, probe_none)
  ZEND_FE(owned_probe_bailout, probe_none)
  PHP_FE_END
};
zend_module_entry owned_probe_module_entry = {
  STANDARD_MODULE_HEADER, "owned_probe", probe_functions,
  PHP_MINIT(owned_probe), NULL, NULL, PHP_RSHUTDOWN(owned_probe), NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(owned_probe)
`;
};
