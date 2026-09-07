#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_AhoCorasickCore(uint8_t builtin);
extern lean_object *lean_aho_corasick_compile(lean_object *offsets, lean_object *tokens);
extern uint32_t lean_aho_corasick_machine_valid(lean_object *machine);
extern lean_object *lean_aho_corasick_scan(lean_object *machine, lean_object *input);
extern void lean_initialize_runtime_module(void);

static uint8_t runtime_ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t lean_aho_runtime_init(void) {
  lean_object *result;
  if (runtime_ready) return 1;
  lean_initialize_runtime_module();
  result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_AhoCorasickCore(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  runtime_ready = 1;
  return 1;
}

static lean_object *make_nat_array(const uint32_t *values, uint32_t length) {
  lean_object *array = lean_alloc_array(length, length);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < length; index += 1) data[index] = lean_unsigned_to_nat(values[index]);
  return array;
}

static lean_object *make_byte_nat_array(const uint8_t *values, uint32_t length) {
  lean_object *array = lean_alloc_array(length, length);
  lean_object **data = lean_array_cptr(array);
  for (uint32_t index = 0; index < length; index += 1) data[index] = lean_unsigned_to_nat(values[index]);
  return array;
}

static uint32_t patterns_valid(const uint32_t *offsets, uint32_t offset_words,
    const uint8_t *tokens, uint32_t token_words) {
  if (!offsets || offset_words < 2 || (token_words && !tokens) || offsets[0] != 0 ||
      offsets[offset_words - 1] != token_words) return 0;
  for (uint32_t index = 1; index < offset_words; index += 1)
    if (offsets[index] <= offsets[index - 1] || offsets[index] > token_words) return 0;
  return 1;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_aho_prepare(const uint32_t *offsets, uint32_t offset_words,
    const uint8_t *tokens, uint32_t token_words) {
  if (!runtime_ready || !patterns_valid(offsets, offset_words, tokens, token_words)) return 0;
  lean_object *machine = lean_aho_corasick_compile(
    make_nat_array(offsets, offset_words), make_byte_nat_array(tokens, token_words));
  lean_inc(machine);
  if (lean_aho_corasick_machine_valid(machine) != 1) { lean_dec(machine); return 0; }
  return (uint32_t)(uintptr_t)machine;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lean_aho_scan(uint32_t machine_handle, const uint8_t *input, uint32_t input_words,
    uint32_t *output, uint32_t output_capacity) {
  lean_object *machine = (lean_object *)(uintptr_t)machine_handle;
  if (!runtime_ready || !machine || (input_words && !input) || !output) return UINT32_MAX;
  lean_inc(machine);
  lean_object *result = lean_aho_corasick_scan(machine, make_byte_nat_array(input, input_words));
  uint32_t length = (uint32_t)lean_array_size(result);
  if (length > output_capacity) { lean_dec(result); return UINT32_MAX; }
  for (uint32_t index = 0; index < length; index += 1)
    output[index] = (uint32_t)lean_unbox(lean_array_uget_borrowed(result, index));
  lean_dec(result);
  return length;
}

EMSCRIPTEN_KEEPALIVE
void lean_aho_release(uint32_t machine_handle) {
  lean_object *machine = (lean_object *)(uintptr_t)machine_handle;
  if (machine) lean_dec(machine);
}
