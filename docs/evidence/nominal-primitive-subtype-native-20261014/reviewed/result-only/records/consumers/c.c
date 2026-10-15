#define PRIMITIVE_RESULT_ONLY
#define PRIMITIVE_PARAMETER_PREFIX "value"
#include <nominalprimitivesubtypes.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef PRIMITIVE_PARAMETER_PREFIX
#define PRIMITIVE_PARAMETER_PREFIX "arg"
#endif
typedef nominalprimitivesubtypes_packet Packet;
typedef nominalprimitivesubtypes_raw_packet RawPacket;
typedef nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value Maybe;
typedef nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span Group;
typedef nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value Choice;
typedef nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span Choices;
#ifndef PRIMITIVE_RESULT_ONLY
typedef nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value Product;
#endif
typedef nominalprimitivesubtypes_pair Pair;
typedef nominalprimitivesubtypes_event Event;
static unsigned checks, rejections, snapshot_controls;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
#define OK(call) ((call) == NOMINALPRIMITIVESUBTYPES_STATUS_OK)
#define MAYBE_INIT nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_init
#define MAYBE_CLEAR nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear
#define GROUP_CLEAR nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear
#define CHOICE_INIT nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_init
#define CHOICE_CLEAR nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear
#define PRODUCT_INIT nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_init
#define PRODUCT_CLEAR nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear

static const uint8_t original_bytes[] = {0, 128, 255};
#ifndef PRIMITIVE_RESULT_ONLY
static const uint8_t normalized_bytes[] = {0, 128, 255, 255};
#endif
static const uint8_t produced_bytes[] = {0, 1, 2, 3, 4, 5, 128, 254, 255};
static const char produced_text[] = "long λ text";
#ifndef PRIMITIVE_RESULT_ONLY
static const char unicode_text[] = "a\0λ😀";
static const char unicode_normalized[] = "a\0λ😀!";
#endif

/* Explicit field copies avoid type-punning between nominal Packet and RawPacket. */
#define COPY_FIELDS(to, from) do { \
  (to)->unit_value = (from)->unit_value; (to)->bool_value = (from)->bool_value; \
  (to)->uint8_value = (from)->uint8_value; (to)->uint16_value = (from)->uint16_value; \
  (to)->uint32_value = (from)->uint32_value; (to)->uint64_value = (from)->uint64_value; \
  (to)->int8_value = (from)->int8_value; (to)->int16_value = (from)->int16_value; \
  (to)->int32_value = (from)->int32_value; (to)->int64_value = (from)->int64_value; \
  mpz_set((to)->nat_value, (from)->nat_value); mpz_set((to)->int_value, (from)->int_value); \
  (to)->float32_value = (from)->float32_value; (to)->float64_value = (from)->float64_value; \
  (to)->text_value = (from)->text_value; (to)->bytes_value = (from)->bytes_value; \
  (to)->char_value = (from)->char_value; (to)->usize_value = (from)->usize_value; \
  (to)->isize_value = (from)->isize_value; mpz_set((to)->digit, (from)->digit); \
} while (0)
static void packet(Packet *p) {
  p->unit_value = 0; p->bool_value = true;
  p->uint8_value = 42; p->uint16_value = 42; p->uint32_value = 42; p->uint64_value = 42;
  p->int8_value = -42; p->int16_value = -42; p->int32_value = -42; p->int64_value = -42;
  mpz_set_ui(p->nat_value, 42); mpz_set_si(p->int_value, -42);
  p->float32_value = 1.5f; p->float64_value = 1.5;
  p->text_value = (nominalprimitivesubtypes_string){"a", 1, NULL, NULL};
  p->bytes_value = (nominalprimitivesubtypes_bytes){original_bytes, sizeof(original_bytes), NULL, NULL};
  p->char_value = 97; p->usize_value = 42; p->isize_value = -42; mpz_set_ui(p->digit, 2);
}
static void produced(Packet *p) {
  packet(p);
  p->uint8_value = 200; p->uint16_value = 200; p->uint32_value = 200; p->uint64_value = 200;
  p->int8_value = 120; p->int16_value = 120; p->int32_value = 120; p->int64_value = 120;
  mpz_set_ui(p->nat_value, 0); mpz_setbit(p->nat_value, 100); mpz_neg(p->int_value, p->nat_value);
  p->float32_value = 12.5f; p->float64_value = 12.5;
  p->text_value = (nominalprimitivesubtypes_string){produced_text, sizeof(produced_text) - 1, NULL, NULL};
  p->bytes_value = (nominalprimitivesubtypes_bytes){produced_bytes, sizeof(produced_bytes), NULL, NULL};
  p->char_value = 955; p->usize_value = 200; p->isize_value = 200;
}
#ifndef PRIMITIVE_RESULT_ONLY
static void normalized(Packet *p) {
  packet(p);
  p->uint8_value = 44; p->uint16_value = 44; p->uint32_value = 44; p->uint64_value = 44;
  p->int8_value = -40; p->int16_value = -40; p->int32_value = -40; p->int64_value = -40;
  mpz_set_ui(p->nat_value, 44); mpz_set_si(p->int_value, -40);
  p->float32_value = -1.5f; p->float64_value = -1.5;
  p->text_value = (nominalprimitivesubtypes_string){"a!", 2, NULL, NULL};
  p->bytes_value = (nominalprimitivesubtypes_bytes){normalized_bytes, sizeof(normalized_bytes), NULL, NULL};
  p->char_value = 98; p->usize_value = 44; p->isize_value = -40;
}
#endif
static int same_data(const void *a, size_t na, const void *b, size_t nb) {
  return na == nb && (!na || (a && b && memcmp(a, b, na) == 0));
}
static int same_packet(const Packet *a, const Packet *b) {
  return a->unit_value == b->unit_value && a->bool_value == b->bool_value
    && a->uint8_value == b->uint8_value && a->uint16_value == b->uint16_value
    && a->uint32_value == b->uint32_value && a->uint64_value == b->uint64_value
    && a->int8_value == b->int8_value && a->int16_value == b->int16_value
    && a->int32_value == b->int32_value && a->int64_value == b->int64_value
    && mpz_cmp(a->nat_value, b->nat_value) == 0 && mpz_cmp(a->int_value, b->int_value) == 0
    && memcmp(&a->float32_value, &b->float32_value, sizeof(float)) == 0
    && memcmp(&a->float64_value, &b->float64_value, sizeof(double)) == 0
    && same_data(a->text_value.data, a->text_value.length, b->text_value.data, b->text_value.length)
    && same_data(a->bytes_value.data, a->bytes_value.length, b->bytes_value.data, b->bytes_value.length)
    && a->char_value == b->char_value && a->usize_value == b->usize_value
    && a->isize_value == b->isize_value && mpz_cmp(a->digit, b->digit) == 0;
}
/* Capture data independently, plus the original pointers and ownership descriptors. */
typedef struct { Packet value; nominalprimitivesubtypes_string text; nominalprimitivesubtypes_bytes bytes; } Snapshot;
static void capture(Snapshot *out, const Packet *in) {
  nominalprimitivesubtypes_packet_init(&out->value); COPY_FIELDS(&out->value, in);
  out->text = in->text_value; out->bytes = in->bytes_value;
  void *text = malloc(in->text_value.length ? in->text_value.length : 1);
  void *bytes = malloc(in->bytes_value.length ? in->bytes_value.length : 1);
  if (!text || !bytes) { fprintf(stderr, "snapshot allocation failed\n"); exit(2); }
  if (in->text_value.length) memcpy(text, in->text_value.data, in->text_value.length);
  if (in->bytes_value.length) memcpy(bytes, in->bytes_value.data, in->bytes_value.length);
  out->value.text_value = (nominalprimitivesubtypes_string){text, in->text_value.length, text, free};
  out->value.bytes_value = (nominalprimitivesubtypes_bytes){bytes, in->bytes_value.length, bytes, free};
}
static int unchanged(const Packet *p, const Snapshot *s) {
  return same_packet(p, &s->value)
    && p->text_value.data == s->text.data && p->text_value.owner == s->text.owner && p->text_value.release == s->text.release
    && p->bytes_value.data == s->bytes.data && p->bytes_value.owner == s->bytes.owner && p->bytes_value.release == s->bytes.release;
}
static void clear_snapshot(Snapshot *s) { nominalprimitivesubtypes_packet_clear(&s->value); }
static int same_raw(const RawPacket *raw, const Snapshot *s) {
  Packet p; nominalprimitivesubtypes_packet_init(&p); COPY_FIELDS(&p, raw);
  const int equal = unchanged(&p, s);
  /* The projected packet borrows the raw descriptors, including owned outputs. */
  p.text_value.owner = NULL; p.text_value.release = NULL; p.bytes_value.owner = NULL; p.bytes_value.release = NULL;
  nominalprimitivesubtypes_packet_clear(&p); return equal;
}
static int produced_group(const Group *g, const Packet *p) {
  return g->data && g->length == 2 && !g->data[0].has_value && g->data[1].has_value && same_packet(&g->data[1].value, p);
}
#ifndef PRIMITIVE_RESULT_ONLY
static int rejected(nominalprimitivesubtypes_status status, const nominalprimitivesubtypes_error *error, const char *expected) {
  if (status != NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT || error->code != NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT
    || !same_data(error->message, error->message_length, expected, strlen(expected))) return 0;
  ++rejections; return 1;
}
static void valid_echo(Packet *input, const Packet *expected, int second) {
  nominalprimitivesubtypes_error error = {0}; Packet output; Snapshot before;
  nominalprimitivesubtypes_packet_init(&output); capture(&before, input);
  CHECK(OK(second ? nominalprimitivesubtypes_echo_b(input, &output, &error) : nominalprimitivesubtypes_echo_a(input, &output, &error)));
  CHECK(same_packet(&output, expected)); CHECK(unchanged(input, &before));
  CHECK(!output.bytes_value.length || output.bytes_value.data != input->bytes_value.data);
  CHECK(!output.text_value.length || output.text_value.data != input->text_value.data);
  nominalprimitivesubtypes_packet_clear(&output); clear_snapshot(&before);
}
static void invalid_echo(Packet *input, Packet *output, const char *expected, int second) {
  nominalprimitivesubtypes_error error = {0}; Snapshot input_before, output_before;
  capture(&input_before, input); capture(&output_before, output);
  CHECK(rejected(second ? nominalprimitivesubtypes_echo_b(input, output, &error) : nominalprimitivesubtypes_echo_a(input, output, &error), &error, expected));
  CHECK(unchanged(input, &input_before)); CHECK(unchanged(output, &output_before));
  clear_snapshot(&input_before); clear_snapshot(&output_before);
}
#endif
static void invalid_result(Packet *p) {
  nominalprimitivesubtypes_error error = {0}; RawPacket raw; Maybe output; Snapshot before;
  nominalprimitivesubtypes_raw_packet_init(&raw); COPY_FIELDS(&raw, p); MAYBE_INIT(&output); capture(&before, p);
  CHECK(OK(nominalprimitivesubtypes_produce(&raw, &output, &error)) && !output.has_value);
  CHECK(same_raw(&raw, &before));
  MAYBE_CLEAR(&output); nominalprimitivesubtypes_raw_packet_clear(&raw); clear_snapshot(&before);
}
static void snapshot_tests(void) {
  Packet a, b; nominalprimitivesubtypes_packet_init(&a); nominalprimitivesubtypes_packet_init(&b); packet(&a); packet(&b);
  Snapshot before; capture(&before, &a);
#define MUTATION(change) do { change; CHECK(!unchanged(&b, &before)); ++snapshot_controls; COPY_FIELDS(&b, &a); } while (0)
  MUTATION(b.unit_value = 1); MUTATION(b.bool_value = false);
  MUTATION(b.uint8_value++); MUTATION(b.uint16_value++); MUTATION(b.uint32_value++); MUTATION(b.uint64_value++);
  MUTATION(b.int8_value++); MUTATION(b.int16_value++); MUTATION(b.int32_value++); MUTATION(b.int64_value++);
  MUTATION(mpz_add_ui(b.nat_value, b.nat_value, 1)); MUTATION(mpz_sub_ui(b.int_value, b.int_value, 1));
  MUTATION(b.float32_value = -0.0f); MUTATION(b.float64_value = -0.0);
  MUTATION(b.text_value.length = 0); MUTATION(b.bytes_value.length = 0);
  MUTATION(b.char_value++); MUTATION(b.usize_value++); MUTATION(b.isize_value++); MUTATION(mpz_set_ui(b.digit, 1));
#undef MUTATION
  clear_snapshot(&before); a.float32_value = 0.0f; a.float64_value = 0.0; COPY_FIELDS(&b, &a); capture(&before, &a);
  b.float32_value = -0.0f; CHECK(!unchanged(&b, &before)); ++snapshot_controls;
  b.float32_value = 0.0f; b.float64_value = -0.0; CHECK(!unchanged(&b, &before)); ++snapshot_controls;
  clear_snapshot(&before); nominalprimitivesubtypes_packet_clear(&a); nominalprimitivesubtypes_packet_clear(&b);
}
int main(void) {
  nominalprimitivesubtypes_error error = {0}; snapshot_tests();
  Packet p, expected; RawPacket raw; Maybe output; Group group = {0}; Pair pair; Event event;
  nominalprimitivesubtypes_packet_init(&p); nominalprimitivesubtypes_packet_init(&expected);
  nominalprimitivesubtypes_raw_packet_init(&raw); MAYBE_INIT(&output);
  nominalprimitivesubtypes_pair_init(&pair); nominalprimitivesubtypes_event_init(&event);
  produced(&expected); COPY_FIELDS(&raw, &expected); Snapshot original; capture(&original, &expected);
  uint32_t bits = 0; CHECK(OK(nominalprimitivesubtypes_word_bits(&bits, &error)) && bits == 64);
  CHECK(OK(nominalprimitivesubtypes_produce(&raw, &output, &error)) && output.has_value && same_packet(&output.value, &expected));
  CHECK(OK(nominalprimitivesubtypes_produce_group(&raw, &group, &error)) && produced_group(&group, &expected));
  CHECK(OK(nominalprimitivesubtypes_produce_pair(&raw, &pair, &error)) && produced_group(&pair.left, &expected) && produced_group(&pair.right, &expected));
  CHECK(OK(nominalprimitivesubtypes_produce_event(&raw, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX && same_packet(&event.cases.box.value, &expected));
  CHECK(OK(nominalprimitivesubtypes_produce_choices(&raw, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
    && event.cases.choices.values.length == 3 && !event.cases.choices.values.data[0].has_value
    && event.cases.choices.values.data[1].has_value && event.cases.choices.values.data[1].value.is_ok && same_packet(&event.cases.choices.values.data[1].value.ok, &expected)
    && event.cases.choices.values.data[2].has_value && !event.cases.choices.values.data[2].value.is_ok && same_packet(&event.cases.choices.values.data[2].value.error, &expected));
  CHECK(same_raw(&raw, &original)); clear_snapshot(&original);
  MAYBE_CLEAR(&output); MAYBE_INIT(&output); GROUP_CLEAR(&group);
  nominalprimitivesubtypes_pair_clear(&pair); nominalprimitivesubtypes_pair_init(&pair);
  nominalprimitivesubtypes_event_clear(&event); nominalprimitivesubtypes_event_init(&event);
#ifndef PRIMITIVE_RESULT_ONLY
  Packet sentinel; nominalprimitivesubtypes_packet_init(&sentinel); packet(&p);
  CHECK(OK(nominalprimitivesubtypes_echo_a(&p, &sentinel, &error)) && same_packet(&sentinel, &p));
#define STRICT(change, field, constructor) do { \
  packet(&p); change; COPY_FIELDS(&raw, &p); Snapshot before; capture(&before, &p); \
  CHECK(OK(nominalprimitivesubtypes_produce(&raw, &output, &error)) && output.has_value && same_packet(&output.value, &p)); \
  CHECK(same_raw(&raw, &before)); clear_snapshot(&before); MAYBE_CLEAR(&output); MAYBE_INIT(&output); \
  invalid_echo(&p, &sentinel, PRIMITIVE_PARAMETER_PREFIX "0." field " was rejected by NominalPrimitiveSubtypes." constructor, 0); \
} while (0)
  STRICT(p.uint8_value = 100, "uint8Value", "uint8A"); STRICT(p.uint16_value = 100, "uint16Value", "uint16A");
  STRICT(p.uint32_value = 100, "uint32Value", "uint32A"); STRICT(p.uint64_value = 100, "uint64Value", "uint64A");
  STRICT(p.int8_value = 100, "int8Value", "int8A"); STRICT(p.int16_value = 100, "int16Value", "int16A");
  STRICT(p.int32_value = 100, "int32Value", "int32A"); STRICT(p.int64_value = 100, "int64Value", "int64A");
  STRICT(mpz_set_ui(p.nat_value, 100), "natValue", "natA"); STRICT(mpz_set_ui(p.int_value, 100), "intValue", "intA");
  STRICT(p.float32_value = 12.5f, "float32Value", "float32A"); STRICT(p.float64_value = 12.5, "float64Value", "float64A");
  STRICT(p.text_value.data = produced_text; p.text_value.length = sizeof(produced_text) - 1, "textValue", "textA");
  STRICT(p.bytes_value.data = produced_bytes; p.bytes_value.length = sizeof(produced_bytes), "bytesValue", "bytesA");
  STRICT(p.char_value = 955, "charValue", "charA");
  STRICT(p.usize_value = 100, "usizeValue", "usizeA"); STRICT(p.isize_value = 100, "isizeValue", "isizeA");
#undef STRICT
#define INVALID(change, field, constructor) do { packet(&p); change; invalid_result(&p); invalid_echo(&p, &sentinel, PRIMITIVE_PARAMETER_PREFIX "0." field " was rejected by NominalPrimitiveSubtypes." constructor, 0); } while (0)
#else
#define INVALID(change, field, constructor) do { packet(&p); change; invalid_result(&p); } while (0)
#endif
  INVALID(p.bool_value = false, "boolValue", "boolA");
  INVALID(p.uint8_value = 43, "uint8Value", "uint8A"); INVALID(p.uint16_value = 43, "uint16Value", "uint16A");
  INVALID(p.uint32_value = 43, "uint32Value", "uint32A"); INVALID(p.uint64_value = 43, "uint64Value", "uint64A");
  INVALID(p.int8_value = -43, "int8Value", "int8A"); INVALID(p.int16_value = -43, "int16Value", "int16A");
  INVALID(p.int32_value = -43, "int32Value", "int32A"); INVALID(p.int64_value = -43, "int64Value", "int64A");
  INVALID(mpz_set_ui(p.nat_value, 43), "natValue", "natA"); INVALID(mpz_set_si(p.int_value, -43), "intValue", "intA");
  INVALID(p.float32_value = INFINITY, "float32Value", "float32A"); INVALID(p.float64_value = INFINITY, "float64Value", "float64A");
  INVALID(p.text_value.length = 0, "textValue", "textA"); INVALID(p.bytes_value.length = 0, "bytesValue", "bytesA");
  INVALID(p.char_value = 0, "charValue", "charA"); INVALID(p.usize_value = 43, "usizeValue", "usizeA");
  INVALID(p.isize_value = -43, "isizeValue", "isizeA");
#undef INVALID
  packet(&p); mpz_set_ui(p.digit, 3); invalid_result(&p);
#ifndef PRIMITIVE_RESULT_ONLY
  invalid_echo(&p, &sentinel, PRIMITIVE_PARAMETER_PREFIX "0.digit is not below its Fin 3 bound", 0);
#endif
  packet(&p); mpz_set_ui(p.nat_value, 43); COPY_FIELDS(&raw, &p);
  CHECK(OK(nominalprimitivesubtypes_produce_group(&raw, &group, &error)) && group.length == 1 && !group.data[0].has_value);
  CHECK(OK(nominalprimitivesubtypes_produce_pair(&raw, &pair, &error)) && pair.left.length == 1 && !pair.left.data[0].has_value && pair.right.length == 1 && !pair.right.data[0].has_value);
  CHECK(OK(nominalprimitivesubtypes_produce_event(&raw, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_EMPTY);
  CHECK(OK(nominalprimitivesubtypes_produce_choices(&raw, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES && event.cases.choices.values.length == 1 && !event.cases.choices.values.data[0].has_value);
#ifdef PRIMITIVE_RESULT_ONLY
  for (unsigned round = 0; round < 256; ++round) {
    produced(&expected); mpz_add_ui(expected.nat_value, expected.nat_value, 2 * round); COPY_FIELDS(&raw, &expected); Snapshot before; capture(&before, &expected);
    CHECK(OK(nominalprimitivesubtypes_produce(&raw, &output, &error)) && output.has_value && same_packet(&output.value, &expected));
    CHECK(same_raw(&raw, &before)); clear_snapshot(&before); MAYBE_CLEAR(&output); MAYBE_INIT(&output);
  }
#else
  Packet a, b, n; nominalprimitivesubtypes_packet_init(&a); nominalprimitivesubtypes_packet_init(&b); nominalprimitivesubtypes_packet_init(&n);
  packet(&a); packet(&b); b.bool_value = false; normalized(&n);
  valid_echo(&a, &a, 0); valid_echo(&b, &n, 1);
  Snapshot before_a, before_b, before_sentinel; capture(&before_a, &a); capture(&before_b, &b); capture(&before_sentinel, &sentinel);
  CHECK(rejected(nominalprimitivesubtypes_refuse_unit(&a, &sentinel, &error), &error, PRIMITIVE_PARAMETER_PREFIX "0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject"));
  CHECK(unchanged(&a, &before_a) && unchanged(&sentinel, &before_sentinel)); clear_snapshot(&before_sentinel);
  Product product; PRODUCT_INIT(&product);
  CHECK(OK(nominalprimitivesubtypes_combine(&a, &b, &product, &error)) && same_packet(&product.fst, &a) && same_packet(&product.snd, &n));
  CHECK(unchanged(&a, &before_a) && unchanged(&b, &before_b));
  clear_snapshot(&before_a); clear_snapshot(&before_b); PRODUCT_CLEAR(&product);
#define EDGE(change, want) do { packet(&p); p.bool_value = false; normalized(&expected); change; want; valid_echo(&p, &expected, 1); } while (0)
  EDGE(p.uint8_value = UINT8_MAX - 1, expected.uint8_value = 0);
  EDGE(p.uint16_value = UINT16_MAX - 1, expected.uint16_value = 0);
  EDGE(p.uint32_value = UINT32_MAX - 1, expected.uint32_value = 0);
  EDGE(p.uint64_value = UINT64_MAX - 1, expected.uint64_value = 0);
  EDGE(p.int8_value = INT8_MAX - 1, expected.int8_value = INT8_MIN);
  EDGE(p.int16_value = INT16_MAX - 1, expected.int16_value = INT16_MIN);
  EDGE(p.int32_value = INT32_MAX - 1, expected.int32_value = INT32_MIN);
  EDGE(p.int64_value = INT64_MAX - 1, expected.int64_value = INT64_MIN);
  EDGE(p.usize_value = UINT64_MAX - 1, expected.usize_value = 0);
  EDGE(p.isize_value = INT64_MAX - 1, expected.isize_value = INT64_MIN);
  EDGE(mpz_set_ui(p.nat_value, 0); mpz_setbit(p.nat_value, 100), mpz_set(expected.nat_value, p.nat_value); mpz_add_ui(expected.nat_value, expected.nat_value, 2));
  EDGE(mpz_set_ui(p.int_value, 0); mpz_setbit(p.int_value, 100); mpz_neg(p.int_value, p.int_value), mpz_add_ui(expected.int_value, p.int_value, 2));
  EDGE(p.float32_value = 0.0f, expected.float32_value = -0.0f); EDGE(p.float32_value = -0.0f, expected.float32_value = 0.0f);
  EDGE(p.float64_value = 0.0, expected.float64_value = -0.0); EDGE(p.float64_value = -0.0, expected.float64_value = 0.0);
  EDGE(p.text_value.data = unicode_text; p.text_value.length = sizeof(unicode_text) - 1, expected.text_value.data = unicode_normalized; expected.text_value.length = sizeof(unicode_normalized) - 1);
  EDGE(p.char_value = 128512, expected.char_value = 128512);
  const uint8_t appended[] = {255};
  EDGE(p.bytes_value.length = 0, expected.bytes_value.data = appended; expected.bytes_value.length = 1);
#undef EDGE
  const double nonfinite[] = {NAN, INFINITY, -INFINITY};
  for (unsigned i = 0; i < 3; ++i) {
    packet(&p); p.bool_value = false; p.float32_value = (float)nonfinite[i];
    invalid_echo(&p, &sentinel, PRIMITIVE_PARAMETER_PREFIX "0.float32Value was rejected by NominalPrimitiveSubtypes.float32B", 1);
    p.bool_value = true; invalid_result(&p);
    packet(&p); p.bool_value = false; p.float64_value = nonfinite[i];
    invalid_echo(&p, &sentinel, PRIMITIVE_PARAMETER_PREFIX "0.float64Value was rejected by NominalPrimitiveSubtypes.float64B", 1);
    p.bool_value = true; invalid_result(&p);
  }
  Maybe left_items[2], right_items[3]; Snapshot left_before[2], right_before[3];
  for (unsigned i = 0; i < 2; ++i) { MAYBE_INIT(&left_items[i]); COPY_FIELDS(&left_items[i].value, &a); left_items[i].has_value = i == 1; }
  for (unsigned i = 0; i < 3; ++i) { MAYBE_INIT(&right_items[i]); COPY_FIELDS(&right_items[i].value, &b); right_items[i].has_value = i != 1; }
  const Group left = {left_items, 2, NULL, NULL}, right = {right_items, 3, NULL, NULL};
  const Pair input_pair = {left, right};
  CHECK(OK(nominalprimitivesubtypes_aliases(&left, &right, &group, &error)) && group.length == 5 && !group.data[0].has_value
    && group.data[1].has_value && same_packet(&group.data[1].value, &a)
    && group.data[2].has_value && same_packet(&group.data[2].value, &n) && !group.data[3].has_value
    && group.data[4].has_value && same_packet(&group.data[4].value, &n));
  CHECK(OK(nominalprimitivesubtypes_echo_pair(&input_pair, &pair, &error)) && produced_group(&pair.left, &a)
    && pair.right.length == 3 && pair.right.data[0].has_value && same_packet(&pair.right.data[0].value, &n)
    && !pair.right.data[1].has_value && pair.right.data[2].has_value && same_packet(&pair.right.data[2].value, &n));
  for (unsigned round = 0; round < 256; ++round) {
    const unsigned position = round % 3;
    right_items[position].has_value = 1; mpz_set_ui(right_items[position].value.nat_value, 43);
    for (unsigned i = 0; i < 2; ++i) capture(&left_before[i], &left_items[i].value);
    for (unsigned i = 0; i < 3; ++i) capture(&right_before[i], &right_items[i].value);
    const Group saved_left = pair.left, saved_right = pair.right;
    Snapshot old_left, old_right, old_last;
    capture(&old_left, &pair.left.data[1].value); capture(&old_right, &pair.right.data[0].value); capture(&old_last, &pair.right.data[2].value);
    char message[200]; snprintf(message, sizeof(message), PRIMITIVE_PARAMETER_PREFIX "0.right[%u]?.natValue was rejected by NominalPrimitiveSubtypes.natB", position);
    CHECK(rejected(nominalprimitivesubtypes_echo_pair(&input_pair, &pair, &error), &error, message));
    CHECK(pair.left.data == saved_left.data && pair.right.data == saved_right.data && pair.left.length == 2 && pair.right.length == 3
      && pair.left.owner == saved_left.owner && pair.left.release == saved_left.release
      && pair.right.owner == saved_right.owner && pair.right.release == saved_right.release
      && !pair.left.data[0].has_value && pair.left.data[1].has_value
      && pair.right.data[0].has_value && !pair.right.data[1].has_value && pair.right.data[2].has_value
      && unchanged(&pair.left.data[1].value, &old_left) && unchanged(&pair.right.data[0].value, &old_right)
      && unchanged(&pair.right.data[2].value, &old_last));
    CHECK(input_pair.left.data == left_items && input_pair.right.data == right_items && input_pair.left.length == 2 && input_pair.right.length == 3
      && !input_pair.left.owner && !input_pair.left.release && !input_pair.right.owner && !input_pair.right.release);
    for (unsigned i = 0; i < 2; ++i) { CHECK(left_items[i].has_value == (i == 1) && unchanged(&left_items[i].value, &left_before[i])); clear_snapshot(&left_before[i]); }
    for (unsigned i = 0; i < 3; ++i) { CHECK(right_items[i].has_value == (i != 1 || i == position) && unchanged(&right_items[i].value, &right_before[i])); clear_snapshot(&right_before[i]); }
    clear_snapshot(&old_left); clear_snapshot(&old_right); clear_snapshot(&old_last);
    right_items[position].has_value = position != 1; mpz_set_ui(right_items[position].value.nat_value, 42);
    valid_echo(&b, &n, 1);
  }
  Event input_event; nominalprimitivesubtypes_event_init(&input_event);
  Choice choices[3]; for (unsigned i = 0; i < 3; ++i) CHOICE_INIT(&choices[i]);
  for (unsigned second = 0; second < 2; ++second) {
    nominalprimitivesubtypes_status (*call)(const Event *, Event *, nominalprimitivesubtypes_error *) = second ? nominalprimitivesubtypes_echo_event_b : nominalprimitivesubtypes_echo_event_a;
    CHECK(OK(nominalprimitivesubtypes_event_select(&input_event, NOMINALPRIMITIVESUBTYPES_EVENT_KIND_EMPTY)));
    CHECK(OK(call(&input_event, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_EMPTY
      && input_event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_EMPTY);
    CHECK(OK(nominalprimitivesubtypes_event_select(&input_event, NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX)));
    COPY_FIELDS(&input_event.cases.box.value, second ? &b : &a);
    Snapshot box_before; capture(&box_before, &input_event.cases.box.value);
    CHECK(OK(call(&input_event, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX && same_packet(&event.cases.box.value, second ? &n : &a)
      && input_event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX && unchanged(&input_event.cases.box.value, &box_before));
    clear_snapshot(&box_before);
    mpz_set_ui(input_event.cases.box.value.nat_value, 43);
    Snapshot bad_box, saved_box;
    capture(&bad_box, &input_event.cases.box.value); capture(&saved_box, &event.cases.box.value);
    char message[240];
    snprintf(message, sizeof(message), PRIMITIVE_PARAMETER_PREFIX "0.box.value.natValue was rejected by NominalPrimitiveSubtypes.nat%s", second ? "B" : "A");
    CHECK(rejected(call(&input_event, &event, &error), &error, message));
    CHECK(input_event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX && unchanged(&input_event.cases.box.value, &bad_box)
      && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX && unchanged(&event.cases.box.value, &saved_box));
    clear_snapshot(&bad_box); clear_snapshot(&saved_box);
    mpz_set_ui(input_event.cases.box.value.nat_value, 42);
    CHECK(OK(call(&input_event, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_BOX
      && same_packet(&event.cases.box.value, second ? &n : &a));
    CHECK(OK(nominalprimitivesubtypes_event_select(&input_event, NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES)));
    choices[0].has_value = 0; choices[1].has_value = 1; choices[1].value.is_ok = 1; choices[2].has_value = 1; choices[2].value.is_ok = 0;
    COPY_FIELDS(&choices[1].value.ok, second ? &b : &a); COPY_FIELDS(&choices[2].value.error, second ? &a : &b);
    input_event.cases.choices.values = (Choices){choices, 3, NULL, NULL};
    Snapshot ok_before, error_before; capture(&ok_before, &choices[1].value.ok); capture(&error_before, &choices[2].value.error);
    CHECK(OK(call(&input_event, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
      && event.cases.choices.values.length == 3 && !event.cases.choices.values.data[0].has_value
      && event.cases.choices.values.data[1].has_value && event.cases.choices.values.data[1].value.is_ok
      && same_packet(&event.cases.choices.values.data[1].value.ok, second ? &n : &a)
      && event.cases.choices.values.data[2].has_value && !event.cases.choices.values.data[2].value.is_ok
      && same_packet(&event.cases.choices.values.data[2].value.error, second ? &a : &n)
      && input_event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
      && input_event.cases.choices.values.data == choices && input_event.cases.choices.values.length == 3
      && !input_event.cases.choices.values.owner && !input_event.cases.choices.values.release
      && !choices[0].has_value && choices[1].has_value && choices[1].value.is_ok
      && choices[2].has_value && !choices[2].value.is_ok
      && unchanged(&choices[1].value.ok, &ok_before) && unchanged(&choices[2].value.error, &error_before));
    clear_snapshot(&ok_before); clear_snapshot(&error_before);
    for (unsigned branch = 0; branch < 2; ++branch) {
      Packet *bad = branch ? &choices[2].value.error : &choices[1].value.ok;
      mpz_set_ui(bad->nat_value, 43);
      Snapshot input_ok, input_error, output_ok, output_error;
      capture(&input_ok, &choices[1].value.ok); capture(&input_error, &choices[2].value.error);
      const Choices saved = event.cases.choices.values;
      capture(&output_ok, &saved.data[1].value.ok); capture(&output_error, &saved.data[2].value.error);
      snprintf(message, sizeof(message), PRIMITIVE_PARAMETER_PREFIX "0.choices.values[%u]?.%s.natValue was rejected by NominalPrimitiveSubtypes.nat%s",
        branch + 1, branch ? "error" : "ok", (second != branch) ? "B" : "A");
      CHECK(rejected(call(&input_event, &event, &error), &error, message));
      CHECK(input_event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
        && input_event.cases.choices.values.data == choices && input_event.cases.choices.values.length == 3
        && !input_event.cases.choices.values.owner && !input_event.cases.choices.values.release
        && !choices[0].has_value && choices[1].has_value && choices[1].value.is_ok
        && choices[2].has_value && !choices[2].value.is_ok
        && unchanged(&choices[1].value.ok, &input_ok) && unchanged(&choices[2].value.error, &input_error)
        && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
        && event.cases.choices.values.data == saved.data && event.cases.choices.values.length == saved.length
        && event.cases.choices.values.owner == saved.owner && event.cases.choices.values.release == saved.release
        && !saved.data[0].has_value && saved.data[1].has_value && saved.data[1].value.is_ok
        && saved.data[2].has_value && !saved.data[2].value.is_ok
        && unchanged(&saved.data[1].value.ok, &output_ok) && unchanged(&saved.data[2].value.error, &output_error));
      clear_snapshot(&input_ok); clear_snapshot(&input_error); clear_snapshot(&output_ok); clear_snapshot(&output_error);
      mpz_set_ui(bad->nat_value, 42);
      CHECK(OK(call(&input_event, &event, &error)) && event.kind == NOMINALPRIMITIVESUBTYPES_EVENT_KIND_CHOICES
        && event.cases.choices.values.length == 3 && !event.cases.choices.values.data[0].has_value
        && event.cases.choices.values.data[1].has_value && event.cases.choices.values.data[1].value.is_ok
        && event.cases.choices.values.data[2].has_value && !event.cases.choices.values.data[2].value.is_ok
        && same_packet(&event.cases.choices.values.data[1].value.ok, second ? &n : &a)
        && same_packet(&event.cases.choices.values.data[2].value.error, second ? &a : &n));
    }
  }
  packet(&a); packet(&b); mpz_set_ui(a.nat_value, 43); mpz_set_ui(b.digit, 3); PRODUCT_INIT(&product);
  CHECK(rejected(nominalprimitivesubtypes_combine(&a, &b, &product, &error), &error, PRIMITIVE_PARAMETER_PREFIX "1.digit is not below its Fin 3 bound"));
  PRODUCT_CLEAR(&product);
  nominalprimitivesubtypes_event_clear(&input_event);
  for (unsigned i = 0; i < 3; ++i) { CHOICE_CLEAR(&choices[i]); MAYBE_CLEAR(&right_items[i]); }
  for (unsigned i = 0; i < 2; ++i) MAYBE_CLEAR(&left_items[i]);
  nominalprimitivesubtypes_packet_clear(&a); nominalprimitivesubtypes_packet_clear(&b); nominalprimitivesubtypes_packet_clear(&n);
  nominalprimitivesubtypes_packet_clear(&sentinel);
#endif
  MAYBE_CLEAR(&output); GROUP_CLEAR(&group); nominalprimitivesubtypes_pair_clear(&pair); nominalprimitivesubtypes_event_clear(&event);
  nominalprimitivesubtypes_packet_clear(&p); nominalprimitivesubtypes_packet_clear(&expected); nominalprimitivesubtypes_raw_packet_clear(&raw);
  printf("{\"checks\":%u,\"rejections\":%u,\"rounds\":256,\"snapshotControls\":%u,\"wordBits\":64}\n", checks, rejections, snapshot_controls);
  return 0;
}
