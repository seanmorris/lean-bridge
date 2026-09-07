#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_Sweep(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_sweep_prepare(lean_object *bounds, lean_object *dimensions, lean_object *axis);
extern lean_object *lean_sweep_solve(lean_object *prepared);
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_sweep_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_Sweep(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_sweep_prepare_c(const int32_t *bounds, uint32_t words,
    uint32_t dimensions, uint32_t axis) {
  if (!runtime_ready || (dimensions != 2 && dimensions != 3) || axis >= dimensions ||
      words % (dimensions * 2) || words / (dimensions * 2) > 1024 || (words && !bounds)) return 0;
  lean_object *array = lean_alloc_array(words, words);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < words; index++)
    data[index] = lean_int64_to_int((int64_t)bounds[index]);
  lean_object *option = lean_sweep_prepare(array, lean_unsigned_to_nat(dimensions), lean_unsigned_to_nat(axis));
  if (lean_is_scalar(option)) return 0;
  lean_object *prepared = lean_ctor_get(option, 0);
  lean_inc(prepared);
  lean_dec(option);
  return (uint32_t)(uintptr_t)prepared;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_sweep_run(uint32_t handle, uint32_t *output, uint32_t capacity) {
  if (!runtime_ready || !handle || !output) return UINT32_MAX;
  lean_object *prepared = (lean_object *)(uintptr_t)handle;
  lean_inc(prepared);
  lean_object *result = lean_sweep_solve(prepared);
  size_t length = lean_array_size(result);
  if (length > capacity) { lean_dec(result); return UINT32_MAX; }
  for (size_t index = 0; index < length; index++)
    output[index] = lean_uint32_of_nat(lean_array_uget_borrowed(result, index));
  lean_dec(result);
  return (uint32_t)length;
}

EMSCRIPTEN_KEEPALIVE
void lean_sweep_release(uint32_t handle) {
  if (handle) lean_dec((lean_object *)(uintptr_t)handle);
}
