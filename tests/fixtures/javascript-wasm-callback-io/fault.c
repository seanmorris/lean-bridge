/* Test-only scalar side module. Its one public call deliberately executes
   Wasm unreachable; no application archive or runtime is rewritten. */
#include <lean/lean.h>
#include <stdint.h>

lean_object *initialize_BridgeTestFault(uint8_t builtin) {
  (void)builtin;
  return lean_io_result_mk_ok(lean_box(0));
}

uint32_t lean_bridge_9a08ea85b538463aadcffcde(void *frame) {
  (void)frame;
  __builtin_trap();
}
