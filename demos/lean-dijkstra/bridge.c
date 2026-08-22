#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_DijkstraCore(uint8_t builtin);
extern lean_object *lean_dijkstra_solve_csr(
    uint32_t vertex_count,
    uint32_t start,
    uint32_t target,
    uint32_t maximum_weight,
    lean_object *offsets,
    lean_object *targets,
    lean_object *weights
);
extern void lean_initialize_runtime_module(void);

static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_demo_runtime_init(void) {
  lean_object *result;
  if (runtime_ready) return 1;

  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    return 0;
  }
  lean_dec(result);

  result = initialize_DijkstraCore(1);
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    return 0;
  }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *make_nat_array(const uint32_t *values, uint32_t length) {
  lean_object *array = lean_alloc_array(length, length);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < length; index += 1) {
    data[index] = lean_unsigned_to_nat(values[index]);
  }
  return array;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_demo_solve(
    uint32_t vertex_count,
    uint32_t start,
    uint32_t target,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    const uint32_t *weights,
    uint32_t edge_count,
    uint32_t *output,
    uint32_t output_capacity
) {
  lean_object *path;
  uint32_t length;
  uint32_t index;
  uint32_t maximum_weight = 0;

  if (!runtime_ready || !offsets || !targets || !weights || !output) return UINT32_MAX;
  if (vertex_count == 0 || vertex_count > LEAN_MAX_SMALL_NAT ||
      offset_count != vertex_count + 1u) {
    return UINT32_MAX;
  }
  if (offsets[0] != 0 || offsets[vertex_count] != edge_count) return UINT32_MAX;
  for (index = 0; index < vertex_count; index += 1) {
    if (offsets[index] > offsets[index + 1u] || offsets[index + 1u] > edge_count) {
      return UINT32_MAX;
    }
  }
  for (index = 0; index < edge_count; index += 1) {
    if (targets[index] >= vertex_count) return UINT32_MAX;
    if (weights[index] > maximum_weight) maximum_weight = weights[index];
  }

  path = lean_dijkstra_solve_csr(
    vertex_count,
    start,
    target,
    maximum_weight,
    make_nat_array(offsets, offset_count),
    make_nat_array(targets, edge_count),
    make_nat_array(weights, edge_count)
  );
  length = (uint32_t)lean_array_size(path);
  if (length > output_capacity) {
    lean_dec(path);
    return UINT32_MAX;
  }
  for (uint32_t index = 0; index < length; index += 1) {
    output[index] = (uint32_t)lean_unbox(lean_array_uget_borrowed(path, index));
  }
  lean_dec(path);
  return length;
}
