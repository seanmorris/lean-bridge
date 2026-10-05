#include <assert.h>
#include <math.h>
#include <stdlib.h>

static unsigned mode, calls, live, clears;
static void release(void *owner) { assert(live); --live; ++clears; free(owner); }
void graph_fixture_reset(unsigned value) { assert(!live); mode = value; calls = 0; clears = 0; }
unsigned graph_fixture_calls(void) { return calls; }
unsigned graph_fixture_live(void) { return live; }
unsigned graph_fixture_clears(void) { return clears; }

uint32_t graph_fixture_scalars(const recursive_scalars_t *input, recursive_scalars_t *out) {
  (void)input; ++calls;
  static const uint32_t magnitude[32] = { [0] = 7, [31] = 256 };
  static const char text[] = { 'a', 0, (char)0xf0, (char)0x9f, (char)0x8c, (char)0xbf };
  static const uint8_t bytes[] = { 0, 255, 128 };
  recursive_scalars_t_init(out);
  out->_bridge_owner = malloc(1); if (!out->_bridge_owner) return 3;
  out->_bridge_release = release; ++live;
  out->unit = 0; out->bool_ = true;
  out->u8 = UINT8_MAX; out->u16 = UINT16_MAX; out->u32 = UINT32_MAX; out->u64 = UINT64_MAX;
  out->i8 = INT8_MIN; out->i16 = INT16_MIN; out->i32 = INT32_MIN; out->i64 = INT64_MIN;
  out->word = UINT64_MAX; out->signed_word = INT64_MIN;
  out->natural.data = magnitude; out->natural.length = 32;
  out->integer.data = magnitude; out->integer.length = 32; out->integer.negative = true;
  out->f32 = INFINITY; out->f64 = -0.0;
  out->text.data = text; out->text.length = sizeof(text);
  out->bytes.data = bytes; out->bytes.length = sizeof(bytes); out->char_ = 0x1f33f;
  if (mode >= 100) return mode - 100;
  uint8_t invalid = 2;
  if (mode == 2) memcpy(&out->bool_, &invalid, 1);
  if (mode == 3) out->char_ = 0xd800;
  if (mode == 4) { out->text.data = "\xc0\xaf"; out->text.length = 2; }
  if (mode == 5) memcpy(&out->integer.negative, &invalid, 1);
  if (mode == 6) out->text.data = NULL;
  if (mode == 7) out->unit = 1;
  if (mode == 8) out->natural.data = (const uint32_t *)(uintptr_t)1;
  if (mode == 9) out->bytes.length = SIZE_MAX;
  return 0;
}

#define ECHO(name, type) \
uint32_t graph_fixture_##name(const type *input, type *out) { \
  ++calls; *out = *input; \
  out->_bridge_owner = malloc(1); if (!out->_bridge_owner) return 3; \
  out->_bridge_release = release; ++live; return 0; \
}
ECHO(tree, recursive_tree_t)
ECHO(spine, recursive_spine_t)
ECHO(marker, recursive_marker_t)
ECHO(link, recursive_link_t)
ECHO(result_link, recursive_result_link_t)

uint32_t graph_fixture_bad_tree(const recursive_tree_t *input, recursive_tree_t *out) {
  uint32_t status = graph_fixture_tree(input, out); if (status) return status;
  out->kind = UINT32_MAX; return 0;
}
uint32_t graph_fixture_envelope(const recursive_envelope_t *input, recursive_envelope_t *out) {
  ++calls; *out = *input;
  out->_bridge_owner = malloc(sizeof(*out->outcome)); if (!out->_bridge_owner) return 3;
  out->_bridge_release = release; ++live;
  memcpy(out->_bridge_owner, input->outcome, sizeof(*out->outcome));
  out->outcome = out->_bridge_owner;
  if (mode == 12) out->fallback.has_value = 2;
  if (mode == 13) {
    /* The result payload is a private owned copy, never an input mutation. */
    uint8_t invalid = 2;
    memcpy((uint8_t *)out->_bridge_owner + offsetof(__typeof__(*out->outcome), is_ok), &invalid, 1);
  }
  return 0;
}
