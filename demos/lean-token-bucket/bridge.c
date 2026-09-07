#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_TokenBucketCore(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_token_bucket_empty(lean_object *capacity, lean_object *rate, lean_object *now);
extern lean_object *lean_token_bucket_step(lean_object *bucket, lean_object *now, lean_object *cost);
extern lean_object *lean_token_bucket_run(lean_object *bucket, lean_object *operations);
extern lean_object *lean_token_bucket_snapshot(lean_object *bucket);

typedef struct { lean_object *bucket; } bucket_handle;
typedef struct { lean_object *initial; lean_object *operations; uint32_t output_words; } bucket_trace;
static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_runtime_init(void) {
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_TokenBucketCore(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *nat_array(const uint32_t *input, uint32_t words) {
  lean_object *array = lean_alloc_array(words, words);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < words; index++) data[index] = lean_unsigned_to_nat(input[index]);
  return array;
}

static uint32_t copy_array(lean_object *array, uint32_t *output, uint32_t capacity) {
  size_t length = lean_array_size(array);
  if (length > capacity) return UINT32_MAX;
  for (size_t index = 0; index < length; index++)
    output[index] = lean_uint32_of_nat(lean_array_uget_borrowed(array, index));
  return (uint32_t)length;
}

/* The step consumes the old bucket; retain the next before dropping its result. */
static uint32_t accept_result(bucket_handle *handle, lean_object *result,
    uint32_t *output, uint32_t capacity) {
  handle->bucket = lean_ctor_get(result, 0);
  lean_inc(handle->bucket);
  uint32_t words = copy_array(lean_ctor_get(result, 1), output, capacity);
  lean_dec(result);
  return words;
}

static uint32_t trace_words(uint32_t words, uint32_t *output_words) {
  if (words % 2 || (uint64_t)(words / 2) * 7 > UINT32_MAX / 4) return 0;
  *output_words = words / 2 * 7;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_create(uint32_t capacity, uint32_t rate, uint32_t now) {
  if (!runtime_ready) return 0;
  bucket_handle *handle = malloc(sizeof(bucket_handle));
  if (!handle) return 0;
  handle->bucket = lean_token_bucket_empty(lean_unsigned_to_nat(capacity),
    lean_unsigned_to_nat(rate), lean_unsigned_to_nat(now));
  return (uint32_t)(uintptr_t)handle;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_request_c(uint32_t id, uint32_t now, uint32_t cost,
    uint32_t *output, uint32_t capacity) {
  bucket_handle *handle = (bucket_handle *)(uintptr_t)id;
  if (!runtime_ready || !handle || !output || capacity < 7) return UINT32_MAX;
  return accept_result(handle, lean_token_bucket_step(handle->bucket,
    lean_unsigned_to_nat(now), lean_unsigned_to_nat(cost)), output, capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_snapshot_c(uint32_t id, uint32_t *output, uint32_t capacity) {
  bucket_handle *handle = (bucket_handle *)(uintptr_t)id;
  if (!runtime_ready || !handle || !output || capacity < 2) return UINT32_MAX;
  lean_inc(handle->bucket);
  lean_object *result = lean_token_bucket_snapshot(handle->bucket);
  uint32_t words = copy_array(result, output, capacity);
  lean_dec(result);
  return words;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_run_c(uint32_t id, const uint32_t *input, uint32_t words,
    uint32_t *output, uint32_t capacity) {
  bucket_handle *handle = (bucket_handle *)(uintptr_t)id;
  uint32_t expected;
  if (!runtime_ready || !handle || !output || (words && !input) ||
      !trace_words(words, &expected) || expected > capacity) return UINT32_MAX;
  return accept_result(handle, lean_token_bucket_run(handle->bucket, nat_array(input, words)),
    output, capacity);
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_prepare_trace(uint32_t capacity, uint32_t rate, uint32_t now,
    const uint32_t *input, uint32_t words) {
  uint32_t expected;
  if (!runtime_ready || (words && !input) || !trace_words(words, &expected)) return 0;
  bucket_trace *trace = malloc(sizeof(bucket_trace));
  if (!trace) return 0;
  trace->initial = lean_token_bucket_empty(lean_unsigned_to_nat(capacity),
    lean_unsigned_to_nat(rate), lean_unsigned_to_nat(now));
  trace->operations = nat_array(input, words);
  trace->output_words = expected;
  return (uint32_t)(uintptr_t)trace;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_token_bucket_repeat_trace(uint32_t id, uint32_t *output, uint32_t capacity) {
  bucket_trace *trace = (bucket_trace *)(uintptr_t)id;
  if (!runtime_ready || !trace || !output || capacity < trace->output_words) return UINT32_MAX;
  lean_inc(trace->initial);
  lean_inc(trace->operations);
  lean_object *result = lean_token_bucket_run(trace->initial, trace->operations);
  uint32_t words = copy_array(lean_ctor_get(result, 1), output, capacity);
  lean_dec(result);
  return words;
}

EMSCRIPTEN_KEEPALIVE
void lean_token_bucket_release_trace(uint32_t id) {
  bucket_trace *trace = (bucket_trace *)(uintptr_t)id;
  if (!trace) return;
  lean_dec(trace->initial);
  lean_dec(trace->operations);
  free(trace);
}

EMSCRIPTEN_KEEPALIVE
void lean_token_bucket_release(uint32_t id) {
  bucket_handle *handle = (bucket_handle *)(uintptr_t)id;
  if (!handle) return;
  lean_dec(handle->bucket);
  free(handle);
}
