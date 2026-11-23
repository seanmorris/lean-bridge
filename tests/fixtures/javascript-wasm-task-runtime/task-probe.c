/* Producer-side feasibility fixture, not the public task ABI. The small
   Lean module uses its real initializer before any exported call.
   Only the owner agent calls these functions; no pointer crosses into JS. */
#include <emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include "task-notification.h"
#include "ThreadProbe.c"

extern void lean_initialize_runtime_module(void);
static lean_object *gate, *entered, *task;
static uint32_t current;
static int active;

EMSCRIPTEN_KEEPALIVE int probe_init(void) {
  if (active) return 0;
  lean_initialize_runtime_module();
  lean_init_task_manager_using(1);
  lean_object *result = initialize_ThreadProbe(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  active = 1;
  return 1;
}

EMSCRIPTEN_KEEPALIVE int probe_check_temp_io(void) {
  if (!active) return 0;
  lean_object *result = lean_bridge_probe_temp_io();
  int ok = !lean_io_result_is_error(result);
  if (!ok) lean_io_result_show_error(result);
  lean_dec(result);
  return ok;
}

/* Two independent subscriptions to an already finished Lean Task. */
EMSCRIPTEN_KEEPALIVE int probe_watch_ready(uint32_t first, uint32_t second) {
  if (!active || !first || !second || first == second) return 0;
  lean_object *t = lean_bridge_probe_ready(42);
  lean_bridge_wasm_task_subscribe_v1(t, first);
  lean_bridge_wasm_task_subscribe_v1(t, second);
  lean_dec(t);
  return 1;
}

EMSCRIPTEN_KEEPALIVE uint32_t probe_open(int cooperative, uint32_t on_entry, uint32_t on_result) {
  if (!active || task || current == UINT32_MAX || !on_entry || !on_result || on_entry == on_result) return 0;
  gate = lean_bridge_probe_gate();
  lean_object *arrived = lean_bridge_probe_gate();
  lean_inc(arrived);
  entered = lean_bridge_probe_watch(arrived);
  lean_inc(gate);
  ++current;
  task = lean_bridge_probe_start(gate, arrived, cooperative != 0);
  lean_bridge_wasm_task_subscribe_v1(entered, on_entry);
  lean_bridge_wasm_task_subscribe_v1(task, on_result);
  return current;
}

/* bit 0 = worker signalled, bit 1 = result readable without blocking */
EMSCRIPTEN_KEEPALIVE int probe_state(uint32_t key) {
  if (!task || key != current) return -1;
  return (lean_io_get_task_state_core(entered) == LEAN_TASK_STATE_FINISHED) |
      ((lean_io_get_task_state_core(task) == LEAN_TASK_STATE_FINISHED) << 1);
}

EMSCRIPTEN_KEEPALIVE int probe_release(uint32_t key, uint32_t value) {
  if (!task || key != current || !gate) return 0;
  lean_dec(lean_bridge_probe_signal(gate, value)); /* consumes the owner */
  gate = NULL;
  return 1;
}

EMSCRIPTEN_KEEPALIVE int probe_cancel(uint32_t key) {
  if (!task || key != current) return 0;
  lean_io_cancel_core(task);
  return 1;
}

/* JavaScript first acquires state 3. No Task.get on a pending result. */
EMSCRIPTEN_KEEPALIVE double probe_take(uint32_t key) {
  if (probe_state(key) != 3) return -1;
  uint32_t value = lean_unbox_uint32(lean_task_get(task));
  lean_dec(task); lean_dec(entered);
  if (gate) lean_dec(gate);
  task = entered = gate = NULL;
  return value;
}
