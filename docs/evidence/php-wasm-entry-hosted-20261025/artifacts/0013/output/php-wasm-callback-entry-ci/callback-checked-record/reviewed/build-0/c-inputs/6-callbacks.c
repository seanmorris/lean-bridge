#include "component.h"
#include "lean_bridge_native_runtime.h"
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_2663a58c7c0e71654db1d87936875f8677e197b2_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_invoke(size_t token, lean_object *value0, lean_object *value1) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    lean_dec(value1);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *, lean_object *))callback.invoke)(callback.context, value0, value1);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_526ba4a0f03797057c1f9a17ca435a5a42131510_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_00652748bed3eb7036c9091f570efa39888f5490_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_invoke(size_t token, lean_object *value0) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) {
    lean_dec(value0);
    return lean_alloc_array(0, 0);
  }
  return ((lean_object *(*)(void *, lean_object *))callback.invoke)(callback.context, value0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_recovery(size_t token) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) return lean_alloc_array(0, 0);
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  return controls && controls->recovery ? controls->recovery(callback.context) : lean_alloc_array(0, 0);
}
lean_object *lean_bridge_697151f2fc3cf6b95ff12b69_structured_cd01d463066ae86d043223e65eab1640e16b22ab_reject(size_t token, lean_object *recovery) {
  lb_native_callback callback = lb_native_callback_lookup(token);
  if (!callback.invoke) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  lean_bridge_697151f2fc3cf6b95ff12b69_structured_callback_controls *controls = callback.context;
  if (!controls || !controls->reject) { lean_dec(recovery); return lean_alloc_array(0, 0); }
  return controls->reject(callback.context, recovery);
}
