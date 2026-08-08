#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_link_box_fn)(uint32_t);
typedef uint32_t (*lean_link_read_fn)(lean_object *);

static lean_link_box_fn alpha_box = 0;
static lean_link_read_fn alpha_read = 0;
static uint32_t runtime_initialized = 0;
static uint32_t live_handles = 0;

/*
 * The full cross-compiled Init library is a later WP2 step. This exact stub is
 * sufficient for the generated Alpha module, whose exported functions use only
 * leanrt and a persistent string literal. It is an explicit trusted boundary,
 * not a claim that arbitrary generated modules can initialize without Init.
 */
LEAN_EXPORT lean_object *initialize_Init(uint8_t builtin) {
  (void)builtin;
  return lean_io_result_mk_ok(lean_box(0));
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_runtime_init(void) {
  if (!runtime_initialized) {
    /*
     * This POC builds leanrt without the small allocator, mimalloc, or Lean
     * multithreading. The allocation/RC core used below is therefore lazy and
     * has no mandatory global initializer. Full Init/IO startup remains a
     * separately tracked WP2 requirement.
     */
    runtime_initialized = 1;
  }
  return runtime_initialized;
}

EMSCRIPTEN_KEEPALIVE
void bridge_register_lean_alpha(
    lean_link_box_fn box,
    lean_link_read_fn read
) {
  alpha_box = box;
  alpha_read = read;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_has_lean_alpha(void) {
  return alpha_box != 0 && alpha_read != 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_make(uint32_t value) {
  if (!runtime_initialized || !alpha_box) return 0;
  lean_object *box = alpha_box(value);
  live_handles += 1;
  return (uint32_t)(uintptr_t)box;
}

EMSCRIPTEN_KEEPALIVE
uint32_t bridge_lean_alpha_read(uint32_t handle) {
  if (!alpha_read || handle == 0) return UINT32_MAX;
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
