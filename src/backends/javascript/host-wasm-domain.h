/* Private link interface, supplied exactly once per shared Lean Wasm heap. */
#ifndef LEAN_BRIDGE_JS_HOST_DOMAIN_H
#define LEAN_BRIDGE_JS_HOST_DOMAIN_H
#include <lean/lean.h>
#include "host-wasm-errors.h"
uint32_t lb_jsh_domain_token_v1(uint32_t kind, b_lean_obj_arg value);
lean_obj_res lb_jsh_domain_wrap_v1(uint32_t kind, uint32_t token, b_lean_obj_arg anchor);
int lb_jsh_domain_admit_v1(uint32_t kind, b_lean_obj_arg value);
void lb_jsh_domain_enter_v1(lb_jsh_error_scope *scope);
uint32_t lb_jsh_domain_leave_v1(lb_jsh_error_scope *scope,b_lean_obj_arg escaped);
lean_obj_res lb_jsh_domain_error_v1(uint32_t status,uint32_t key);
#endif
