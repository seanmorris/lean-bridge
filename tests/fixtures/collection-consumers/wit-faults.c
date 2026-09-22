/* Synthetic native buffers. These probes do not execute Lean. */
#include "probe.h"
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
static size_t checks, attempts, fail_at, live, raw_rejections, scratch_failures;
static size_t input_budgets, output_budgets, malformed_inputs, malformed_outputs, empty_pointers;
#define CHECK(test) do { checks++; assert(test); } while (0)
static void *tracked_calloc(size_t count, size_t width) {
  if (++attempts == fail_at) return NULL;
  void *p = calloc(count, width); if (p) live++; return p;
}
static void tracked_free(void *p) { if (p) { CHECK(live > 0); live--; } free(p); }
#define calloc tracked_calloc
#define free tracked_free
#include "conversions.h"
#undef calloc
#undef free
/* GENERATED_NAMES */
typedef wasmtime_component_val_t value;
static lb_scope scope(void) { return (lb_scope){.remaining = 16u * 1024u * 1024u}; }
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static void recovered(void) {
  value output = {0}; uint32_t source = 42, target = 0; lb_scope s = scope();
  CHECK(OUT_UINT32(&source, &s, &output)); CHECK(IN_UINT32(&output, &s, &target)); CHECK(target == 42);
  clear(&output); lb_scope_close(&s); CHECK(live == 0);
}
#define BAD_OUT(NAME, ptr) do { lb_scope s = scope(); value output = {0}; \
  CHECK(!OUT_##NAME((ptr), &s, &output)); malformed_outputs++; \
  clear(&output); lb_scope_close(&s); CHECK(live == 0); recovered(); } while (0)
#define BAD_IN(NAME, TYPE, ptr) do { lb_scope s = scope(); native_##TYPE target = {0}; \
  CHECK(!IN_##NAME((ptr), &s, &target)); malformed_inputs++; lb_scope_close(&s); CHECK(live == 0); \
  s = scope(); CHECK(!IN_##NAME((ptr), &s, NULL)); lb_scope_close(&s); CHECK(live == 0); recovered(); } while (0)
#define EMPTY_OUT(NAME, ptr) do { lb_scope s = scope(); value output = {0}; \
  CHECK(OUT_##NAME((ptr), &s, &output)); empty_pointers++; clear(&output); lb_scope_close(&s); CHECK(live == 0); } while (0)

int main(void) {
  uint32_t limbs[] = {UINT32_MAX, 42, 1}; uint8_t bytes[] = {255, 0, 17};
  native_primitives items[3] = {0};
  for (size_t i = 0; i < 3; ++i) items[i] = (native_primitives){
    .flag = true, .u8 = UINT8_MAX, .u16 = UINT16_MAX, .u32 = UINT32_MAX, .u64 = UINT64_MAX,
    .i8 = INT8_MIN, .i16 = INT16_MIN, .i32 = INT32_MIN, .i64 = INT64_MIN,
    .natural = {.data = limbs, .length = 3}, .integer = {.data = limbs, .length = 3, .negative = true},
    .f32 = -0.0f, .f64 = 3.25, .text = {.data = "x\0\xce\xbb", .length = 4},
    .bytes = {.data = bytes, .length = 3}, .char_ = 0x10ffff, .usize = UINT64_MAX, .isize = INT64_MIN};
  native_row rows[] = {{.data = items, .length = 2}, {.data = items + 2, .length = 1}};
  native_packet packet = {.label = {.data = "packet", .length = 6}, .values = {.data = rows, .length = 2},
    .single = {.value = UINT64_MAX}, .count = {.value = {.data = limbs, .length = 3}},
    .pair = {.first = UINT32_MAX, .second = {.data = "pair", .length = 4}},
    .reversed = {.second = {.data = "reverse", .length = 7}, .first = 42}};
  value input = {0}; lb_scope initial = scope(); CHECK(OUT_PACKET(&packet, &initial, &input));
  size_t output_cost = 16u * 1024u * 1024u - initial.remaining; lb_scope_close(&initial);
  native_packet copied = {0}; lb_scope in = scope(); attempts = 0;
  CHECK(IN_PACKET(&input, &in, &copied)); size_t allocations = attempts, input_cost = 16u * 1024u * 1024u - in.remaining;
  CHECK(allocations > 10); CHECK(copied.values.length == 2 && copied.values.data[0].length == 2);
  CHECK(copied.values.data[0].data[0].natural.data != limbs);
  CHECK(copied.values.data[0].data[0].natural.data != copied.values.data[0].data[1].natural.data);
  lb_scope_close(&in); CHECK(live == 0);
  for (fail_at = 1; fail_at <= allocations; ++fail_at) {
    in = scope(); attempts = 0; copied = (native_packet){0};
    CHECK(!IN_PACKET(&input, &in, &copied)); CHECK(attempts == fail_at); scratch_failures++;
    lb_scope_close(&in); CHECK(live == 0);
  }
  fail_at = 0; CHECK(input_cost < 50000 && output_cost < 50000);
  for (size_t budget = 0; budget <= input_cost; ++budget) {
    in = (lb_scope){.remaining = budget}; copied = (native_packet){0};
    CHECK(IN_PACKET(&input, &in, &copied) == (budget == input_cost)); if (budget < input_cost) input_budgets++;
    lb_scope_close(&in); CHECK(live == 0);
  }
  for (size_t budget = 0; budget <= output_cost; ++budget) {
    lb_scope out = {.remaining = budget}; value output = {0};
    CHECK(OUT_PACKET(&packet, &out, &output) == (budget == output_cost)); if (budget < output_cost) output_budgets++;
    clear(&output); lb_scope_close(&out); CHECK(live == 0);
  }
  recovered();

  for (unsigned n = 2; n <= 255; ++n) {
    uint8_t raw = (uint8_t)n; bool boolean; memcpy(&boolean, &raw, 1);
    value wire = {.kind = WASMTIME_COMPONENT_BOOL}, output = {0}; memcpy(&wire.of.boolean, &raw, 1);
    lb_scope s = scope(); bool target = false;
    CHECK(!OUT_BOOL(&boolean, &s, &output)); raw_rejections++; clear(&output);
    CHECK(!IN_BOOL(&wire, &s, &target)); raw_rejections++; CHECK(!target);
    CHECK(!IN_BOOL(&wire, &s, NULL)); raw_rejections++;
    native_int integer = {.data = limbs, .length = 3}; memcpy(&integer.negative, &raw, 1);
    CHECK(!OUT_INT(&integer, &s, &output)); raw_rejections++; clear(&output);
    value signed_wire = {0}; integer.negative = true; CHECK(OUT_INT(&integer, &s, &signed_wire));
    memcpy(&signed_wire.of.record.data[0].val.of.boolean, &raw, 1);
    CHECK(!IN_INT(&signed_wire, &s, NULL)); raw_rejections++;
    signed_wire.of.record.data[0].val.of.boolean = true; clear(&signed_wire);
    value payload = {.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = true};
    value result = {.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = true, .val = &payload}};
    memcpy(&result.of.result.is_ok, &raw, 1); native_result result_target = {0};
    CHECK(!IN_RESULT(&result, &s, &result_target)); raw_rejections++;
    CHECK(!IN_RESULT(&result, &s, NULL)); raw_rejections++;
    lb_scope_close(&s); CHECK(live == 0);
  }
  recovered();

  _Alignas(value) uint8_t value_storage[2 * sizeof(value) + 1] = {0};
  _Alignas(wasmtime_component_valrecord_entry_t) uint8_t record_storage[19 * sizeof(wasmtime_component_valrecord_entry_t) + 1] = {0};
  _Alignas(native_primitives) uint8_t primitive_storage[sizeof(native_primitives) + 1] = {0};
  _Alignas(native_words) uint8_t array_storage[sizeof(native_words) + 1] = {0};
  _Alignas(uint32_t) uint8_t limb_storage[sizeof(uint32_t) + 1] = {0};
  memcpy(limb_storage + 1, limbs, sizeof(uint32_t));
  native_nat nat = {.data = (void *)(limb_storage + 1), .length = 1}; BAD_OUT(NAT, &nat);
  native_int integer = {.data = (void *)(limb_storage + 1), .length = 1}; BAD_OUT(INT, &integer);
  native_words words = {.data = (void *)(array_storage + 1), .length = 1}; BAD_OUT(WORDS, &words);
  BAD_OUT(PRIMITIVES, (const native_primitives *)(primitive_storage + 1));
  BAD_IN(BOOL, bool, (const value *)(value_storage + 1));
  value bad = {.kind = WASMTIME_COMPONENT_LIST, .of.list = {.size = 1, .data = (void *)(value_storage + 1)}};
  BAD_IN(NAT, nat, &bad); BAD_IN(BYTES, bytes, &bad); BAD_IN(WORDS, words, &bad);
  bad = (value){.kind = WASMTIME_COMPONENT_RECORD, .of.record = {.size = 19, .data = (void *)(record_storage + 1)}};
  BAD_IN(PRIMITIVES, primitives, &bad);
  bad.of.record.size = 2; BAD_IN(INT, int, &bad);
  bad = (value){.kind = WASMTIME_COMPONENT_TUPLE, .of.tuple = {.size = 2, .data = (void *)(value_storage + 1)}};
  BAD_IN(FLAGS, flags, &bad);
  bad = (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = (void *)(value_storage + 1)}; BAD_IN(OPTION, option, &bad);
  bad = (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = true, .val = (void *)(value_storage + 1)}};
  BAD_IN(RESULT, result, &bad);
  bad = (value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {.size = 1, .data = NULL}}; BAD_IN(WORDS, words, &bad);
  bad.of.list.size = SIZE_MAX; bad.of.list.data = (void *)1; BAD_IN(WORDS, words, &bad);
  native_string string = {.data = (void *)(UINTPTR_MAX - 1), .length = 3}; BAD_OUT(STRING, &string);
  native_bytes buffer = {.data = (void *)(UINTPTR_MAX - 1), .length = 3}; BAD_OUT(BYTES, &buffer);
  words.data = (void *)1; words.length = SIZE_MAX; BAD_OUT(WORDS, &words);
  nat.data = limbs; nat.length = SIZE_MAX; BAD_OUT(NAT, &nat);
  uint32_t zero = 0; nat.data = &zero; nat.length = 1; BAD_OUT(NAT, &nat);
  integer.data = limbs; integer.length = 0; integer.negative = true; BAD_OUT(INT, &integer);
  native_unit unit = 1; BAD_OUT(UNIT, &unit);
  native_option option = {.has_value = 2}; BAD_OUT(OPTION, &option);
  native_result result = {.is_ok = 2}; BAD_OUT(RESULT, &result);
  items[2].char_ = 0xd800; BAD_OUT(PACKET, &packet); items[2].char_ = 0x10ffff;
  uint8_t invalid_bool = 2; memcpy(&items[2].flag, &invalid_bool, 1); BAD_OUT(PACKET, &packet); items[2].flag = true;

  nat.data = (void *)1; nat.length = 0; EMPTY_OUT(NAT, &nat);
  integer.data = (void *)1; integer.length = 0; integer.negative = false; EMPTY_OUT(INT, &integer);
  string.data = (void *)1; string.length = 0; EMPTY_OUT(STRING, &string);
  buffer.data = (void *)1; buffer.length = 0; EMPTY_OUT(BYTES, &buffer);
  words.data = (void *)1; words.length = 0; EMPTY_OUT(WORDS, &words);
  for (unsigned mode = 0; mode < 3; ++mode) {
    bad = (value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {.size = 0, .data = (void *)1}};
    lb_scope s = scope();
    CHECK(mode == 0 ? IN_NAT(&bad, &s, NULL) : mode == 1 ? IN_BYTES(&bad, &s, NULL) : IN_WORDS(&bad, &s, NULL));
    empty_pointers++; lb_scope_close(&s); CHECK(live == 0);
  }
  option.has_value = 0; memcpy(&option.value, &invalid_bool, 1);
  value output = {0}; lb_scope s = scope(); CHECK(OUT_OPTION(&option, &s, &output)); clear(&output);
  result = (native_result){.is_ok = 1, .ok = true, .error = {.data = (void *)1, .length = SIZE_MAX}};
  memcpy(&result.error.negative, &invalid_bool, 1); CHECK(OUT_RESULT(&result, &s, &output)); clear(&output);
  lb_scope_close(&s); CHECK(live == 0);

  value *last = &input.of.record.data[6].val.of.record.data[1].val;
  CHECK(last->kind == WASMTIME_COMPONENT_U32); last->kind = WASMTIME_COMPONENT_BOOL;
  in = scope(); copied = (native_packet){0}; attempts = 0;
  CHECK(!IN_PACKET(&input, &in, &copied)); CHECK(attempts == allocations); lb_scope_close(&in); CHECK(live == 0);
  last->kind = WASMTIME_COMPONENT_U32; in = scope(); copied = (native_packet){0};
  CHECK(IN_PACKET(&input, &in, &copied)); lb_scope_close(&in); CHECK(live == 0); clear(&input); recovered();
  printf("{\"checks\":%zu,\"scratchFailures\":%zu,\"inputBudgetFailures\":%zu,\"outputBudgetFailures\":%zu,\"rawBoolRejections\":%zu,\"malformedInputs\":%zu,\"malformedOutputs\":%zu,\"emptyPoisonPointers\":%zu,\"partialInputs\":1,\"inactivePayloads\":2,\"liveAllocations\":%zu}\n",
    checks, scratch_failures, input_budgets, output_budgets, raw_rejections, malformed_inputs, malformed_outputs, empty_pointers, live);
}
