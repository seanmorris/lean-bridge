/* Independent installed caller, using only named public Wasmtime values. */
#define _GNU_SOURCE
#include "variants_wasmtime.h"
#include <assert.h>
#include <link.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define clone copied_clone
typedef wasmtime_component_val_t value;
static size_t checks, calls, rejections;
static variants_wasmtime *session;
static unsigned seen[9];
#define CHECK(test) do { checks++; assert(test); } while (0)
/* COPIED_BUILDERS */
static bool named(const wasm_name_t *name, const char *expected) {
  return name->size == strlen(expected) && !memcmp(name->data, expected, name->size);
}
static void observed(const char *function, const value *output) {
  if (output->kind != WASMTIME_COMPONENT_VARIANT) return;
  const char *names[9][4] = {{"idle", "stopped", "data", "marker"}, {"first", "second", "third", NULL},
    {"empty", "packet", "outcome", NULL}, {"absent", "all", NULL, NULL},
    {"number", "pair", "collision", NULL}, {"only", NULL, NULL, NULL}, {"empty", "pair", NULL, NULL}, {"empty", "values", NULL, NULL},
    {"small", "large", "single", "double"}};
  const char *functions[] = {"echo", "echo-mode", "echo-nested", "echo-scalars", "echo-anonymous", "echo-one", "echo-buffers", "echo-aliased", "echo-joined"};
  for (size_t family = 0; family < 9; ++family) if (!strcmp(function, functions[family]))
    for (size_t branch = 0; branch < 4 && names[family][branch]; ++branch)
      if (named(&output->of.variant.discriminant, names[family][branch])) seen[family] |= 1u << branch;
}
static value run(const char *name, const value *input) {
  value result = {0}; calls++;
  ok(variants_wasmtime_call(session, name, input, 1, &result)); observed(name, &result); return result;
}
static void expect(const char *name, value input, value expected) {
  value output = run(name, &input); equal(&output, &expected);
  clear(&input); equal(&output, &expected); clear(&output); clear(&expected);
}
static void rejected(const char *name, const value *input, const char *message) {
  value output = u32(991); calls++; rejections++;
  wasmtime_error_t *error = variants_wasmtime_call(session, name, input, 1, &output);
  if (!error) fprintf(stderr, "Unexpected success: %s, case %zu\n", name, rejections);
  rejects(error, message); CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  value recovery = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&recovery.of.variant.discriminant, 4, "idle"); expect("code", recovery, u32(7));
}
static value record(const char **names, value *fields, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]); result.of.record.data[i].val = fields[i];
  }
  return result;
}
static value tagged(const char *name, value *payload) {
  value result = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&result.of.variant.discriminant, strlen(name), name);
  result.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL; return result;
}
static value with(const char *name, value payload) { return tagged(name, &payload); }
static value one_field(const char *name, const char *field, value item) {
  return with(name, record((const char *[]){field}, &item, 1));
}
static value data(uint32_t count, value label) {
  return with("data", record((const char *[]){"count", "label"}, (value[]){u32(count), label}, 2));
}
static value signal_value(unsigned round) {
  switch (round % 4) {
  case 0: return tagged("idle", NULL);
  case 1: return tagged("stopped", NULL);
  case 2: return data(round, text_n("a\0\xf0\x9f\x8c\xb1", 6));
  default: return one_field("marker", "value", sample(0, 0));
  }
}
static value mode(unsigned round) { return tagged((const char *[]){"first", "second", "third"}[round % 3], NULL); }
static value packet(unsigned round) {
  const char *names[] = {"current", "events", "fallback", "modes"};
  value fields[] = {signal_value(round), SEQ(signal_value(round), signal_value(round + 1)),
    round % 2 ? some(signal_value(round + 2)) : none(), SEQ(mode(round), mode(round + 1))};
  return record(names, fields, 4);
}
static value nested(unsigned round) {
  if (round % 3 == 0) return tagged("empty", NULL);
  if (round % 3 == 1) return one_field("packet", "value", packet(round));
  return one_field("outcome", "value", round % 2 ? branch(true, pair(signal_value(round), mode(round))) : branch(false, text_n("bad\0!", 5)));
}
static const char *scalar_names[] = {"unit", "bool", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64",
  "natural", "integer", "f32", "f64", "text", "bytes", "char", "word", "signed-word"};
static value scalars(unsigned round) {
  value fields[19]; for (size_t i = 0; i < 19; ++i) fields[i] = sample(i, round);
  return with("all", record(scalar_names, fields, 19));
}
static value inspected(void) {
  value result = scalars(1); wasmtime_component_valrecord_entry_t *fields = result.of.variant.val->of.record.data;
  clear(&fields[10].val); fields[10].val = huge(false); fields[10].val.of.list.data[0].of.u32 = 19;
  fields[10].val.of.list.data[7].of.u32 = 0;
  clear(&fields[11].val); fields[11].val = sample(11, 0); fields[11].val.of.record.data[1].val.of.list.data[0].of.u32 = 31;
  fields[11].val.of.record.data[1].val.of.list.data[7].of.u32 = 0;
  fields[12].val.of.f32 = 1.5f; fields[13].val.of.f64 = -2.25;
  clear(&fields[14].val); fields[14].val = text_n("A\0\xf0\x9f\x8c\xb1", 6);
  clear(&fields[15].val); fields[15].val = list(3, WASMTIME_COMPONENT_U8);
  fields[15].val.of.list.data[0].of.u8 = 0; fields[15].val.of.list.data[1].of.u8 = 255; fields[15].val.of.list.data[2].of.u8 = 1;
  fields[16].val.of.character = 0x1f331; fields[17].val.of.u64 = UINT32_MAX; fields[18].val.of.s64 = INT32_MIN;
  return result;
}
static value buffers(value first, value second) {
  return with("pair", record((const char *[]){"first", "second"}, (value[]){first, second}, 2));
}
static value aliased(unsigned round) {
  return round % 2 ? with("values", record((const char *[]){"label", "current", "batch"},
    (value[]){text_n("alias\0", 6), signal_value(round), SEQ(SEQ(signal_value(round + 1), signal_value(round + 2)), empty())}, 3)) : tagged("empty", NULL);
}
static value wide(unsigned constructor, uint8_t payload) {
  char name[32]; snprintf(name, sizeof(name), "c%u", constructor);
  if (constructor > 243) return tagged(name, NULL);
  return one_field(name, "value", (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = payload});
}
static value joined(unsigned round) {
  return one_field((const char *[]){"small", "large", "single", "double"}[round % 4], "value",
    sample((unsigned[]){4, 5, 12, 13}[round % 4], round / 4));
}
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels; (void)type_labels; ok(variants_wasmtime_open(&session));
  for (unsigned round = 0; round < 128; ++round) {
    expect("echo", signal_value(round), signal_value(round));
    expect("echo-mode", mode(round), mode(round));
    expect("echo-nested", nested(round), nested(round));
    expect("echo-scalars", scalars(round), scalars(round));
    expect("echo-one", one_field("only", "value", u32(round)), one_field("only", "value", u32(round + 1)));
    expect("signals", SEQ(SEQ(signal_value(round), signal_value(round + 1)), empty(), SEQ(signal_value(round + 2))),
      SEQ(SEQ(signal_value(round + 1), signal_value(round)), empty(), SEQ(signal_value(round + 2))));
    value anonymous = round % 3 == 0 ? one_field("number", "arg0", u32(round))
      : with(round % 3 == 1 ? "pair" : "collision", record(round % 3 == 1 ? (const char *[]){"arg0", "arg1"}
        : (const char *[]){"arg1", "lean-field-x00006100007200006700003100005f"}, (value[]){u32(round), text_n("anon\0", 5)}, 2));
    expect("echo-anonymous", clone(&anonymous), anonymous);
    value pair_bytes = buffers(sample(15, round), sample(15, round + 1));
    expect("echo-buffers", clone(&pair_bytes), pair_bytes);
    expect("echo-alias", signal_value(round), signal_value(round));
    expect("echo-alias-batch", SEQ(SEQ(signal_value(round), signal_value(round + 1)), empty()),
      SEQ(SEQ(signal_value(round + 1), signal_value(round)), empty()));
    expect("echo-aliased", aliased(round), aliased(round));
    expect("echo-joined", joined(round), joined(round));
  }
  size_t wide_cases = 0;
  for (unsigned constructor = 0; constructor < 257; ++constructor) {
    expect("echo-wide", wide(constructor, (uint8_t)constructor), wide(constructor, (uint8_t)constructor)); wide_cases++;
  }
  expect("echo-scalars", tagged("absent", NULL), tagged("absent", NULL));
  expect("echo-buffers", tagged("empty", NULL), tagged("empty", NULL));
  expect("signals", empty(), empty()); expect("signals", SEQ(empty()), SEQ(empty()));
  expect("next", tagged("idle", NULL), tagged("stopped", NULL));
  expect("next", tagged("stopped", NULL), one_field("marker", "value", sample(0, 0)));
  expect("next", one_field("marker", "value", sample(0, 0)), data(42, text("ready")));
  expect("next", data(UINT32_MAX, text_n("x\0", 2)), data(0, text_n("x\0!", 3)));
  expect("code", tagged("idle", NULL), u32(7)); expect("code", tagged("stopped", NULL), u32(13));
  expect("code", one_field("marker", "value", sample(0, 0)), u32(29)); expect("code", data(42, text_n("x\0", 2)), u32(44));
  expect("make", u32(0), tagged("idle", NULL)); expect("make", u32(UINT32_MAX), data(UINT32_MAX, text("made")));
  value input = inspected(), output = run("inspect", &input);
  CHECK(output.kind == WASMTIME_COMPONENT_BOOL && output.of.boolean); clear(&output);
  for (size_t field = 1; field < 19; ++field) {
    value altered = clone(&input); clear(&altered.of.variant.val->of.record.data[field].val);
    altered.of.variant.val->of.record.data[field].val = sample(field, 0);
    output = run("inspect", &altered); CHECK(output.kind == WASMTIME_COMPONENT_BOOL && !output.of.boolean);
    clear(&output); clear(&altered);
  }
  clear(&input);
  for (size_t field = 0; field < 19; ++field) {
    value bad = scalars(1); clear(&bad.of.variant.val->of.record.data[field].val);
    bad.of.variant.val->of.record.data[field].val = sample(field ? 0 : 1, 0);
    rejected("echo-scalars", &bad, "invalid WIT input"); clear(&bad);
  }
  for (size_t family = 0; family < 9; ++family) {
    const char *functions[] = {"echo", "echo-mode", "echo-nested", "echo-scalars", "echo-anonymous", "echo-one", "echo-buffers", "echo-aliased", "echo-wide", "echo-joined"};
    value bad = tagged("unknown", NULL); bad.of.variant.val = (value *)(uintptr_t)1;
    rejected(functions[family], &bad, "invalid WIT input"); bad.of.variant.val = NULL; clear(&bad);
  }
  value bad = u32(1); rejected("echo", &bad, "invalid WIT input");
  bad = tagged("idle", NULL); bad.of.variant.val = (value *)(uintptr_t)1;
  rejected("echo", &bad, "invalid WIT input"); bad.of.variant.val = NULL; clear(&bad);
  bad = tagged("data", NULL); rejected("echo", &bad, "invalid WIT input"); clear(&bad);
  bad = with("data", u32(3)); rejected("echo", &bad, "invalid WIT input"); clear(&bad);
  bad = data(7, text("ok")); bad.of.variant.val->of.record.size = 1;
  rejected("echo", &bad, "invalid WIT input"); bad.of.variant.val->of.record.size = 3;
  rejected("echo", &bad, "invalid WIT input"); bad.of.variant.val->of.record.size = 2;
  bad.of.variant.val->of.record.data[0].name.data[0] = 'x'; rejected("echo", &bad, "invalid WIT input"); clear(&bad);
  bad = data(7, text("\xc0\x80")); rejected("echo", &bad, "invalid WIT input"); clear(&bad);
  bad = one_field("marker", "value", u32(0)); rejected("echo", &bad, "invalid WIT input"); clear(&bad);
  bad = scalars(0); bad.of.variant.val->of.record.data[16].val.of.character = 0xd800;
  rejected("echo-scalars", &bad, "invalid WIT input"); clear(&bad);
  bad = scalars(0); clear(&bad.of.variant.val->of.record.data[10].val);
  bad.of.variant.val->of.record.data[10].val = WORDS(1, 0);
  rejected("echo-scalars", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(SEQ(signal_value(0)), SEQ(tagged("unknown", NULL))); rejected("signals", &bad, "invalid WIT input"); clear(&bad);
  bad = wide(257, 0); rejected("echo-wide", &bad, "invalid WIT input"); clear(&bad);
  bad = wide(243, 0); bad.of.variant.val->of.record.data[0].val.kind = WASMTIME_COMPONENT_U16;
  rejected("echo-wide", &bad, "invalid WIT input"); clear(&bad);
  bad = one_field("c256", "value", u32(0)); rejected("echo-wide", &bad, "invalid WIT input"); clear(&bad);
  bad = aliased(1); bad.of.variant.val->of.record.data[2].val.of.list.data[0].of.list.data[1].of.variant.discriminant.data[0] = 'x';
  rejected("echo-aliased", &bad, "invalid WIT input"); clear(&bad);
  for (unsigned round = 0; round < 3; ++round) {
    bad = list(400000, WASMTIME_COMPONENT_U8); rejected("duplicate", &bad, "16 MiB"); clear(&bad);
    bad = natural(1000000); rejected("produce", &bad, "16 MiB"); clear(&bad);
    bad = natural(17000000); rejected("produce", &bad, "16 MiB call limit exceeded"); clear(&bad);
  }
  input = sample(15, 1); output = run("duplicate", &input);
  value *first = &output.of.variant.val->of.record.data[0].val, *second = &output.of.variant.val->of.record.data[1].val;
  equal(first, &input); equal(second, &input);
  CHECK(first->of.list.data != second->of.list.data && first->of.list.data != input.of.list.data);
  first->of.list.data[0].of.u8 = 99; CHECK(second->of.list.data[0].of.u8 == 0 && input.of.list.data[0].of.u8 == 0);
  clear(&input); clear(&output);
  expect("duplicate", empty(), buffers(empty(), empty()));
  value generated = list(30000, WASMTIME_COMPONENT_U8); for (size_t i = 0; i < 30000; ++i) generated.of.list.data[i].of.u8 = 17;
  value last = list(1, WASMTIME_COMPONENT_U8); last.of.list.data[0].of.u8 = 1;
  expect("produce", natural(30000), buffers(generated, last));
  for (size_t family = 0; family < 9; ++family) CHECK((seen[family] == (unsigned[]){15, 7, 7, 3, 7, 1, 3, 3, 15}[family]));
  CHECK(wide_cases == 257);
  input = data(41, text_n("kept\0", 5)); output = run("echo", &input);
  value expected = clone(&input); clear(&input); variants_wasmtime_close(session); session = NULL;
  equal(&output, &expected); clear(&output); clear(&expected);
  printf("{\"hostVersion\":\"%s\",\"checks\":%zu,\"calls\":%zu,\"rejections\":%zu,\"primitives\":19,\"families\":10,\"constructors\":281,\"wideCases\":%zu,\"copiesSurviveSessionClose\":true,\"results\":[],\"loadedLibraries\":[", WASMTIME_VERSION, checks, calls, rejections, wide_cases);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
