/* COPIED_ORACLES */
/* Builders transfer ownership. Calls borrow inputs; each output is deleted once. */
static value text_n(const char *s, size_t n) {
  value result = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&result.of.string, n, s); return result;
}
static value text(const char *s) { return text_n(s, strlen(s)); }
static value named(const char **names, value *fields, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD}; wasmtime_component_valrecord_new_uninit(&result.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]); result.of.record.data[i].val = fields[i];
  }
  return result;
}
static value one(value v) { return named((const char *[]){"value"}, &v, 1); }
static value product(uint32_t first, value second) {
  return named((const char *[]){"first", "second"}, (value[]){u32(first), second}, 2);
}
static value reversed(value second, uint32_t first) {
  return named((const char *[]){"second", "first"}, (value[]){second, u32(first)}, 2);
}
static value empty_record(void) {
  value result = {.kind = WASMTIME_COMPONENT_ENUM}; wasm_name_new(&result.of.enumeration, 5, "empty"); return result;
}
static value power(unsigned bit, uint32_t low) {
  value result = list(bit / 32 + 1, WASMTIME_COMPONENT_U32);
  for (size_t i = 0; i < result.of.list.size; ++i) result.of.list.data[i].of.u32 = 0;
  result.of.list.data[0].of.u32 = low; result.of.list.data[bit / 32].of.u32 |= UINT32_C(1) << (bit % 32); return result;
}
static value integer(bool negative, value limbs) {
  return named((const char *[]){"negative", "limbs"}, (value[]){
    {.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = negative}, limbs}, 2);
}
static value primitives(void) {
  const char *names[] = {"unit", "flag", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "natural", "integer", "f32", "f64", "text", "bytes", "char", "usize", "isize"};
  value bytes = list(3, WASMTIME_COMPONENT_U8);
  bytes.of.list.data[0].of.u8 = 255; bytes.of.list.data[1].of.u8 = 0; bytes.of.list.data[2].of.u8 = 1;
  value fields[] = {sample(0, 0), sample(1, 1), sample(2, 1), sample(3, 1), sample(4, 1), sample(5, 1),
    sample(6, 1), sample(7, 1), sample(8, 1), sample(9, 1), power(200, 0), integer(true, power(200, 0)),
    {.kind = WASMTIME_COMPONENT_F32, .of.f32 = -0.0f}, {.kind = WASMTIME_COMPONENT_F64, .of.f64 = 3.25},
    text_n("\xf0\x9f\x8c\xb1\0", 5), bytes, {.kind = WASMTIME_COMPONENT_CHAR, .of.character = 0x1f331},
    sample(17, 1), {.kind = WASMTIME_COMPONENT_S64, .of.s64 = -INT64_C(2147483648)}};
  return named(names, fields, 19);
}
static value packet(bool changed) {
  const char *names[] = {"label", "values", "empty", "single", "count", "pair", "reversed"};
  value rows = changed ? SEQ(SEQ(primitives()), empty(), SEQ(primitives(), primitives()))
    : SEQ(SEQ(primitives(), primitives()), empty(), SEQ(primitives()));
  value fields[] = {text(changed ? "packet!" : "packet"), rows, empty_record(), one(sample(5, !changed)),
    one(power(5120, changed ? 38 : 31)), product(changed ? 0 : UINT32_MAX, text(changed ? "pairp" : "pair")),
    reversed(text(changed ? "reverser" : "reverse"), changed ? 1 : UINT32_MAX)};
  return named(names, fields, 7);
}
static value call(const char *name, const value *inputs, size_t count) {
  value result = {0}; calls++; ok(collections_wasmtime_call(session, name, inputs, count, &result)); return result;
}
static value run(const char *name, const value *input) { return call(name, input, 1); }
static void expect(const char *name, value input, value expected) {
  value output = run(name, &input); equal(&output, &expected); clear(&input); equal(&output, &expected); clear(&output); clear(&expected);
}
static void rejected_n(const char *name, const value *inputs, size_t count, const char *message) {
  value output = u32(991); calls++; rejections++;
  wasmtime_error_t *error = collections_wasmtime_call(session, name, inputs, count, &output);
  if (!error) fprintf(stderr, "Unexpected success: %s, case %zu\n", name, rejections);
  rejects(error, message); CHECK(output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  expect("array-reverse-uint32", SEQ(WORDS(1, 2, 3)), SEQ(WORDS(3, 2, 1)));
}
static void rejected(const char *name, const value *input, const char *message) { rejected_n(name, input, 1, message); }
static int loaded(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size; bool *comma = data; if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  CHECK(!strchr(info->dlpi_name, '"') && !strchr(info->dlpi_name, '\\'));
  printf("\"%s\"", info->dlpi_name); *comma = true; return 0;
}
int main(void) {
  (void)labels; ok(collections_wasmtime_open(&session));
  value known = primitives(), inspected = run("record-inspect", &known);
  CHECK(inspected.kind == WASMTIME_COMPONENT_BOOL && inspected.of.boolean); clear(&inspected);
  value elements[19];
  for (size_t i = 0; i < 19; ++i) elements[i] = SEQ(clone(&known.of.record.data[i].val));
  inspected = call("array-check-elements", elements, 19);
  CHECK(inspected.kind == WASMTIME_COMPONENT_BOOL && inspected.of.boolean); clear(&inspected);
  for (size_t i = 0; i < 19; ++i) clear(&elements[i]);
  for (size_t i = 1; i < 19; ++i) {
    value altered = clone(&known); clear(&altered.of.record.data[i].val);
    altered.of.record.data[i].val = i == 11 ? integer(false, natural(0)) : sample(i, 0);
    inspected = run("record-inspect", &altered); CHECK(inspected.kind == WASMTIME_COMPONENT_BOOL && !inspected.of.boolean);
    clear(&altered); clear(&inspected);
  }
  for (size_t primitive = 0; primitive < 19; ++primitive) {
    char name[64]; snprintf(name, sizeof(name), "array-reverse-%s", type_labels[primitive]);
    expect(name, empty(), empty()); expect(name, SEQ(empty()), SEQ(empty()));
    for (unsigned round = 0; round < 128; ++round)
      expect(name, SEQ(SEQ(sample(primitive, round), sample(primitive, round + 1), sample(primitive, round)), empty(), SEQ(sample(primitive, round + 2))),
        SEQ(SEQ(sample(primitive, round + 2)), empty(), SEQ(sample(primitive, round), sample(primitive, round + 1), sample(primitive, round))));
    value bad = u32(77); rejected(name, &bad, "invalid WIT input");
    bad = SEQ(SEQ(sample(primitive, 0), sample(primitive == 0 ? 1 : 0, 0)));
    rejected(name, &bad, "invalid WIT input"); clear(&bad);
  }
  for (unsigned round = 0; round < 32; ++round) {
    expect("record-shuffle", packet(false), packet(true));
    expect("record-reverse", SEQ(clone(&known), primitives()), SEQ(primitives(), clone(&known)));
    expect("record-empty", empty_record(), empty_record());
    expect("record-single", one(sample(5, 1)), one(sample(5, 0)));
    expect("record-count", one(power(5120, 31)), one(power(5120, 32)));
  }
  value result = call("record-make", NULL, 0), expected = product(42, text_n("\xef\xbb\xbf\xf0\x9f\x8c\xb1\0", 8));
  equal(&result, &expected); clear(&result); clear(&expected);
  result = call("array-words", NULL, 0); expected = SEQ(SEQ(text_n("\xef\xbb\xbfLean", 7), text_n("\xf0\x9f\x8c\xb1\0", 5)), empty());
  equal(&result, &expected); clear(&result); clear(&expected);
  value inputs[] = {integer(false, power(5120, 31)), SEQ(SEQ(integer(true, power(5120, 31)), integer(false, natural(1))), empty())};
  result = call("array-add", inputs, 2); expected = SEQ(SEQ(integer(false, natural(0)), integer(false, power(5120, 32))), empty());
  equal(&result, &expected); clear(&inputs[0]); clear(&inputs[1]); clear(&result); clear(&expected);
  expect("array-total", SEQ(SEQ(power(5120, 31), power(5120, 31)), empty()), power(5121, 62));
  expect("array-size", SEQ(sample(0, 0), sample(0, 0)), (value){.kind = WASMTIME_COMPONENT_U64, .of.u64 = 2});
  expect("generate", natural(3), SEQ(sample(0, 0), sample(0, 0), sample(0, 0))); expect("generate", natural(0), empty());
  for (unsigned depth = 0; depth <= 24; ++depth) {
    value deep = depth == 24 ? u32(42) : empty(); for (unsigned level = 0; level < depth; ++level) deep = SEQ(deep);
    expect("deep", clone(&deep), deep);
  }
  value input = packet(false); result = run("record-duplicate", &input);
  CHECK(result.of.list.size == 2); equal(&result.of.list.data[0], &input); equal(&result.of.list.data[1], &input);
  value *a = &result.of.list.data[0].of.record.data[1].val.of.list.data[0].of.list.data[0].of.record.data[15].val;
  value *b = &result.of.list.data[1].of.record.data[1].val.of.list.data[0].of.list.data[0].of.record.data[15].val;
  CHECK(a->of.list.data != b->of.list.data); a->of.list.data[0].of.u8 = 7;
  CHECK(b->of.list.data[0].of.u8 == 255); equal(&result.of.list.data[1], &input); clear(&input); clear(&result);
  input = SEQ(sample(15, 1)); result = run("array-duplicate", &input);
  CHECK(result.of.list.size == 2 && result.of.list.data[0].of.list.data != result.of.list.data[1].of.list.data);
  result.of.list.data[0].of.list.data[0].of.u8 = 7; CHECK(result.of.list.data[1].of.list.data[0].of.u8 == 0 && input.of.list.data[0].of.list.data[0].of.u8 == 0);
  clear(&input); clear(&result);
  for (size_t i = 0; i < 19; ++i) {
    value bad = clone(&known); clear(&bad.of.record.data[i].val); bad.of.record.data[i].val = sample(i == 0 ? 1 : 0, 0);
    rejected("record-inspect", &bad, "invalid WIT input"); clear(&bad);
  }
  value bad = clone(&known); bad.of.record.size = 18; rejected("record-inspect", &bad, "invalid WIT input");
  bad.of.record.size = 20; rejected("record-inspect", &bad, "invalid WIT input"); bad.of.record.size = 19;
  bad.of.record.data[18].name.data[0] = 'x'; rejected("record-inspect", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(SEQ((value){.kind = WASMTIME_COMPONENT_CHAR, .of.character = 0xd800})); rejected("array-reverse-char", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(SEQ(text("\xc0\x80"))); rejected("array-reverse-string", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(SEQ(WORDS(1, 0))); rejected("array-reverse-nat", &bad, "invalid WIT input"); clear(&bad);
  bad = SEQ(SEQ(integer(true, natural(0)))); rejected("array-reverse-int", &bad, "invalid WIT input"); clear(&bad);
  bad = (value){.kind = WASMTIME_COMPONENT_LIST, .of.list = {1, NULL}}; rejected("array-reverse-uint32", &bad, "invalid WIT input");
  bad.of.list.size = SIZE_MAX; rejected("array-reverse-uint32", &bad, "16 MiB");
  value leaf = u32(7); bad.of.list.data = &leaf; bad.of.list.size = 2097153; rejected("array-reverse-uint32", &bad, "16 MiB");
  value cycle = {.kind = WASMTIME_COMPONENT_LIST}; cycle.of.list.size = 1; cycle.of.list.data = &cycle;
  rejected("deep", &cycle, "invalid WIT input"); cycle.of.list.data = NULL; cycle.of.list.size = 0;
  value deep = u32(42); for (unsigned level = 0; level < 25; ++level) deep = SEQ(deep);
  rejected("deep", &deep, "invalid WIT input"); clear(&deep);
  for (unsigned round = 0; round < 3; ++round) {
    bad = SEQ(list(200000, WASMTIME_COMPONENT_U8)); rejected("array-duplicate", &bad, "16 MiB"); clear(&bad);
    bad = natural(1000000); rejected("generate", &bad, "16 MiB"); clear(&bad);
  }
  bad = natural(30000); result = run("generate", &bad); CHECK(result.of.list.size == 30000);
  for (size_t i = 0; i < 30000; ++i) CHECK(result.of.list.data[i].kind == WASMTIME_COMPONENT_ENUM && result.of.list.data[i].of.enumeration.size == 4);
  clear(&bad); clear(&result); clear(&known);
  input = packet(false); result = run("record-shuffle", &input); expected = packet(true); clear(&input);
  collections_wasmtime_close(session); session = NULL;
  equal(&result, &expected); clear(&result); clear(&expected);
  printf("{\"hostVersion\":\"%s\",\"checks\":%zu,\"calls\":%zu,\"rejections\":%zu,\"primitives\":19,\"records\":7,\"copiesSurviveSessionClose\":true,\"results\":[],\"loadedLibraries\":[", WASMTIME_VERSION, checks, calls, rejections);
  bool comma = false; dl_iterate_phdr(loaded, &comma); puts("]}");
}
