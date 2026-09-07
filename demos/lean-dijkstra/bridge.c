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
static lean_object *prepared_offsets = NULL;
static lean_object *prepared_targets = NULL;
static lean_object *prepared_weights = NULL;
static uint32_t prepared_vertex_count = 0;
static uint32_t prepared_maximum_weight = 0;
static uint32_t prepared_revision = 0;

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

static uint32_t validate_graph(
    uint32_t vertex_count,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    const uint32_t *weights,
    uint32_t edge_count,
    uint32_t *maximum_weight
) {
  uint32_t maximum = 0;
  if (!offsets || !targets || !weights || vertex_count == 0 ||
      vertex_count > LEAN_MAX_SMALL_NAT || offset_count != vertex_count + 1u) return 0;
  if (offsets[0] != 0 || offsets[vertex_count] != edge_count) return 0;
  for (uint32_t index = 0; index < vertex_count; index += 1) {
    if (offsets[index] > offsets[index + 1u] || offsets[index + 1u] > edge_count) return 0;
  }
  for (uint32_t index = 0; index < edge_count; index += 1) {
    if (targets[index] >= vertex_count) return 0;
    if (weights[index] > maximum) maximum = weights[index];
  }
  *maximum_weight = maximum;
  return 1;
}

static uint32_t copy_path(lean_object *path, uint32_t *output, uint32_t output_capacity) {
  uint32_t length = (uint32_t)lean_array_size(path);
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

EMSCRIPTEN_KEEPALIVE
uint32_t lean_demo_prepare_graph(
    uint32_t vertex_count,
    const uint32_t *offsets,
    uint32_t offset_count,
    const uint32_t *targets,
    const uint32_t *weights,
    uint32_t edge_count
) {
  uint32_t maximum_weight;
  lean_object *next_offsets;
  lean_object *next_targets;
  lean_object *next_weights;
  if (!runtime_ready || !validate_graph(vertex_count, offsets, offset_count, targets, weights,
      edge_count, &maximum_weight)) return 0;
  next_offsets = make_nat_array(offsets, offset_count);
  next_targets = make_nat_array(targets, edge_count);
  next_weights = make_nat_array(weights, edge_count);
  if (prepared_offsets) lean_dec(prepared_offsets);
  if (prepared_targets) lean_dec(prepared_targets);
  if (prepared_weights) lean_dec(prepared_weights);
  prepared_offsets = next_offsets;
  prepared_targets = next_targets;
  prepared_weights = next_weights;
  prepared_vertex_count = vertex_count;
  prepared_maximum_weight = maximum_weight;
  prepared_revision += 1;
  if (prepared_revision == 0) prepared_revision = 1;
  return prepared_revision;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_demo_solve_prepared(
    uint32_t revision,
    uint32_t start,
    uint32_t target,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || revision == 0 || revision != prepared_revision || !output ||
      start >= prepared_vertex_count || target >= prepared_vertex_count) return UINT32_MAX;
  lean_inc(prepared_offsets);
  lean_inc(prepared_targets);
  lean_inc(prepared_weights);
  return copy_path(lean_dijkstra_solve_csr(
    prepared_vertex_count,
    start,
    target,
    prepared_maximum_weight,
    prepared_offsets,
    prepared_targets,
    prepared_weights
  ), output, output_capacity);
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
  uint32_t maximum_weight = 0;
  lean_object *lean_offsets;
  lean_object *lean_targets;
  lean_object *lean_weights;

  if (!runtime_ready || !output || !validate_graph(vertex_count, offsets, offset_count, targets,
      weights, edge_count, &maximum_weight)) return UINT32_MAX;

  lean_offsets = make_nat_array(offsets, offset_count);
  lean_targets = make_nat_array(targets, edge_count);
  lean_weights = make_nat_array(weights, edge_count);

  path = lean_dijkstra_solve_csr(
    vertex_count,
    start,
    target,
    maximum_weight,
    lean_offsets,
    lean_targets,
    lean_weights
  );
  return copy_path(path, output, output_capacity);
}
