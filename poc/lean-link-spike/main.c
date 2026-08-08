#include <emscripten/emscripten.h>
#include <emscripten/heap.h>
#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);
typedef lean_object *(*lean_link_identity_fn)(lean_object *);
typedef lean_object *(*lean_link_initializer_fn)(uint8_t);

extern lean_object *initialize_Init(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern void bridge_lean_runtime_finalize_module(void);

enum bridge_lean_runtime_state {
  BRIDGE_LEAN_RUNTIME_COLD = 0,
  BRIDGE_LEAN_RUNTIME_INITIALIZING = 1,
  BRIDGE_LEAN_RUNTIME_READY = 2,
  BRIDGE_LEAN_RUNTIME_FAILED = 3,
  BRIDGE_LEAN_RUNTIME_SHUT_DOWN = 4,
};

static lean_link_box_fn alpha_box = 0;
static lean_link_read_fn alpha_read = 0;
static lean_link_identity_fn beta_identity = 0;
static lean_link_identity_fn gamma_identity = 0;
static lean_link_read_fn beta_read = 0;
static lean_link_read_fn gamma_read = 0;
static lean_link_initializer_fn alpha_initializer = 0;
static lean_link_initializer_fn beta_initializer = 0;
static lean_link_initializer_fn gamma_initializer = 0;
static uint32_t runtime_state = BRIDGE_LEAN_RUNTIME_COLD;
static uint32_t runtime_init_runs = 0;
static uint32_t library_init_runs = 0;
static uint32_t live_handles = 0;
#if defined(BRIDGE_LEAN_RUNTIME_TEST_HOOKS)
static uint32_t force_init_error = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_runtime_force_init_error(void) {
  if (runtime_state != BRIDGE_LEAN_RUNTIME_COLD) return 0;
  force_init_error = 1;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_heap_size(void) {
  return (uint32_t)emscripten_get_heap_size();
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_test_lean_grow_heap(void) {
  size_t before = emscripten_get_heap_size();
  size_t requested = before + (64u * 1024u);
  if (!emscripten_resize_heap(requested)) return 0;
  return (uint32_t)emscripten_get_heap_size();
}
#endif

static uint32_t bridge_run_library_initializer(
    lean_link_initializer_fn initialize
) {
  lean_object *result;

  if (!initialize) return 1;
  result = initialize(1);
  library_init_runs += 1;
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    return 0;
  }
  lean_dec(result);
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_init(void) {
  lean_object *result;

  if (runtime_state == BRIDGE_LEAN_RUNTIME_READY) return 1;
  if (runtime_state != BRIDGE_LEAN_RUNTIME_COLD) return 0;

  runtime_state = BRIDGE_LEAN_RUNTIME_INITIALIZING;
  runtime_init_runs += 1;
  lean_initialize_runtime_module();
#if defined(BRIDGE_LEAN_RUNTIME_TEST_HOOKS)
  if (force_init_error) {
    result = lean_io_result_mk_error(
      lean_mk_io_user_error(lean_mk_string("forced Init failure probe"))
    );
  } else {
    result = initialize_Init(1);
  }
#else
  result = initialize_Init(1);
#endif
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    runtime_state = BRIDGE_LEAN_RUNTIME_FAILED;
    return 0;
  }
  lean_dec(result);
  if (
    !bridge_run_library_initializer(alpha_initializer) ||
    !bridge_run_library_initializer(beta_initializer) ||
    !bridge_run_library_initializer(gamma_initializer)
  ) {
    runtime_state = BRIDGE_LEAN_RUNTIME_FAILED;
    return 0;
  }
  lean_io_mark_end_initialization();
  runtime_state = BRIDGE_LEAN_RUNTIME_READY;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_status(void) {
  return runtime_state;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_init_runs(void) {
  return runtime_init_runs;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_library_init_runs(void) {
  return library_init_runs;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_shutdown(void) {
  if (runtime_state == BRIDGE_LEAN_RUNTIME_SHUT_DOWN) return 1;
  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || live_handles != 0) return 0;

  runtime_state = BRIDGE_LEAN_RUNTIME_SHUT_DOWN;
  bridge_lean_runtime_finalize_module();
  return 1;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_alpha(
    lean_link_box_fn box,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
) {
  alpha_box = box;
  alpha_read = read;
  alpha_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_beta(
    lean_link_identity_fn identity,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
) {
  beta_identity = identity;
  beta_read = read;
  beta_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_gamma(
    lean_link_identity_fn identity,
    lean_link_read_fn read,
    lean_link_initializer_fn initialize
) {
  gamma_identity = identity;
  gamma_read = read;
  gamma_initializer = initialize;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_alpha(void) {
  return alpha_box != 0 && alpha_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_beta(void) {
  return beta_identity != 0 && beta_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_gamma(void) {
  return gamma_identity != 0 && gamma_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_make(uint32_t value) {
  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || !alpha_box) return 0;
  lean_object *box = alpha_box(value);
  live_handles += 1;
  return (uint32_t)(uintptr_t)box;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_read(uint32_t handle) {
  if (runtime_state != BRIDGE_LEAN_RUNTIME_READY || !alpha_read || handle == 0) {
    return UINT32_MAX;
  }
  lean_object *box = (lean_object *)(uintptr_t)handle;
  /* The generated export consumes its argument; retain around a borrowed read. */
  lean_inc(box);
  return alpha_read(box);
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_handle_identity(uint32_t handle) {
  return handle;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_cross_library_identity(uint32_t handle) {
  lean_object *original;
  lean_object *after_beta;
  lean_object *after_gamma;
  uint32_t alpha_value;
  uint32_t beta_value;
  uint32_t gamma_value;
  uint32_t result;

  if (
    runtime_state != BRIDGE_LEAN_RUNTIME_READY ||
    handle == 0 ||
    !alpha_read ||
    !beta_identity ||
    !beta_read ||
    !gamma_identity ||
    !gamma_read
  ) {
    return 0;
  }

  original = (lean_object *)(uintptr_t)handle;
  lean_inc(original);
  alpha_value = alpha_read(original);
  lean_inc(original);
  beta_value = beta_read(original);
  lean_inc(original);
  gamma_value = gamma_read(original);
  lean_inc(original);
  after_beta = beta_identity(original);
  after_gamma = gamma_identity(after_beta);
  result = (
    after_gamma == original &&
    alpha_value == beta_value &&
    beta_value == gamma_value
  ) ? handle : 0;
  lean_dec(after_gamma);
  return result;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_release(uint32_t handle) {
  if (handle == 0 || live_handles == 0) return 0;
  lean_dec((lean_object *)(uintptr_t)handle);
  live_handles -= 1;
  return live_handles;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_live_handles(void) {
  return live_handles;
}
