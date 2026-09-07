#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_LruCore(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_lru_empty(lean_object *capacity);
extern lean_object *lean_lru_get(lean_object *cache, lean_object *key);
extern lean_object *lean_lru_put(lean_object *cache, lean_object *key, lean_object *value);
extern lean_object *lean_lru_snapshot(lean_object *cache);
extern lean_object *lean_lru_run(lean_object *cache, lean_object *operations);
extern lean_object *lean_lru_batch(lean_object *capacity, lean_object *operations);

typedef struct { lean_object *cache; uint32_t capacity; } lru_handle;
typedef struct { lean_object *operations; uint32_t capacity; } lru_trace;
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_LruCore(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *nat_array(const uint32_t *values, uint32_t length) {
  lean_object *array = lean_alloc_array(length, length);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t i = 0; i < length; i++) data[i] = lean_unsigned_to_nat(values[i]);
  return array;
}

static uint32_t copy_array(lean_object *array, uint32_t *output) {
  uint32_t length = (uint32_t)lean_array_size(array);
  for (uint32_t i = 0; i < length; i++)
    output[i] = lean_uint32_of_nat(lean_array_uget_borrowed(array, i));
  return length;
}

/* Take ownership of the next cache before releasing the result constructor. */
static uint32_t accept_result(lru_handle *handle, lean_object *result, uint32_t *output) {
  handle->cache = lean_ctor_get(result, 0);
  lean_inc(handle->cache);
  uint32_t length = copy_array(lean_ctor_get(result, 1), output);
  lean_dec(result);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_create(uint32_t capacity) {
  if (!runtime_ready) return 0;
  lru_handle *handle = malloc(sizeof(lru_handle));
  if (!handle) return 0;
  handle->capacity = capacity;
  handle->cache = lean_lru_empty(lean_unsigned_to_nat(capacity));
  return (uint32_t)(uintptr_t)handle;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_access(uint32_t id, uint32_t kind, uint32_t key, uint32_t value,
    uint32_t *output) {
  lru_handle *handle = (lru_handle *)(uintptr_t)id;
  if (!handle || !output || kind > 1) return UINT32_MAX;
  lean_object *result = kind == 0
    ? lean_lru_get(handle->cache, lean_unsigned_to_nat(key))
    : lean_lru_put(handle->cache, lean_unsigned_to_nat(key), lean_unsigned_to_nat(value));
  return accept_result(handle, result, output);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_entries(uint32_t id, uint32_t *output) {
  lru_handle *handle = (lru_handle *)(uintptr_t)id;
  if (!handle || !output) return UINT32_MAX;
  lean_inc(handle->cache);
  lean_object *array = lean_lru_snapshot(handle->cache);
  uint32_t length = copy_array(array, output);
  lean_dec(array);
  return length;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_trace(uint32_t id, const uint32_t *input, uint32_t words,
    uint32_t *output) {
  lru_handle *handle = (lru_handle *)(uintptr_t)id;
  if (!handle || !output || words % 3 || (words && !input)) return UINT32_MAX;
  for (uint32_t i = 0; i < words; i += 3) if (input[i] > 1) return UINT32_MAX;
  return accept_result(handle, lean_lru_run(handle->cache, nat_array(input, words)), output);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_prepare_trace(uint32_t capacity, const uint32_t *input, uint32_t words) {
  if (!runtime_ready || words % 3 || (words && !input)) return 0;
  for (uint32_t i = 0; i < words; i += 3) if (input[i] > 1) return 0;
  lru_trace *trace = malloc(sizeof(lru_trace));
  if (!trace) return 0;
  trace->capacity = capacity;
  trace->operations = nat_array(input, words);
  return (uint32_t)(uintptr_t)trace;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_lru_repeat_trace(uint32_t id, uint32_t *output) {
  lru_trace *trace = (lru_trace *)(uintptr_t)id;
  if (!trace || !output) return UINT32_MAX;
  lean_inc(trace->operations);
  lean_object *array = lean_lru_batch(lean_unsigned_to_nat(trace->capacity), trace->operations);
  uint32_t length = copy_array(array, output);
  lean_dec(array);
  return length;
}

EMSCRIPTEN_KEEPALIVE
void lean_lru_destroy_trace(uint32_t id) {
  lru_trace *trace = (lru_trace *)(uintptr_t)id;
  if (!trace) return;
  lean_dec(trace->operations);
  free(trace);
}

EMSCRIPTEN_KEEPALIVE
void lean_lru_destroy(uint32_t id) {
  lru_handle *handle = (lru_handle *)(uintptr_t)id;
  if (!handle) return;
  lean_dec(handle->cache);
  free(handle);
}
