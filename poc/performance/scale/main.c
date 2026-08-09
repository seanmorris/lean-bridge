#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

typedef uint32_t (*scale_ping_fn)(uint32_t);
typedef lean_object *(*scale_initializer_fn)(uint8_t);

extern lean_object *initialize_Init(uint8_t);
extern void lean_initialize_runtime_module(void);
extern void bridge_lean_runtime_finalize_module(void);

enum scale_runtime_state {
  SCALE_RUNTIME_COLD = 0,
  SCALE_RUNTIME_READY = 1,
  SCALE_RUNTIME_FAILED = 2,
  SCALE_RUNTIME_SHUT_DOWN = 3,
};

enum scale_limits {
  SCALE_COMPONENT_CAPACITY = 50,
};

static scale_ping_fn ping_functions[SCALE_COMPONENT_CAPACITY];
static scale_initializer_fn initializers[SCALE_COMPONENT_CAPACITY];
static uint8_t initialized[SCALE_COMPONENT_CAPACITY];
static uint32_t runtime_state = SCALE_RUNTIME_COLD;
static uint32_t runtime_init_runs = 0;
static uint32_t registration_runs = 0;
static uint32_t library_init_runs = 0;
static uint32_t rejected_calls = 0;

EMSCRIPTEN_KEEPALIVE
void bridge_scale_register(
    uint32_t ordinal,
    scale_ping_fn ping,
    scale_initializer_fn initializer
) {
  uint32_t slot;
  if (ordinal == 0 || ordinal > SCALE_COMPONENT_CAPACITY || !ping || !initializer) {
    rejected_calls += 1;
    return;
  }
  slot = ordinal - 1;
  if (ping_functions[slot] || initializers[slot]) {
    rejected_calls += 1;
    return;
  }
  ping_functions[slot] = ping;
  initializers[slot] = initializer;
  registration_runs += 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_scale_runtime_init(void) {
  lean_object *result;
  if (runtime_state == SCALE_RUNTIME_READY) return 1;
  if (runtime_state != SCALE_RUNTIME_COLD) return 0;
  runtime_init_runs += 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = SCALE_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_state = SCALE_RUNTIME_READY;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_scale_component_init(uint32_t ordinal) {
  lean_object *result;
  uint32_t slot;
  if (
    runtime_state != SCALE_RUNTIME_READY || ordinal == 0 ||
    ordinal > SCALE_COMPONENT_CAPACITY
  ) return 0;
  slot = ordinal - 1;
  if (initialized[slot]) return 1;
  if (!initializers[slot]) return 0;
  result = initializers[slot](1);
  library_init_runs += 1;
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = SCALE_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  initialized[slot] = 1;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_scale_call(uint32_t ordinal, uint32_t value) {
  uint32_t slot;
  if (
    runtime_state != SCALE_RUNTIME_READY || ordinal == 0 ||
    ordinal > SCALE_COMPONENT_CAPACITY
  ) {
    rejected_calls += 1;
    return UINT32_MAX;
  }
  slot = ordinal - 1;
  if (!initialized[slot] || !ping_functions[slot]) {
    rejected_calls += 1;
    return UINT32_MAX;
  }
  return ping_functions[slot](value);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_scale_runtime_shutdown(void) {
  if (runtime_state == SCALE_RUNTIME_SHUT_DOWN) return 1;
  if (runtime_state != SCALE_RUNTIME_READY) return 0;
  bridge_lean_runtime_finalize_module();
  runtime_state = SCALE_RUNTIME_SHUT_DOWN;
  return 1;
}

EMSCRIPTEN_KEEPALIVE uint32_t bridge_scale_runtime_state(void) { return runtime_state; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_scale_runtime_init_runs(void) { return runtime_init_runs; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_scale_registration_runs(void) { return registration_runs; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_scale_library_init_runs(void) { return library_init_runs; }
EMSCRIPTEN_KEEPALIVE uint32_t bridge_scale_rejected_calls(void) { return rejected_calls; }
