/* Link into the owning threaded runtime, not each component. The owner
   reserves a one-shot token before a generated component calls subscribe.
   This observer only reports readiness; the component retains and lifts the
   typed result. It works for pending and already-complete Lean Tasks. */
#include "task-notification.h"
#include <emscripten.h>
#include <stdatomic.h>

/* Per runtime, not per DSO. Lean compensates for each pool worker parked by
   IO.wait. Keep two of the four preloaded pthreads for ordinary scheduler
   work. Release on the waiting worker, not on the sending JS agent. */
static atomic_uint callback_waits;
uint8_t lean_bridge_wasm_callback_acquire_v1(void) {
  unsigned n = atomic_load(&callback_waits);
  while (n < 2) {
    if (atomic_compare_exchange_weak(&callback_waits, &n, n + 1)) return 1;
  }
  return 0;
}
lean_obj_res lean_bridge_wasm_callback_release_v1(void) {
  atomic_fetch_sub(&callback_waits, 1);
  return lean_box(0);
}

void lean_bridge_wasm_task_ready_v1(uint32_t id) {
  MAIN_THREAD_ASYNC_EM_ASM({
    const token = $0 >>> 0;
    queueMicrotask(() => Module['onLeanTaskReady'](token));
  }, id);
}
/* A non-exclusive map closure retains its source task until lean_apply_1
   returns. Signalling from that closure can expose a result before the worker
   releases its last reference to the source. Use a Unit completion fence:
   the notifying closure can now retain only Unit, never the typed result. */
static lean_obj_res drop_result(lean_obj_arg value) {
  lean_dec(value);
  return lean_box(0);
}
static lean_obj_res notify(lean_obj_arg token, lean_obj_arg unit) {
  uint32_t id = lean_unbox_uint32(token);
  lean_dec(token);
  lean_dec(unit);
  lean_bridge_wasm_task_ready_v1(id);
  return lean_box(0);
}

void lean_bridge_wasm_task_subscribe_v1(b_lean_obj_arg task, uint32_t token) {
  lean_object *f = lean_alloc_closure((void *)notify, 2, 1);
  lean_closure_set(f, 0, lean_box_uint32(token));
  lean_mark_mt(task);
  lean_inc(task);
  lean_object *fence = lean_task_map_core(lean_alloc_closure((void *)drop_result, 1, 0), task, 0, true, true);
  lean_dec(lean_task_map_core(f, fence, 0, true, true));
}
