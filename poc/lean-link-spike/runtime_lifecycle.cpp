#include "runtime/init_module.h"

extern "C" void bridge_lean_runtime_finalize_module(void) {
  lean::finalize_runtime_module();
}
