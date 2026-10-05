/* Independent installed consumer. Only the packaged Wasmtime API executes Lean. */
#define _GNU_SOURCE
#include "lists_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
static size_t checks, calls, rejections;
static lists_wasmtime *session;
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_ORACLES */
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Builders transfer ownership of their arguments. */
static value empty(void) { return list(0, WASMTIME_COMPONENT_U32); }
static value sequence(value *items, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = items[i];
  return result;
}
#define SEQ(...) sequence((value[]){__VA_ARGS__}, sizeof((value[]){__VA_ARGS__}) / sizeof(value))
static value words(const uint32_t *items, size_t count) {
  value result = list(count, WASMTIME_COMPONENT_U32);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i].of.u32 = items[i];
  return result;
}
#define WORDS(...) words((uint32_t[]){__VA_ARGS__}, sizeof((uint32_t[]){__VA_ARGS__}) / sizeof(uint32_t))
static value natural(uint32_t n) { return n ? WORDS(n) : empty(); }
static value huge(bool increment) {
  value result = list(161, WASMTIME_COMPONENT_U32);
  for (size_t i = 0; i < 161; ++i) result.of.list.data[i].of.u32 = 0;
  result.of.list.data[0].of.u32 = 17 + increment;
  result.of.list.data[7].of.u32 = 0x80000000u;
  result.of.list.data[160].of.u32 = 1; return result;
}
static value sample(size_t index, unsigned variant) {
  value result = {0};
  if (index == 10) return variant % 3 == 2 ? huge(false) : natural(variant % 3);
  if (index == 11) {
    result.kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&result.of.record, 2);
    wasm_name_new(&result.of.record.data[0].name, 8, "negative");
    result.of.record.data[0].val = (value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = variant % 3 == 0};
    wasm_name_new(&result.of.record.data[1].name, 5, "limbs");
    result.of.record.data[1].val = variant % 3 == 1 ? empty() : huge(false); return result;
  }
  if (index == 12) {
    static const uint32_t bits[] = {0, 0x80000000u, 1, 0x7fffff, 0x800000, 0x3f800000, 0x7f7fffff, 0x7f800000, 0xff800000u, 0x7fc00000};
    result.kind = WASMTIME_COMPONENT_F32; memcpy(&result.of.f32, &bits[variant % 10], sizeof(float)); return result;
  }
  if (index == 13) {
    static const uint64_t bits[] = {0, UINT64_C(0x8000000000000000), 1, UINT64_C(0xfffffffffffff), UINT64_C(0x10000000000000), UINT64_C(0x3ff0000000000000), UINT64_C(0x7fefffffffffffff), UINT64_C(0x7ff0000000000000), UINT64_C(0xfff0000000000000), UINT64_C(0x7ff8000000000000)};
    result.kind = WASMTIME_COMPONENT_F64; memcpy(&result.of.f64, &bits[variant % 10], sizeof(double)); return result;
  }
  return base_sample(index, variant);
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
static value branch(bool success, value child) { return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {success, wasmtime_component_val_new(&child)}}; }
static value pair(value first, value second) {
  value result = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&result.of.tuple, 2);
  result.of.tuple.data[0] = first; result.of.tuple.data[1] = second; return result;
}
static value text_n(const char *s, size_t length) {
  value result = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&result.of.string, length, s); return result;
}
static value text(const char *s) { return text_n(s, strlen(s)); }
static value run(const char *name, const value *input) {
  value result = {0}; calls++;
  ok(lists_wasmtime_call(session, name, input, 1, &result)); return result;
}
static void expect(const char *name, value input, value expected) {
  value output = run(name, &input); equal(&output, &expected);
  clear(&input); equal(&output, &expected); clear(&output); clear(&expected);
}
static void rejected(const char *name, const value *input, const char *message) {
  value output = u32(991); calls++; rejections++;
  wasmtime_error_t *error = lists_wasmtime_call(session, name, input, 1, &output);
  if (!error) fprintf(stderr, "Unexpected success: %s, case %zu\n", name, rejections);
  rejects(error, message);
  CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  expect("reverse-uint32", WORDS(1, 2, 3), WORDS(3, 2, 1));
}
static value packet(unsigned round, bool transformed) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD}; wasmtime_component_valrecord_new_uninit(&result.of.record, 4);
  const char *names[] = {"sequences", "branches", "buffers", "arrays"};
  for (size_t i = 0; i < 4; ++i) wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]);
  result.of.record.data[0].val = transformed ? SEQ(WORDS(round), empty(), WORDS(3, 2, 1)) : SEQ(WORDS(1, 2, 3), empty(), WORDS(round));
  value number = some(branch(true, pair(huge(transformed), sample(0, 0))));
  result.of.record.data[1].val = transformed ? SEQ(some(branch(false, text_n("oops\0!", 6))), number, none()) : SEQ(none(), number, some(branch(false, text_n("oops\0", 5))));
  result.of.record.data[2].val = transformed ? SEQ(sample(15, 0), sample(15, 1)) : SEQ(sample(15, 1), sample(15, 0));
  value a = pair(sample(1, 1), sample(16, 4)), b = pair(sample(1, 0), sample(16, 0));
  result.of.record.data[3].val = transformed ? SEQ(empty(), SEQ(b, a)) : SEQ(SEQ(a, b), empty());
  return result;
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels; ok(lists_wasmtime_open(&session));
  for (size_t primitive = 0; primitive < 19; ++primitive) {
    char name[64]; snprintf(name, sizeof(name), "reverse-%s", type_labels[primitive]);
    expect(name, empty(), empty()); expect(name, SEQ(sample(primitive, 0)), SEQ(sample(primitive, 0)));
    for (unsigned round = 0; round < 128; ++round)
      expect(name, SEQ(sample(primitive, round), sample(primitive, round + 1), sample(primitive, round), sample(primitive, round + 2)),
        SEQ(sample(primitive, round + 2), sample(primitive, round), sample(primitive, round + 1), sample(primitive, round)));
    value bad = u32(77); rejected(name, &bad, "invalid WIT input"); clear(&bad);
    bad = SEQ(sample(primitive, 0), sample(primitive == 0 ? 1 : 0, 0));
    rejected(name, &bad, "invalid WIT input"); clear(&bad);
  }
  expect("join", SEQ(text_n("a\0", 2), text(""), text("z")), text_n("a\0\xf0\x9f\x8c\xb1\xf0\x9f\x8c\xb1z", 11));
  expect("join", empty(), text(""));
  expect("mix", SEQ(WORDS(1, 2, 3), empty(), WORDS(4)), SEQ(WORDS(4), empty(), WORDS(3, 2, 1)));
  for (unsigned round = 0; round < 20; ++round) expect("transform", packet(round, false), packet(round, true));
  expect("nest", none(), none()); expect("nest", some(empty()), some(empty()));
  expect("nest", some(SEQ(branch(true, SEQ(sample(0, 0), sample(0, 0))), branch(false, text_n("bad\0", 4)), branch(true, empty()))),
    some(SEQ(branch(true, empty()), branch(false, text_n("bad\0!", 5)), branch(true, SEQ(sample(0, 0), sample(0, 0))))));
  expect("swap", branch(false, SEQ(text("first"), text("last"))), branch(true, SEQ(text("last"), text("first"))));
  expect("swap", branch(true, pair(SEQ(huge(false), natural(42)), WORDS(1, 2, 3))), branch(false, pair(SEQ(natural(42), huge(false)), WORDS(3, 2, 1))));
  expect("swap", branch(false, empty()), branch(true, empty()));
  expect("swap", branch(true, pair(empty(), empty())), branch(false, pair(empty(), empty())));
  for (unsigned depth = 0; depth <= 24; ++depth) {
    value deep = depth == 24 ? u32(42) : empty();
    for (unsigned level = 0; level < depth; ++level) deep = SEQ(deep);
    expect("deep", clone(&deep), deep);
  }
  value bytes = sample(15, 1), copies = run("duplicate", &bytes);
  CHECK(copies.of.list.size == 2);
  value *first = &copies.of.list.data[0], *second = &copies.of.list.data[1];
  equal(first, &bytes); equal(second, &bytes);
  CHECK(first->of.list.data != second->of.list.data && first->of.list.data != bytes.of.list.data);
  first->of.list.data[0].of.u8 = 99; CHECK(second->of.list.data[0].of.u8 == 0 && bytes.of.list.data[0].of.u8 == 0);
  bytes.of.list.data[1].of.u8 = 88; CHECK(second->of.list.data[1].of.u8 == 127); clear(&bytes); clear(&copies);
  expect("duplicate", empty(), SEQ(empty(), empty()));
  value shared = WORDS(1, 2), input = SEQ(clone(&shared), clone(&shared)), result = run("mix", &input);
  result.of.list.data[0].of.list.data[0].of.u32 = 99;
  CHECK(result.of.list.data[1].of.list.data[0].of.u32 == 2 && input.of.list.data[0].of.list.data[0].of.u32 == 1);
  clear(&shared); clear(&input); clear(&result);
  value bad = SEQ((value){.kind = WASMTIME_COMPONENT_CHAR, .of.character = 0xd800});
  rejected("reverse-char", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(text("\xc0\x80")); rejected("reverse-string", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(WORDS(1, 0)); rejected("reverse-nat", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(sample(11, 1)); bad.of.list.data[0].of.record.data[0].val.of.boolean = true;
  rejected("reverse-int", &bad, "invalid WIT input"); clear(&bad);
  bad = packet(0, false); bad.of.record.data[3].name.data[0] = 'x'; rejected("transform", &bad, "invalid WIT input"); clear(&bad);
  bad = some(SEQ(branch(true, empty()), (value){.kind = WASMTIME_COMPONENT_RESULT}));
  rejected("nest", &bad, "invalid WIT input"); clear(&bad);
  bad = branch(true, pair(empty(), empty()));
  bad.of.result.val->of.tuple.size = 1; rejected("swap", &bad, "invalid WIT input");
  bad.of.result.val->of.tuple.size = 3; rejected("swap", &bad, "invalid WIT input");
  bad.of.result.val->of.tuple.size = 2; clear(&bad);
  bad = (value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {1, NULL}}; rejected("reverse-uint32", &bad, "invalid WIT input");
  bad.of.list.size = SIZE_MAX; rejected("reverse-uint32", &bad, "16 MiB");
  value leaf = u32(7); bad.of.list.data = &leaf; bad.of.list.size = 2097153;
  rejected("reverse-uint32", &bad, "16 MiB");
  value cycle = {.kind = WASMTIME_COMPONENT_LIST}; cycle.of.list.size = 1; cycle.of.list.data = &cycle;
  rejected("deep", &cycle, "invalid WIT input"); cycle.of.list.data = NULL; cycle.of.list.size = 0;
  value deep = u32(42); for (unsigned level = 0; level < 25; ++level) deep = SEQ(deep);
  rejected("deep", &deep, "invalid WIT input"); clear(&deep);
  for (unsigned round = 0; round < 3; ++round) {
    bad = list(200000, WASMTIME_COMPONENT_U8); rejected("duplicate", &bad, "16 MiB"); clear(&bad);
    bad = natural(1000000); rejected("generate", &bad, "16 MiB"); clear(&bad);
    bad = natural(2097153); rejected("generate", &bad, "16 MiB"); clear(&bad);
  }
  bad = natural(30000); result = run("generate", &bad);
  CHECK(result.of.list.size == 30000);
  for (size_t i = 0; i < 30000; ++i) CHECK(result.of.list.data[i].kind == WASMTIME_COMPONENT_U32 && result.of.list.data[i].of.u32 == 7);
  clear(&bad); clear(&result); expect("generate", natural(0), empty());
  input = SEQ(text_n("kept\0", 5), text("last")); result = run("reverse-string", &input);
  value expected = SEQ(text("last"), text_n("kept\0", 5)); clear(&input);
  lists_wasmtime_close(session); session = NULL;
  equal(&result, &expected); clear(&result); clear(&expected);
  printf("{\"hostVersion\":\"%s\",\"checks\":%zu,\"calls\":%zu,\"rejections\":%zu,\"primitives\":19,\"copiesSurviveSessionClose\":true,\"results\":[],\"loadedLibraries\":[", WASMTIME_VERSION, checks, calls, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
