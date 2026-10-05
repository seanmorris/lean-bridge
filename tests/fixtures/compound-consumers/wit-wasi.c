/* Independent installed consumer. Only the packaged Wasmtime API is included. */
#define _GNU_SOURCE
#include "compounds_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
static size_t checks, calls, rejections;
static compounds_wasmtime *session;
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_ORACLES */
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Builders transfer their arguments' ownership. */
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) {
  return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)};
}
static value branch(bool success, value child) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {success, wasmtime_component_val_new(&child)}};
}
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE};
  wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value text(const char *s) {
  value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, strlen(s), s); return v;
}
static value run(const char *name, const value *input) {
  value result = {0}; calls++;
  ok(compounds_wasmtime_call(session, name, input, input ? 1 : 0, &result)); return result;
}
static void expect(const char *name, value input, value expected) {
  value output = run(name, &input); equal(&output, &expected);
  clear(&input); equal(&output, &expected); clear(&output); clear(&expected);
}
static void rejected(const char *name, const value *input, const char *message) {
  value output = u32(991); calls++; rejections++;
  rejects(compounds_wasmtime_call(session, name, input, 1, &output), message);
  CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  value recovered = run("make", NULL);
  CHECK(recovered.kind == WASMTIME_COMPONENT_OPTION && recovered.of.option);
  clear(&recovered);
}
static value packet(unsigned variant, bool transformed) {
  value v = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&v.of.record, 4);
  const char *names[] = {"choice", "products", "rows", "nested"};
  for (size_t i = 0; i < 4; ++i) wasm_name_new(&v.of.record.data[i].name, strlen(names[i]), names[i]);
  value n = list(1, WASMTIME_COMPONENT_U32); n.of.list.data[0].of.u32 = 77 + transformed;
  v.of.record.data[0].val = variant % 3 == 0 ? none() : variant % 3 == 1
    ? some(branch(true, pair(n, sample(0, 0)))) : some(branch(false, text(transformed ? "\xce\xbb!" : "\xce\xbb")));
  if (variant % 3 != 1) clear(&n);
  v.of.record.data[1].val = pair(pair(u32(77 + transformed), text(transformed ? "abc!" : "abc")), pair(sample(1, transformed), sample(16, 5)));
  value rows = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&rows.of.list, 3);
  rows.of.list.data[transformed ? 2 : 0] = none();
  rows.of.list.data[1] = some(branch(true, pair(sample(14, 1), sample(5, 1))));
  rows.of.list.data[transformed ? 0 : 2] = some(branch(false, pair(sample(15, 1), sample(11, 1))));
  v.of.record.data[2].val = rows;
  v.of.record.data[3].val = variant % 2 ? branch(true, some(branch(true, pair(u32(99), sample(0, 0))))) : branch(false, some(sample(10, 1)));
  return v;
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  /* Test deployment paths contain no JSON metacharacters. */
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels;
  ok(compounds_wasmtime_open(&session));
  for (size_t primitive = 0; primitive < 19; ++primitive) for (unsigned round = 0; round < 48; ++round) {
    char name[64];
    snprintf(name, sizeof(name), "option-%s", type_labels[primitive]);
    expect(name, none(), none());
    expect(name, some(sample(primitive, round)), some(sample(primitive, round)));
    snprintf(name, sizeof(name), "result-%s", type_labels[primitive]);
    for (unsigned state = 0; state < 2; ++state)
      expect(name, branch(state, sample(primitive, round)), branch(!state, sample(primitive, round)));
    snprintf(name, sizeof(name), "tuple-%s", type_labels[primitive]);
    expect(name, pair(sample(primitive, round), sample(primitive, round + 1)), pair(sample(primitive, round + 1), sample(primitive, round)));
  }
  value options[] = {none(), some(none()), some(some(sample(0, 0)))};
  for (unsigned state = 0; state < 3; ++state) {
    expect("classify", clone(&options[state]), u32(state));
    expect("next", clone(&options[state]), clone(&options[(state + 1) % 3]));
  }
  for (size_t i = 0; i < 3; ++i) clear(&options[i]);
  for (unsigned round = 0; round < 12; ++round) {
    expect("transform", packet(round, false), packet(round, true));
    expect("flip", branch(true, pair(u32(42), some(sample(0, 0)))), branch(false, pair(u32(42), some(sample(0, 0)))));
    expect("flip", branch(false, some(sample(14, 1))), branch(true, some(sample(14, 1))));
    expect("flip", branch(false, none()), branch(true, none()));
    value bytes = some(sample(15, 1)), copied = run("duplicate", &bytes);
    CHECK(copied.kind == WASMTIME_COMPONENT_RESULT && copied.of.result.is_ok);
    value *items = copied.of.result.val->of.option->of.list.data;
    equal(&items[0], bytes.of.option); equal(&items[1], bytes.of.option);
    CHECK(items[0].of.list.data != items[1].of.list.data && items[0].of.list.data != bytes.of.option->of.list.data);
    items[0].of.list.data[0].of.u8 = 99;
    CHECK(items[1].of.list.data[0].of.u8 == 0 && bytes.of.option->of.list.data[0].of.u8 == 0);
    clear(&bytes); clear(&copied);
  }
  expect("duplicate", none(), branch(false, text("empty")));
  for (unsigned depth = 0; depth <= 24; ++depth) {
    value deep = depth == 24 ? branch(true, pair(u32(77), sample(0, 0))) : none();
    for (unsigned level = 0; level < depth; ++level) deep = some(deep);
    expect("deep", clone(&deep), deep);
  }
  value deep = branch(false, sample(14, 1));
  for (unsigned level = 0; level < 24; ++level) deep = some(deep);
  expect("deep", clone(&deep), deep);
  for (size_t primitive = 0; primitive < 19; ++primitive) {
    char name[64]; value wrong = some(sample(primitive == 0 ? 1 : 0, 0));
    snprintf(name, sizeof(name), "option-%s", type_labels[primitive]); rejected(name, &wrong, "invalid WIT input"); clear(&wrong);
    wrong = (value){.kind = WASMTIME_COMPONENT_RESULT};
    snprintf(name, sizeof(name), "result-%s", type_labels[primitive]); rejected(name, &wrong, "invalid WIT input");
    wrong = pair(sample(primitive, 0), sample(primitive, 0));
    snprintf(name, sizeof(name), "tuple-%s", type_labels[primitive]);
    wrong.of.tuple.size = 1; rejected(name, &wrong, "invalid WIT input");
    wrong.of.tuple.size = 3; rejected(name, &wrong, "invalid WIT input");
    wrong.of.tuple.size = 2; clear(&wrong);
  }
  value bad = some((value){.kind = WASMTIME_COMPONENT_CHAR, .of.character = 0xd800});
  rejected("option-char", &bad, "invalid WIT input"); clear(&bad);
  bad = some(text("\xc0\x80")); rejected("option-string", &bad, "invalid WIT input"); clear(&bad);
  bad = some(list(2, WASMTIME_COMPONENT_U32)); bad.of.option->of.list.data[1].of.u32 = 0;
  rejected("option-nat", &bad, "invalid WIT input"); clear(&bad);
  bad = packet(1, false); bad.of.record.data[3].name.data[0] = 'x';
  rejected("transform", &bad, "invalid WIT input"); clear(&bad);
  bad = (value){.kind = WASMTIME_COMPONENT_TUPLE, .of.tuple = {2, NULL}};
  rejected("tuple-string", &bad, "invalid WIT input");
  value cycle = none(); cycle.of.option = &cycle;
  rejected("deep", &cycle, "invalid WIT input"); cycle.of.option = NULL;
  bad = some((value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {SIZE_MAX, NULL}});
  rejected("option-bytes", &bad, "invalid WIT input"); bad.of.option->of.list.size = 0; clear(&bad);
  for (unsigned round = 0; round < 3; ++round) {
    /* Valid input fits the preflight budget. Duplicating it exceeds output accounting. */
    bad = some(list(200000, WASMTIME_COMPONENT_U8));
    rejected("duplicate", &bad, "16 MiB"); clear(&bad);
  }
  value retained = run("make", NULL), expected = some(branch(true, pair(sample(5, 1), sample(0, 0))));
  compounds_wasmtime_close(session); session = NULL;
  equal(&retained, &expected); clear(&retained); clear(&expected);
  printf("{\"hostVersion\":\"%s\",\"checks\":%zu,\"calls\":%zu,\"rejections\":%zu,\"primitives\":19,\"copiesSurviveSessionClose\":true,\"results\":[],\"loadedLibraries\":[", WASMTIME_VERSION, checks, calls, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
