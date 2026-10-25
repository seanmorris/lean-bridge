#include "component.h"
#include "lean_bridge_native_runtime.h"
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_invoke(size_t token, lean_object *value0, lean_object *value1) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    lean_dec(value1);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *, lean_object *))callback.invoke)(callback.context, value0, value1);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_23220a30761b2d3716c5b4ed_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
