#include <emscripten/emscripten.h>
#include <lean/lean.h>
#include <stdint.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern lean_object *initialize_TutteCore(uint8_t builtin);
extern void lean_initialize_runtime_module(void);
extern lean_object *lean_tutte_check(lean_object *, lean_object *, lean_object *, lean_object *);
static uint8_t ready = 0;

EMSCRIPTEN_KEEPALIVE
uint32_t tutte_init(void) {
  if (ready) return 1;
  lean_initialize_runtime_module();
  lean_object *result = initialize_Init(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  result = initialize_TutteCore(1);
  if (lean_io_result_is_error(result)) { lean_dec(result); return 0; }
  lean_dec(result);
  lean_io_mark_end_initialization();
  ready = 1;
  return 1;
}

static lean_object *nat_array(const uint32_t *words, uint32_t count) {
  lean_object *result = lean_alloc_array(count, count);
  for (uint32_t i = 0; i < count; i++) lean_array_cptr(result)[i] = lean_unsigned_to_nat(words[i]);
  return result;
}

EMSCRIPTEN_KEEPALIVE
uint32_t tutte_verify(uint32_t width, uint32_t height, const uint32_t *levels, uint32_t nodes,
    const uint32_t *squares, uint32_t words, uint32_t *output) {
  if (!ready || !levels || !squares || !output || !width || !height || width > 256 || height > 256 ||
      nodes < 2 || nodes > 26 || !words || words % 5 || words > 60) return 0;
  lean_object *result = lean_tutte_check(lean_unsigned_to_nat(width), lean_unsigned_to_nat(height),
    nat_array(levels, nodes), nat_array(squares, words));
  size_t length = lean_array_size(result);
  if (length != 5 + 2 * nodes) { lean_dec(result); return 0; }
  for (size_t i = 0; i < length; i++) output[i] = lean_uint32_of_nat(lean_array_uget_borrowed(result, i));
  lean_dec(result);
  return (uint32_t)length;
}
