/* Link into the owning threaded runtime, not each component. The owner
   reserves a one-shot token before a generated component calls subscribe.
   This observer only reports readiness; the component retains and lifts the
   typed result. It works for pending and already-complete Lean Tasks. */
#include "task-notification.h"
#include <emscripten.h>

static lean_obj_res notify(lean_obj_arg token, lean_obj_arg value) {
  uint32_t id = lean_unbox_uint32(token);
  lean_dec(token);
  lean_dec(value);
  MAIN_THREAD_ASYNC_EM_ASM({
    const token = $0 >>> 0;
    queueMicrotask(() => Module['onLeanTaskReady'](token));
  }, id);
  return lean_box(0);
}

void lean_bridge_wasm_task_subscribe_v1(b_lean_obj_arg task, uint32_t token) {
  lean_object *f = lean_alloc_closure((void *)notify, 2, 1);
  lean_closure_set(f, 0, lean_box_uint32(token));
  lean_mark_mt(task);
  lean_inc(task);
  lean_dec(lean_task_map_core(f, task, 0, true, true));
}
