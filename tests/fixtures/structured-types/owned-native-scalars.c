/* Authored field values, checked independently by Lean's inspect and makePacket. */
#include <lean/lean.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks, attempts, fail_at, live, failures;
#define CHECK(condition) do { ++checks; if (!(condition)) { \
  fprintf(stderr, "scalar check failed at %s:%d: %s\n", __FILE__, __LINE__, #condition); abort(); \
} } while (0)
static void *allocate(size_t bytes) {
  if (++attempts == fail_at) return NULL;
  void *value = calloc(1, bytes); if (value) ++live; return value;
}
static void release(void *value) { if (value) { CHECK(live > 0); --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE release
#include "owned-values-codec.h"
#include "scalar-bindings.h"
extern lean_object *COMPONENT_INITIALIZER(uint8_t);
static void *initialize_component(uint8_t builtin) { return COMPONENT_INITIALIZER(builtin); }

static const uint32_t magnitude[] = {1, 0, 0, 0, 1};
static const char text[] = {'A', 0, (char)0xf0, (char)0x9f, (char)0x8c, (char)0xb1};
static const uint8_t bytes[] = {0, 255, 1};
static Scalars input_scalars(void) {
  return (Scalars){ .S_unit = 0, .S_flag = 1, .S_char = 0x1f331,
    .S_natural = { magnitude, 5 }, .S_integer = { magnitude, 5, 1 },
    .S_u8 = UINT8_MAX, .S_u16 = UINT16_MAX, .S_u32 = UINT32_MAX, .S_u64 = UINT64_MAX,
    .S_i8 = INT8_MIN, .S_i16 = INT16_MIN, .S_i32 = INT32_MIN, .S_i64 = INT64_MIN,
    .S_word = UINT64_MAX, .S_signedWord = INT64_MIN, .S_f32 = 1.5f, .S_f64 = -2.25,
    .S_text = { text, sizeof(text) }, .S_bytes = { bytes, sizeof(bytes) } };
}
static void inspect(lb_owned_context *context, const Packet *value) {
  uint8_t correct = 0; ov_result_owner owner = {0};
  CHECK(V_inspect(context, value, &correct, &owner) == LB_OWNED_OK);
  CHECK(correct == 1 && ov_owner_empty(&owner));
  const Scalars *p = value->P_scalars;
  CHECK(p->S_unit == 0 && p->S_flag == 1 && p->S_char == 0x1f331);
  CHECK(p->S_u8 == UINT8_MAX && p->S_u16 == UINT16_MAX && p->S_u32 == UINT32_MAX && p->S_u64 == UINT64_MAX);
  CHECK(p->S_i8 == INT8_MIN && p->S_i16 == INT16_MIN && p->S_i32 == INT32_MIN && p->S_i64 == INT64_MIN);
  CHECK(p->S_word == UINT64_MAX && p->S_signedWord == INT64_MIN && p->S_f32 == 1.5f && p->S_f64 == -2.25);
  CHECK(p->S_natural.length == 5 && memcmp(p->S_natural.data, magnitude, sizeof(magnitude)) == 0);
  CHECK(p->S_integer.length == 5 && p->S_integer.negative == 1 && memcmp(p->S_integer.data, magnitude, sizeof(magnitude)) == 0);
  CHECK(p->S_text.length == sizeof(text) && memcmp(p->S_text.data, text, sizeof(text)) == 0);
  CHECK(p->S_bytes.length == sizeof(bytes) && memcmp(p->S_bytes.data, bytes, sizeof(bytes)) == 0);
}
static void rejected(lb_owned_context *context, Packet input, int expected) {
  Packet output = { .P_ticket = { UINT64_MAX } }; ov_result_owner owner = {0}; size_t baseline = live;
  CHECK(V_echo(context, &input, &output, &owner) == expected);
  CHECK(output.P_ticket.token == UINT64_MAX && ov_owner_empty(&owner) && live == baseline && !context->scopes);
}

int main(void) {
  CHECK(lean_bridge_native_component_initialize(COMPONENT_ID, initialize_component));
  if (getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { puts("{\"cold\":true}"); return 0; }
  if (getenv("LEAN_BRIDGE_OWNED_LEAN_ONLY")) {
    unsigned count = (unsigned)strtoul(getenv("LEAN_BRIDGE_OWNED_LEAN_ONLY"), NULL, 10);
    for (unsigned i = 0; i < count; ++i) {
      lean_object *resource = C_newTicket(ov_carry(lean_box(42)), ov_carry(lean_mk_string("ticket")));
      lean_object *packet = C_makePacket(resource);
      lean_object *correct = C_inspect(packet);
      CHECK(ov_carrier(correct) && lean_unbox(lean_array_get_core(correct, 0)) == 1); lean_dec(correct);
    }
    CHECK(attempts == 0 && live == 0);
    puts("{\"direct\":true}"); return 0;
  }
  lb_owned_context context = {0}; ov_result_owner ticket_owner = {0}, owner = {0};
  CHECK(lb_owned_context_init(&context, COMPONENT_ID) == LB_OWNED_OK);
  uint32_t serial = 42; Nat number = { &serial, 1 }; Text label = { "ticket", 6 }; Ticket ticket = {0};
  CHECK(V_newTicket(&context, &number, &label, &ticket, &ticket_owner) == LB_OWNED_OK);
  Scalars p = input_scalars(); Empty empty = {0}; InnerOption inner = { 1, 0 }; OuterOption outer = { 1, &inner };
  Packet input = { ticket, &p, &outer, &empty }, output = {0}; inspect(&context, &input);
  CHECK(V_echo(&context, &input, &output, &owner) == LB_OWNED_OK); inspect(&context, &output);
  CHECK(output.P_ticket.token == ticket.token && output.P_scalars != &p && output.P_empty != &empty);
  CHECK(output.P_scalars->S_natural.data != magnitude && output.P_scalars->S_text.data != text);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  CHECK(V_makePacket(&context, &ticket, &output, &owner) == LB_OWNED_OK); inspect(&context, &output);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  for (uint8_t branch = 0; branch < 3; ++branch) {
    outer.tag = branch != 0; inner.tag = branch == 2;
    CHECK(V_echo(&context, &input, &output, &owner) == LB_OWNED_OK);
    uint8_t actual = 99; ov_result_owner temporary = {0};
    CHECK(V_optionCase(&context, &output, &actual, &temporary) == LB_OWNED_OK);
    CHECK(actual == branch && ov_owner_empty(&temporary)); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  }
  const uint32_t float_bits[] = {0, 0x80000000u, 0x7f800000u, 0xff800000u, 0x7fc12345u};
  const uint64_t double_bits[] = {0, UINT64_C(0x8000000000000000), UINT64_C(0x7ff0000000000000), UINT64_C(0xfff0000000000000), UINT64_C(0x7ff8123456789abc)};
  for (size_t i = 0; i < 5; ++i) {
    memcpy(&p.S_f32, &float_bits[i], sizeof(p.S_f32)); memcpy(&p.S_f64, &double_bits[i], sizeof(p.S_f64));
    uint32_t actual32 = 0; uint64_t actual64 = 0;
    /* Lean 4.32.2 toBits canonicalizes NaNs. Echo below still checks raw payloads. */
    uint32_t expected32 = i == 4 ? UINT32_C(0x7fc00000) : float_bits[i];
    uint64_t expected64 = i == 4 ? UINT64_C(0x7ff8000000000000) : double_bits[i];
    CHECK(lean_float32_to_bits(p.S_f32) == expected32 && lean_float_to_bits(p.S_f64) == expected64);
    CHECK(V_bits32(&context, &input, &actual32, &owner) == LB_OWNED_OK);
    CHECK(actual32 == expected32);
    CHECK(V_bits64(&context, &input, &actual64, &owner) == LB_OWNED_OK); CHECK(actual64 == expected64);
    CHECK(V_echo(&context, &input, &output, &owner) == LB_OWNED_OK);
    CHECK(memcmp(&output.P_scalars->S_f32, &float_bits[i], 4) == 0);
    CHECK(memcmp(&output.P_scalars->S_f64, &double_bits[i], 8) == 0); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  }
  p = (Scalars){0}; p.S_integer.negative = 1;
  CHECK(V_echo(&context, &input, &output, &owner) == LB_OWNED_OK);
  CHECK(output.P_scalars->S_natural.length == 0 && output.P_scalars->S_integer.length == 0 && !output.P_scalars->S_integer.negative);
  CHECK(output.P_scalars->S_text.length == 0 && output.P_scalars->S_bytes.length == 0);
  CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  p = input_scalars(); p.S_unit = 1; rejected(&context, input, LB_OWNED_INVALID);
  p = input_scalars(); p.S_flag = 2; rejected(&context, input, LB_OWNED_INVALID);
  p = input_scalars(); p.S_char = 0xd800; rejected(&context, input, LB_OWNED_INVALID);
  p.S_char = 0x110000; rejected(&context, input, LB_OWNED_INVALID);
  p = input_scalars(); p.S_integer.negative = 2; rejected(&context, input, LB_OWNED_INVALID);
  p = input_scalars(); p.S_natural.length = SIZE_MAX; rejected(&context, input, LB_OWNED_LIMIT);
  p = input_scalars(); p.S_bytes.length = SIZE_MAX; rejected(&context, input, LB_OWNED_LIMIT);
  p = input_scalars(); p.S_natural.data = (const uint32_t *)((const uint8_t *)magnitude + 1); rejected(&context, input, LB_OWNED_INVALID);
  p = input_scalars(); p.S_bytes.data = NULL; rejected(&context, input, LB_OWNED_INVALID);
  static const char *invalid_text[] = {"\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xe2\x82", "\x80"};
  for (size_t i = 0; i < 5; ++i) {
    p = input_scalars(); p.S_text = (Text){ invalid_text[i], strlen(invalid_text[i]) }; rejected(&context, input, LB_OWNED_INVALID);
  }
  p = input_scalars(); inner.tag = 2; rejected(&context, input, LB_OWNED_INVALID); inner.tag = 1;
  inner.f0 = 1; rejected(&context, input, LB_OWNED_INVALID); inner.f0 = 0;
  size_t baseline = live, count = 0;
  for (size_t failure = 0; failure <= count; ++failure) {
    attempts = 0; fail_at = failure; output = (Packet){ .P_ticket = { UINT64_MAX } };
    int status = V_makePacket(&context, &ticket, &output, &owner); fail_at = 0;
    if (!failure) { count = attempts; CHECK(status == LB_OWNED_OK); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK); }
    else { ++failures; CHECK(status == LB_OWNED_ALLOC_FAILED); CHECK(output.P_ticket.token == UINT64_MAX && ov_owner_empty(&owner)); }
    CHECK(live == baseline && !context.scopes && context.live_owners == 1);
  }
  uint8_t *unit_data = calloc(131072, 1); CHECK(unit_data != NULL);
  Units units = { unit_data, 131071 }, units_out = {0};
  CHECK(V_units(&context, &units, &units_out, &owner) == LB_OWNED_OK);
  CHECK(units_out.length == 131071); CHECK(ov_owner_clear(&owner) == LB_OWNED_OK);
  units.length = 131072; units_out.length = SIZE_MAX;
  CHECK(V_units(&context, &units, &units_out, &owner) == LB_OWNED_LIMIT);
  CHECK(units_out.length == SIZE_MAX && ov_owner_empty(&owner)); free(unit_data);
  units = (Units){0}; CHECK(V_units(&context, &units, &units_out, &owner) == LB_OWNED_OK);
  CHECK(units_out.length == 0 && ov_owner_empty(&owner));
  CHECK(ov_owner_clear(&ticket_owner) == LB_OWNED_OK); CHECK(lb_owned_context_close(&context) == LB_OWNED_OK);
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  CHECK(live == 0 && snapshot.live_identities == 0);
  printf("{\"checks\":%zu,\"failures\":%zu,\"live\":%zu,\"identities\":%u}\n", checks, failures, live, snapshot.live_identities);
  return 0;
}
