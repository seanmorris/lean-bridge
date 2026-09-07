#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_Tarjan(uint8_t builtin);
extern lean_object *lean_tarjan_prepare(uint32_t count, lean_object *offsets, lean_object *targets);
extern lean_object *lean_tarjan_solve(lean_object *prepared);
extern lean_object *lean_tarjan_solve_total(lean_object *prepared);
extern void lean_initialize_runtime_module(void);
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_tarjan_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_Tarjan(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *nat_array(const uint32_t *values, uint32_t length) {
  lean_object *array = lean_alloc_array(length, length);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < length; index++) data[index] = lean_unsigned_to_nat(values[index]);
  return array;
}

/* Preparation owns a separate Lean graph, not a shared global graph slot. */
EMSCRIPTEN_KEEPALIVE
uint32_t lean_tarjan_prepare_c(uint32_t count, const uint32_t *offsets,
    const uint32_t *targets, uint32_t edge_count) {
  if (!runtime_ready || count > LEAN_MAX_SMALL_NAT || edge_count > LEAN_MAX_SMALL_NAT ||
      !offsets || (edge_count && !targets) || offsets[0] || offsets[count] != edge_count) return 0;
  for (uint32_t vertex = 0; vertex < count; vertex++)
    if (offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > edge_count) return 0;
  for (uint32_t index = 0; index < edge_count; index++) if (targets[index] >= count) return 0;
  lean_object *option = lean_tarjan_prepare(count, nat_array(offsets, count + 1),
    nat_array(targets, edge_count));
  if (lean_is_scalar(option)) return 0;
  lean_object *prepared = lean_ctor_get(option, 0);
  lean_inc(prepared);
  lean_dec(option);
  return (uint32_t)(uintptr_t)prepared;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_tarjan_run(uint32_t handle, uint32_t diagnostic, uint32_t *output, uint32_t capacity) {
  if (!runtime_ready || !handle || !output) return UINT32_MAX;
  lean_object *prepared = (lean_object *)(uintptr_t)handle;
  lean_inc(prepared);
  lean_object *result = diagnostic ? lean_tarjan_solve_total(prepared) : lean_tarjan_solve(prepared);
  size_t size = lean_array_size(result);
  if (size > capacity) { lean_dec(result); return UINT32_MAX; }
  for (size_t index = 0; index < size; index++) {
    lean_object *value = lean_array_uget_borrowed(result, index);
    if (!lean_is_scalar(value)) { lean_dec(result); return UINT32_MAX; }
    output[index] = (uint32_t)lean_unbox(value);
  }
  lean_dec(result);
  return (uint32_t)size;
}

EMSCRIPTEN_KEEPALIVE
void lean_tarjan_release(uint32_t handle) {
  if (handle) lean_dec((lean_object *)(uintptr_t)handle);
}
