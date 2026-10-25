#include <stdio.h>
#include "component.h"
#include "lean_bridge_native_runtime.h"
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_invoke(size_t token, lean_object *value0) {
  fputs("LB_CALLBACK_ENTRY_V1 enter callback ReviewedCallbacks.visit:callback:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_recovery(size_t token) {
  fputs("LB_CALLBACK_ENTRY_V1 enter recovery ReviewedCallbacks.visit:recovery:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_reject(size_t token, lean_object *recovery) {
  fputs("LB_CALLBACK_ENTRY_V1 enter rejection ReviewedCallbacks.visit:rejection:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_invoke(size_t token, lean_object *value0) {
  fputs("LB_CALLBACK_ENTRY_V1 enter callback ReviewedCallbacks.three:callback:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_recovery(size_t token) {
  fputs("LB_CALLBACK_ENTRY_V1 enter recovery ReviewedCallbacks.three:recovery:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_reject(size_t token, lean_object *recovery) {
  fputs("LB_CALLBACK_ENTRY_V1 enter rejection ReviewedCallbacks.three:rejection:lean\n", stderr);

  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_fa450d817b39ecc8598f3607_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
