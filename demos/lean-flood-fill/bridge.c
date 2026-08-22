#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_FloodFillCore(uint8_t builtin);
extern lean_object *lean_flood_fill_solve_csr(
    uint32_t vertex_count,
    uint32_t start,
    lean_object *offsets,
    lean_object *targets,
    lean_object *enabled,
    lean_object *allowed
);
extern lean_object *lean_capability_closure_solve_csr(
    uint32_t vertex_count,
    uint32_t capability_count,
    uint32_t start,
    lean_object *offsets,
    lean_object *targets,
    lean_object *requirements,
    lean_object *allowed,
    lean_object *grants,
    lean_object *initial_capabilities
);
extern void lean_initialize_runtime_module(void);

static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_flood_runtime_init(void) {
  lean_object *result;
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) {
    lean_dec(result);
    return 0;
  }
  lean_dec(result);
  result = initialize_FloodFillCore(1);
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

static uint32_t validate_csr(
    uint32_t vertex_count,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    uint32_t edge_count
) {
  if (vertex_count == 0 || vertex_count > LEAN_MAX_SMALL_NAT || !offsets || !targets) return 0;
  if (offset_count != vertex_count + 1u || offsets[0] != 0 || offsets[vertex_count] != edge_count) {
    return 0;
  }
  for (uint32_t index = 0; index < vertex_count; index += 1) {
    if (offsets[index] > offsets[index + 1u] || offsets[index + 1u] > edge_count) return 0;
  }
  for (uint32_t index = 0; index < edge_count; index += 1) {
    if (targets[index] >= vertex_count) return 0;
  }
  return 1;
}

static uint32_t copy_result(lean_object *result, uint32_t *output, uint32_t capacity) {
  uint32_t length = (uint32_t)lean_array_size(result);
  if (length > capacity) {
    lean_dec(result);
    return UINT32_MAX;
  }
  for (uint32_t index = 0; index < length; index += 1) {
    output[index] = (uint32_t)lean_unbox(lean_array_uget_borrowed(result, index));
  }
  lean_dec(result);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_flood_solve(
    uint32_t vertex_count,
    uint32_t start,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    const uint32_t *enabled,
    uint32_t edge_count,
    const uint32_t *allowed,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || !enabled || !allowed || !output || start >= vertex_count) return UINT32_MAX;
  if (!validate_csr(vertex_count, offsets, offset_count, targets, edge_count)) return UINT32_MAX;
  return copy_result(lean_flood_fill_solve_csr(
    vertex_count,
    start,
    make_nat_array(offsets, offset_count),
    make_nat_array(targets, edge_count),
    make_nat_array(enabled, edge_count),
    make_nat_array(allowed, vertex_count)
  ), output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_capability_solve(
    uint32_t vertex_count,
    uint32_t capability_count,
    uint32_t start,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    const uint32_t *requirements,
    uint32_t edge_count,
    const uint32_t *allowed,
    const uint32_t *grants,
    const uint32_t *initial_capabilities,
    uint32_t initial_count,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || !requirements || !allowed || !grants || !output || start >= vertex_count) {
    return UINT32_MAX;
  }
  if (!validate_csr(vertex_count, offsets, offset_count, targets, edge_count)) return UINT32_MAX;
  for (uint32_t index = 0; index < edge_count; index += 1) {
    if (requirements[index] > capability_count) return UINT32_MAX;
  }
  for (uint32_t index = 0; index < vertex_count; index += 1) {
    if (grants[index] > capability_count) return UINT32_MAX;
  }
  for (uint32_t index = 0; index < initial_count; index += 1) {
    if (initial_capabilities[index] >= capability_count) return UINT32_MAX;
  }
  return copy_result(lean_capability_closure_solve_csr(
    vertex_count,
    capability_count,
    start,
    make_nat_array(offsets, offset_count),
    make_nat_array(targets, edge_count),
    make_nat_array(requirements, edge_count),
    make_nat_array(allowed, vertex_count),
    make_nat_array(grants, vertex_count),
    make_nat_array(initial_capabilities, initial_count)
  ), output, output_capacity);
}
