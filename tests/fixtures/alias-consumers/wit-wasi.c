/* Independent installed caller. Public Wasmtime values cross the real component. */
#define _GNU_SOURCE
#include "aliases_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
static size_t checks, calls, rejections;
static aliases_wasmtime *session;
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_BUILDERS */
static value run(const char *name, const value *input) {
  value result = {0}; calls++;
  ok(aliases_wasmtime_call(session, name, input, input ? 1 : 0, &result)); return result;
}
static void expect(const char *name, value input, value expected) {
  value output = run(name, &input); equal(&output, &expected);
  clear(&input); equal(&output, &expected); clear(&output); clear(&expected);
}
static void rejected(const char *name, const value *input, const char *message) {
  value output = u32(991); calls++; rejections++;
  wasmtime_error_t *error = aliases_wasmtime_call(session, name, input, 1, &output);
  if (!error) fprintf(stderr, "Unexpected success: %s, case %zu\n", name, rejections);
  rejects(error, message);
  CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  expect("increment", u32(41), u32(42));
}
static value record(const char **names, value *fields, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]);
    result.of.record.data[i].val = fields[i];
  }
  return result;
}
static value packet(unsigned count) {
  const char *names[] = {"count", "text", "rows", "maybe", "outcome"};
  value fields[] = {u32(count), text_n("text\0\xf0\x9f\x8c\xb1", 9), SEQ(WORDS(1, 2, 3), empty(), WORDS(count)),
    some(some(sample(0, 0))), branch(true, pair(u32(7), sample(15, 1)))};
  return record(names, fields, 5);
}
static value scalars(void) {
  const char *names[] = {"v-unit", "v-bool", "v-uint8", "v-uint16", "v-uint32", "v-uint64",
    "v-int8", "v-int16", "v-int32", "v-int64", "v-nat", "v-int", "v-float32", "v-float64",
    "v-string", "v-bytes", "v-char", "v-usize", "v-isize"};
  value fields[19];
  for (size_t i = 0; i < 19; ++i) fields[i] = sample(i, 1);
  clear(&fields[10]); fields[10] = huge(false); fields[10].of.list.data[0].of.u32 = 19;
  fields[10].of.list.data[7].of.u32 = 0;
  clear(&fields[11]); fields[11] = sample(11, 0); fields[11].of.record.data[1].val.of.list.data[0].of.u32 = 31;
  fields[11].of.record.data[1].val.of.list.data[7].of.u32 = 0;
  fields[12].of.f32 = 1.5f; fields[13].of.f64 = -2.25;
  clear(&fields[14]); fields[14] = text_n("A\0\xf0\x9f\x8c\xb1", 6);
  clear(&fields[15]); fields[15] = list(3, WASMTIME_COMPONENT_U8);
  fields[15].of.list.data[0].of.u8 = 0; fields[15].of.list.data[1].of.u8 = 255; fields[15].of.list.data[2].of.u8 = 1;
  fields[16].of.character = 0x1f331; fields[17].of.u64 = UINT32_MAX; fields[18].of.s64 = INT32_MIN;
  return record(names, fields, 19);
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels; ok(aliases_wasmtime_open(&session));
  for (size_t primitive = 0; primitive < 19; ++primitive) {
    char name[64]; snprintf(name, sizeof(name), "echo-%s", type_labels[primitive]);
    for (unsigned round = 0; round < 128; ++round) expect(name, sample(primitive, round), sample(primitive, round));
    value bad = sample(primitive == 0 ? 1 : 0, 0); rejected(name, &bad, "invalid WIT input"); clear(&bad);
  }
  value input = scalars(), result = run("inspect", &input);
  CHECK(result.kind == WASMTIME_COMPONENT_BOOL && result.of.boolean); clear(&result);
  expect("echo-scalars", clone(&input), clone(&input));
  for (size_t field = 1; field < 19; ++field) {
    value altered = clone(&input); clear(&altered.of.record.data[field].val);
    altered.of.record.data[field].val = sample(field, 0);
    result = run("inspect", &altered); CHECK(result.kind == WASMTIME_COMPONENT_BOOL && !result.of.boolean);
    clear(&result); clear(&altered);
  }
  clear(&input);
  result = run("make", NULL); CHECK(result.kind == WASMTIME_COMPONENT_U32 && result.of.u32 == 41); clear(&result);
  result = run("label", NULL); value expected = text("alias\xf0\x9f\x8c\xb1"); equal(&result, &expected); clear(&result); clear(&expected);
  expect("increment", u32(UINT32_MAX), u32(0)); expect("increment", u32(41), u32(42));
  expect("echo-maybe", none(), none()); expect("echo-maybe", some(none()), some(none()));
  expect("echo-maybe", some(some(sample(0, 0))), some(some(sample(0, 0))));
  expect("echo-outcome", branch(true, pair(u32(7), sample(15, 1))), branch(true, pair(u32(7), sample(15, 1))));
  expect("echo-outcome", branch(false, text_n("bad\0\xf0\x9f\x8c\xb1", 8)), branch(false, text_n("bad\0\xf0\x9f\x8c\xb1", 8)));
  for (unsigned round = 0; round < 32; ++round) {
    expected = packet(round); expected.of.record.data[0].val.of.u32++;
    expect("change-packet", packet(round), expected);
    expect("reverse-packets", SEQ(packet(round), packet(round + 1), packet(round)), SEQ(packet(round), packet(round + 1), packet(round)));
    expect("reverse-packets", SEQ(packet(round), packet(round + 1)), SEQ(packet(round + 1), packet(round)));
  }
  expect("reverse-packets", empty(), empty()); expect("reverse-rows", empty(), empty());
  expect("reverse-rows", SEQ(WORDS(1, 2, 3), empty(), WORDS(4)), SEQ(WORDS(3, 2, 1), empty(), WORDS(4)));
  input = SEQ(WORDS(1, 2), WORDS(1, 2)); result = run("reverse-rows", &input);
  CHECK(result.of.list.data[0].of.list.data != result.of.list.data[1].of.list.data);
  CHECK(result.of.list.data[0].of.list.data != input.of.list.data[0].of.list.data);
  result.of.list.data[0].of.list.data[0].of.u32 = 99;
  CHECK(result.of.list.data[1].of.list.data[0].of.u32 == 2 && input.of.list.data[0].of.list.data[0].of.u32 == 1);
  clear(&input); clear(&result);
  input = packet(9); result = run("change-packet", &input);
  CHECK(input.of.record.data != result.of.record.data);
  value *input_bytes = &input.of.record.data[4].val.of.result.val->of.tuple.data[1];
  value *output_bytes = &result.of.record.data[4].val.of.result.val->of.tuple.data[1];
  CHECK(input_bytes->of.list.data != output_bytes->of.list.data);
  output_bytes->of.list.data[0].of.u8 = 99; CHECK(input_bytes->of.list.data[0].of.u8 == 0);
  clear(&input); clear(&result);
  input = list(2, WASMTIME_COMPONENT_U8); expected = list(4, WASMTIME_COMPONENT_U8);
  expected.of.list.data[2].of.u8 = 0; expected.of.list.data[3].of.u8 = 127;
  expect("duplicate", input, branch(true, pair(u32(7), expected)));
  expect("duplicate", empty(), branch(true, pair(u32(7), empty())));
  value bad = {.kind = WASMTIME_COMPONENT_CHAR, .of.character = 0xd800}; rejected("echo-char", &bad, "invalid WIT input");
  bad = text("\xc0\x80"); rejected("echo-string", &bad, "invalid WIT input"); clear(&bad);
  bad = WORDS(1, 0); rejected("echo-nat", &bad, "invalid WIT input"); clear(&bad);
  bad = sample(11, 1); bad.of.record.data[0].val.of.boolean = true;
  rejected("echo-int", &bad, "invalid WIT input"); clear(&bad);
  bad = sample(0, 0); bad.of.enumeration.data[0] = 'x'; rejected("echo-unit", &bad, "invalid WIT input"); clear(&bad);
  bad = packet(0); bad.of.record.data[3].name.data[0] = 'x'; rejected("change-packet", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(WORDS(1), SEQ(text("wrong"))); rejected("reverse-rows", &bad, "invalid WIT input"); clear(&bad);
  bad = some(some(u32(7))); rejected("echo-maybe", &bad, "invalid WIT input"); clear(&bad);
  bad = (value){.kind = WASMTIME_COMPONENT_RESULT}; rejected("echo-outcome", &bad, "invalid WIT input");
  bad = branch(true, pair(u32(7), empty())); bad.of.result.val->of.tuple.size = 1;
  rejected("echo-outcome", &bad, "invalid WIT input"); bad.of.result.val->of.tuple.size = 3;
  rejected("echo-outcome", &bad, "invalid WIT input"); bad.of.result.val->of.tuple.size = 2; clear(&bad);
  bad = (value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {1, NULL}}; rejected("reverse-rows", &bad, "invalid WIT input");
  bad.of.list.size = SIZE_MAX; rejected("reverse-rows", &bad, "16 MiB");
  value leaf = u32(7); bad.of.list.data = &leaf; bad.of.list.size = 2097153; rejected("reverse-rows", &bad, "16 MiB");
  value cycle = {.kind = WASMTIME_COMPONENT_LIST}; cycle.of.list.size = 1; cycle.of.list.data = &cycle;
  rejected("reverse-rows", &cycle, "invalid WIT input"); cycle.of.list.data = NULL; cycle.of.list.size = 0;
  for (unsigned round = 0; round < 3; ++round) {
    bad = list(400000, WASMTIME_COMPONENT_U8); rejected("duplicate", &bad, "16 MiB"); clear(&bad);
    bad = natural(1000000); rejected("produce", &bad, "16 MiB"); clear(&bad);
    bad = natural(16777216); rejected("produce", &bad, "16 MiB"); clear(&bad);
  }
  input = natural(30000); result = run("produce", &input); CHECK(result.of.list.size == 30000);
  for (size_t i = 0; i < 30000; ++i) CHECK(result.of.list.data[i].kind == WASMTIME_COMPONENT_U8 && result.of.list.data[i].of.u8 == 7);
  clear(&input); clear(&result); expect("produce", natural(0), empty());
  input = packet(17); result = run("change-packet", &input); clear(&input);
  expected = packet(17); expected.of.record.data[0].val.of.u32++;
  aliases_wasmtime_close(session); session = NULL;
  equal(&result, &expected); clear(&result); clear(&expected);
  printf("{\"hostVersion\":\"%s\",\"checks\":%zu,\"calls\":%zu,\"rejections\":%zu,\"primitives\":19,\"aliases\":27,\"copiesSurviveSessionClose\":true,\"results\":[],\"loadedLibraries\":[", WASMTIME_VERSION, checks, calls, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
