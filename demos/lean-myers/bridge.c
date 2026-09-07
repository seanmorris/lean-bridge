#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_Myers(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_myers_prepare(lean_object *before, lean_object *after);
extern lean_object *lean_myers_solve(lean_object *prepared);
extern lean_object *lean_myers_solve_total(lean_object *prepared);
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_myers_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_Myers(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *token_array(const uint32_t *tokens, uint32_t count) {
  lean_object *result = lean_alloc_array(count, count);
  lean_object **data = lean_array_cptr(result);
  for (uint32_t index = 0; index < count; index++)
    data[index] = lean_unsigned_to_nat(tokens[index]);
  return result;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_myers_prepare_c(const uint32_t *before, uint32_t before_count,
    const uint32_t *after, uint32_t after_count) {
  if (!runtime_ready || before_count > 4096 || after_count > 4096 ||
      before_count + after_count > 4096 || (before_count && !before) ||
      (after_count && !after)) return 0;
  lean_object *prepared = lean_myers_prepare(token_array(before, before_count),
    token_array(after, after_count));
  return (uint32_t)(uintptr_t)prepared;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_myers_run(uint32_t handle, uint32_t diagnostic,
    uint32_t *output, uint32_t capacity) {
  if (!runtime_ready || !handle || !output) return UINT32_MAX;
  lean_object *prepared = (lean_object *)(uintptr_t)handle;
  lean_inc(prepared);
  lean_object *result = diagnostic ? lean_myers_solve_total(prepared) : lean_myers_solve(prepared);
  size_t length = lean_array_size(result);
  if (length > capacity) { lean_dec(result); return UINT32_MAX; }
  for (size_t index = 0; index < length; index++)
    output[index] = lean_uint32_of_nat(lean_array_uget_borrowed(result, index));
  lean_dec(result);
  return (uint32_t)length;
}

EMSCRIPTEN_KEEPALIVE
void lean_myers_release(uint32_t handle) {
  if (handle) lean_dec((lean_object *)(uintptr_t)handle);
}
