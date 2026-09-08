#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>

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
typedef struct {
  lean_object *offsets, *targets, *weights;
  uint32_t vertex_count, maximum_weight;
} prepared_graph;

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
  uint32_t *seen = calloc(vertex_count, sizeof(uint32_t));
  if (!seen) return 0;
  for (uint32_t vertex = 0; vertex < vertex_count; vertex += 1) {
    for (uint32_t index = offsets[vertex]; index < offsets[vertex + 1]; index += 1) {
      uint32_t target = targets[index];
      if (target >= vertex_count || seen[target] == vertex + 1) { free(seen); return 0; }
      seen[target] = vertex + 1;
      if (weights[index] > maximum) maximum = weights[index];
    }
  }
  free(seen);
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
  if (!runtime_ready || !validate_graph(vertex_count, offsets, offset_count, targets, weights,
      edge_count, &maximum_weight)) return 0;
  prepared_graph *graph = malloc(sizeof(prepared_graph));
  if (!graph) return 0;
  graph->offsets = make_nat_array(offsets, offset_count);
  graph->targets = make_nat_array(targets, edge_count);
  graph->weights = make_nat_array(weights, edge_count);
  graph->vertex_count = vertex_count;
  graph->maximum_weight = maximum_weight;
  return (uint32_t)(uintptr_t)graph;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_demo_solve_prepared(
    uint32_t handle,
    uint32_t start,
    uint32_t target,
    uint32_t *output,
    uint32_t output_capacity
) {
  prepared_graph *graph = (prepared_graph *)(uintptr_t)handle;
  if (!runtime_ready || !graph || !output ||
      start >= graph->vertex_count || target >= graph->vertex_count) return UINT32_MAX;
  lean_inc(graph->offsets);
  lean_inc(graph->targets);
  lean_inc(graph->weights);
  return copy_path(lean_dijkstra_solve_csr(
    graph->vertex_count,
    start,
    target,
    graph->maximum_weight,
    graph->offsets,
    graph->targets,
    graph->weights
  ), output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
void lean_demo_release_graph(uint32_t handle) {
  prepared_graph *graph = (prepared_graph *)(uintptr_t)handle;
  if (!graph) return;
  lean_dec(graph->offsets);
  lean_dec(graph->targets);
  lean_dec(graph->weights);
  free(graph);
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

  if (!runtime_ready || !output || start >= vertex_count || target >= vertex_count ||
      !validate_graph(vertex_count, offsets, offset_count, targets,
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
