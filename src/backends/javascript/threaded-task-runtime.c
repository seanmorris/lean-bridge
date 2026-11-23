/* Owner-side entry for the generated pthread task profile. Each DSO is loaded
   locally and its component-specific control stays private to this heap. */
#include <lean/lean.h>
#include <emscripten.h>
#include <emscripten/threading.h>
#include <dlfcn.h>
#include <stdint.h>

extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init_System_Promise(uint8_t);
static uint32_t state, runs;
static int (*controls[256])(uint32_t *);
static uint32_t count;
uint32_t bridge_lean_runtime_status(void) { return state; }
uint32_t bridge_lean_runtime_init_runs(void) { return runs; }
void bridge_lean_runtime_retire(void) { state = 3; }
uint32_t bridge_lean_runtime_init(void) {
  if (state) return state == 2;
  ++runs; state = 1;
  lean_initialize_runtime_module();
  lean_init_task_manager_using(2);
  lean_object *r = initialize_Init_System_Promise(1);
  int ok = lean_io_result_is_ok(r); lean_dec(r);
  if (ok) lean_io_mark_end_initialization();
  state = ok ? 2 : 3;
  return ok;
}
uint32_t bridge_lean_runtime_component_initialize(lean_object *(*init)(uint8_t)) {
  if (state != 2 || !init) return 0;
  lean_object *r = init(1);
  int ok = lean_io_result_is_ok(r); lean_dec(r);
  if (!ok) bridge_lean_runtime_retire();
  return ok;
}
EMSCRIPTEN_KEEPALIVE uint32_t lb_js_task_load(const char *path, const char *name) {
  if (!emscripten_is_main_runtime_thread() || state == 3 || count == 256 || !path || !name) return 0;
  void *dso = dlopen(path, RTLD_NOW | RTLD_LOCAL);
  if (!dso) return 0;
  int (*call)(uint32_t *) = (int (*)(uint32_t *))dlsym(dso, name);
  if (!call) { dlclose(dso); return 0; }
  controls[count++] = call;
  return count;
}
EMSCRIPTEN_KEEPALIVE int lb_js_task_call(uint32_t slot, uint32_t *frame) {
  if (!emscripten_is_main_runtime_thread() || state == 3 || !slot || slot > count) return 10;
  return controls[slot-1](frame);
}
