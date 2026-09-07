#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_TopologicalSort(uint8_t builtin);
extern lean_object *lean_topological_sort_solve(uint32_t count, lean_object *edges);
extern lean_object *lean_topological_sort_total(uint32_t count, lean_object *edges);
extern void lean_initialize_runtime_module(void);

static uint8_t runtime_ready = 0;

typedef struct {
  lean_object *edges;
  uint32_t count;
} prepared_graph;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_topological_sort_runtime_init(void) {
  lean_object *result;
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_TopologicalSort(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
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

static uint32_t edges_valid(uint32_t count, const uint32_t *edges, uint32_t length) {
  if (count > LEAN_MAX_SMALL_NAT || (length & 1u) != 0u || (length && !edges)) return 0;
  for (uint32_t index = 0; index < length; index += 1) {
    if (edges[index] >= count) return 0;
  }
  return 1;
}

static uint32_t copy_result(lean_object *result, uint32_t *output, uint32_t capacity) {
  uint32_t length = (uint32_t)lean_array_size(result);
  if (length > capacity) { lean_dec(result); return UINT32_MAX; }
  for (uint32_t index = 0; index < length; index += 1) {
    output[index] = (uint32_t)lean_unbox(lean_array_uget_borrowed(result, index));
  }
  lean_dec(result);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_topological_sort_run(
    uint32_t count,
    const uint32_t *edges,
    uint32_t edge_words,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || !output || !edges_valid(count, edges, edge_words)) return UINT32_MAX;
  return copy_result(lean_topological_sort_solve(count, make_nat_array(edges, edge_words)),
    output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_topological_sort_run_total(
    uint32_t count, const uint32_t *edges, uint32_t edge_words,
    uint32_t *output, uint32_t output_capacity
) {
  if (!runtime_ready || !output || !edges_valid(count, edges, edge_words)) return UINT32_MAX;
  return copy_result(lean_topological_sort_total(count, make_nat_array(edges, edge_words)),
    output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_topological_sort_prepare(
    uint32_t count,
    const uint32_t *edges,
    uint32_t edge_words
) {
  if (!runtime_ready || !edges_valid(count, edges, edge_words)) return 0;
  prepared_graph *graph = malloc(sizeof(prepared_graph));
  if (!graph) return 0;
  graph->edges = make_nat_array(edges, edge_words);
  graph->count = count;
  return (uint32_t)(uintptr_t)graph;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_topological_sort_run_prepared(
    uint32_t handle, uint32_t *output, uint32_t output_capacity
) {
  if (!runtime_ready || !handle || !output) return UINT32_MAX;
  prepared_graph *graph = (prepared_graph *)(uintptr_t)handle;
  lean_inc(graph->edges);
  return copy_result(lean_topological_sort_solve(graph->count, graph->edges),
    output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
void lean_topological_sort_release(uint32_t handle) {
  if (!handle) return;
  prepared_graph *graph = (prepared_graph *)(uintptr_t)handle;
  lean_dec(graph->edges);
  free(graph);
}
