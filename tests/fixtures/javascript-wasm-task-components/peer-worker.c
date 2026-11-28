#include <emscripten/threading.h>
#include <stdint.h>
uint8_t lean_bridge_task_peer_is_worker(void) {
  return !emscripten_is_main_runtime_thread();
}
