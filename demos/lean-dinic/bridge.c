#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_Dinic(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_dinic_prepare(lean_object *count, lean_object *source,
    lean_object *sink, lean_object *edges);
extern lean_object *lean_dinic_solve(lean_object *prepared);
extern lean_object *lean_dinic_solve_total(lean_object *prepared);
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_dinic_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_Dinic(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

/* Preserve original CSR edge order, including parallel and antiparallel edges. */
EMSCRIPTEN_KEEPALIVE
uint32_t lean_dinic_prepare_c(uint32_t count, uint32_t source, uint32_t sink,
    const uint32_t *offsets, const uint32_t *targets, const uint32_t *capacities,
    uint32_t edge_count) {
  if (!runtime_ready || count < 2 || count > 65536 || edge_count > 1000000 ||
      source >= count || sink >= count || source == sink || !offsets ||
      (edge_count && (!targets || !capacities)) || offsets[0] || offsets[count] != edge_count)
    return 0;
  for (uint32_t vertex = 0; vertex < count; vertex++)
    if (offsets[vertex] > offsets[vertex + 1] || offsets[vertex + 1] > edge_count) return 0;
  for (uint32_t edge = 0; edge < edge_count; edge++) if (targets[edge] >= count) return 0;
  lean_object *edges = lean_alloc_array(edge_count * 3, edge_count * 3);
  lean_object **data = lean_array_cptr(edges);
  for (uint32_t vertex = 0; vertex < count; vertex++)
    for (uint32_t edge = offsets[vertex]; edge < offsets[vertex + 1]; edge++) {
      data[edge * 3] = lean_unsigned_to_nat(vertex);
      data[edge * 3 + 1] = lean_unsigned_to_nat(targets[edge]);
      data[edge * 3 + 2] = lean_unsigned_to_nat(capacities[edge]);
    }
  lean_object *option = lean_dinic_prepare(lean_unsigned_to_nat(count),
    lean_unsigned_to_nat(source), lean_unsigned_to_nat(sink), edges);
  if (lean_is_scalar(option)) return 0;
  lean_object *prepared = lean_ctor_get(option, 0);
  lean_inc(prepared);
  lean_dec(option);
  return (uint32_t)(uintptr_t)prepared;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_dinic_run(uint32_t handle, uint32_t diagnostic,
    uint32_t *output, uint32_t capacity) {
  if (!runtime_ready || !handle || !output) return UINT32_MAX;
  lean_object *prepared = (lean_object *)(uintptr_t)handle;
  lean_inc(prepared);
  lean_object *result = diagnostic ? lean_dinic_solve_total(prepared) : lean_dinic_solve(prepared);
  size_t length = lean_array_size(result);
  if (length > capacity) { lean_dec(result); return UINT32_MAX; }
  for (size_t index = 0; index < length; index++)
    output[index] = lean_uint32_of_nat(lean_array_uget_borrowed(result, index));
  lean_dec(result);
  return (uint32_t)length;
}

EMSCRIPTEN_KEEPALIVE
void lean_dinic_release(uint32_t handle) {
  if (handle) lean_dec((lean_object *)(uintptr_t)handle);
}
