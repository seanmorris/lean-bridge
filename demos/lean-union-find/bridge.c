#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_UnionFindCore(uint8_t builtin);
extern lean_object *lean_union_find_partition(uint32_t count, lean_object *links);
extern lean_object *lean_union_find_operations(uint32_t count, lean_object *operations);
extern void lean_initialize_runtime_module(void);

static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_union_find_runtime_init(void) {
  lean_object *result;
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_UnionFindCore(1);
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

static uint32_t copy_result(lean_object *result, uint32_t *output, uint32_t capacity) {
  uint32_t length = (uint32_t)lean_array_size(result);
  if (length > capacity) { lean_dec(result); return UINT32_MAX; }
  for (uint32_t index = 0; index < length; index += 1) {
    output[index] = (uint32_t)lean_unbox(lean_array_uget_borrowed(result, index));
  }
  lean_dec(result);
  return length;
}

static uint32_t links_valid(uint32_t count, const uint32_t *links, uint32_t length) {
  if ((length & 1u) != 0u || (length != 0u && !links)) return 0;
  for (uint32_t index = 0; index < length; index += 1) {
    if (links[index] >= count) return 0;
  }
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_union_find_solve(
    uint32_t count,
    const uint32_t *links,
    uint32_t link_words,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || !output || count > LEAN_MAX_SMALL_NAT) return UINT32_MAX;
  if (!links_valid(count, links, link_words)) return UINT32_MAX;
  return copy_result(lean_union_find_partition(count, make_nat_array(links, link_words)),
    output, output_capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_union_find_run_operations(
    uint32_t count,
    const uint32_t *operations,
    uint32_t operation_words,
    uint32_t *output,
    uint32_t output_capacity
) {
  if (!runtime_ready || !output || count > LEAN_MAX_SMALL_NAT) return UINT32_MAX;
  if (operation_words % 3u != 0u || (operation_words != 0u && !operations)) return UINT32_MAX;
  for (uint32_t index = 0; index < operation_words; index += 3) {
    if (operations[index] > 1u || operations[index + 1u] >= count ||
        operations[index + 2u] >= count) return UINT32_MAX;
  }
  return copy_result(lean_union_find_operations(count,
    make_nat_array(operations, operation_words)), output, output_capacity);
}
