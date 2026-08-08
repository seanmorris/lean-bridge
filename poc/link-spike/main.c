#include <emscripten/emscripten.h>
#include <stdint.h>

typedef int32_t (*lean_wasm_unary_fn)(int32_t);

static int32_t bridge_counter = 0;
static lean_wasm_unary_fn alpha_entry = 0;
static lean_wasm_unary_fn beta_entry = 0;

EMSCRIPTEN_KEEPALIVE
int32_t bridge_increment(int32_t delta) {
  bridge_counter += delta;
  return bridge_counter;
}

EMSCRIPTEN_KEEPALIVE
int32_t bridge_get_counter(void) {
  return bridge_counter;
}

EMSCRIPTEN_KEEPALIVE
void bridge_reset(void) {
  bridge_counter = 0;
  alpha_entry = 0;
  beta_entry = 0;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_alpha(lean_wasm_unary_fn entry) {
  alpha_entry = entry;
  bridge_counter += 10;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_beta(lean_wasm_unary_fn entry) {
  beta_entry = entry;
  bridge_counter += 20;
}

EMSCRIPTEN_KEEPALIVE
int32_t bridge_has_alpha(void) {
  return alpha_entry != 0;
}

EMSCRIPTEN_KEEPALIVE
int32_t bridge_has_beta(void) {
  return beta_entry != 0;
}

EMSCRIPTEN_KEEPALIVE
int32_t bridge_call_alpha(int32_t value) {
  return alpha_entry ? alpha_entry(value) : INT32_MIN;
}

EMSCRIPTEN_KEEPALIVE
int32_t bridge_call_beta(int32_t value) {
  return beta_entry ? beta_entry(value) : INT32_MIN;
}
