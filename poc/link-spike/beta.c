#include <stdint.h>

typedef int32_t (*lean_wasm_unary_fn)(int32_t);

extern int32_t bridge_increment(int32_t delta);
extern int32_t bridge_call_alpha(int32_t value);
extern void bridge_register_beta(lean_wasm_unary_fn entry);

__attribute__((used, visibility("default")))
int32_t beta_chain(int32_t value) {
  const int32_t alpha_result = bridge_call_alpha(value);
  bridge_increment(value * 2);
  return alpha_result + 1000;
}

__attribute__((constructor))
static void beta_initialize(void) {
  bridge_increment(2000);
  bridge_register_beta(beta_chain);
}
