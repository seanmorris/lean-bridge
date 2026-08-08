#include <stdint.h>

typedef int32_t (*lean_wasm_unary_fn)(int32_t);

extern int32_t bridge_increment(int32_t delta);
extern void bridge_register_alpha(lean_wasm_unary_fn entry);

__attribute__((used, visibility("default")))
int32_t alpha_add(int32_t value) {
  bridge_increment(value);
  return value + 100;
}

__attribute__((constructor))
static void alpha_initialize(void) {
  bridge_increment(1000);
  bridge_register_alpha(alpha_add);
}
