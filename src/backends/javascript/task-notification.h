/* Internal Wasm-to-Wasm ABI. Generated components borrow a known Lean Task;
   no Lean pointer is passed to the JavaScript owner or its worker messages. */
#ifndef LEAN_BRIDGE_WASM_TASK_NOTIFICATION_H
#define LEAN_BRIDGE_WASM_TASK_NOTIFICATION_H
#include <lean/lean.h>
#include <stdint.h>
void lean_bridge_wasm_task_subscribe_v1(b_lean_obj_arg task, uint32_t token);
void lean_bridge_wasm_task_ready_v1(uint32_t token);
uint8_t lean_bridge_wasm_callback_acquire_v1(void);
lean_obj_res lean_bridge_wasm_callback_release_v1(void);
#endif
