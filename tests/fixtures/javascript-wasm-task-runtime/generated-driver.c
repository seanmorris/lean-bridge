/* Test runtime for the generated component ABI. Component identity, handle
   allocation and lifetime counts come from the real shared Wasm broker. */
#include <lean/lean.h>
#include <emscripten.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdint.h>

extern void lean_initialize_runtime_module(void);
extern lean_object *initialize_Init_System_Promise(uint8_t);
static uint32_t state, runs;
static int (*control)(uint32_t *);
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
EMSCRIPTEN_KEEPALIVE int generated_load(const char *name) {
  if (control || !name) return 0;
  void *dso = dlopen("/component.wasm", RTLD_NOW | RTLD_LOCAL);
  if (dso) control = (int (*)(uint32_t *))dlsym(dso, name);
  if (!control) fprintf(stderr, "generated component: %s\n", dlerror());
  return control != NULL;
}
EMSCRIPTEN_KEEPALIVE int generated_call(uint32_t *frame) {
  return control ? control(frame) : 10;
}
