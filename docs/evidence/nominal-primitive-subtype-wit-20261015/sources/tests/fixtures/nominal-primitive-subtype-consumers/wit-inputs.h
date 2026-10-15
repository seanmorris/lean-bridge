/* Independent input corpus for the full nineteen-base API. Every call owns its carrier trees. */
#define REJECTED_BY " was rejected by NominalPrimitiveSubtypes."
static void expect_two(const char *label, value first, value second, value expected) {
  value args[] = {first, second}; value out = success_many(label, args, 2, expected); clear(&out);
}
static void native_refused(const char *label, value input, const char *cause) {
  refused_many(label, &input, 1, cause, false);
}
static void native_refused_two(const char *label, value first, value second, const char *cause) {
  value args[] = {first, second}; refused_many(label, args, 2, cause, false);
}
static void host_refused_two(const char *label, value first, value second) {
  value args[] = {first, second};
  refused_many(label, args, 2, "Unknown export, invalid WIT input or 16 MiB conversion limit", true);
}
/* Left groups carry one A packet; right groups carry two B packets around a gap. */
static value left_group(const fields *a) {
  value out = list(2); out.of.list.data[0] = none(); out.of.list.data[1] = some(packet(a)); return out;
}
static value right_group(const fields *b, const fields *bad, unsigned position) {
  value out = list(3);
  for (unsigned i = 0; i < 3; ++i)
    out.of.list.data[i] = bad && i == position ? some(packet(bad)) : i == 1 ? none() : some(packet(b));
  return out;
}
static value input_choices(const fields *ok, const fields *error) {
  value values = list(3); values.of.list.data[0] = none();
  values.of.list.data[1] = some(branch(true, packet(ok))); values.of.list.data[2] = some(branch(false, packet(error)));
  return event_choices(values);
}
static void full_inputs(void) {
  char message[256];
  fields a = base(), b = base(), n = normalized_fields(), p; b.bool_value = false;
  expect("echo-a", packet(&a), packet(&a));
  /* Stricter A input policies refuse values that every result producer accepts. */
#define STRICT(change, label, constructor) do { \
  p = base(); change; expect("produce", packet(&p), some(packet(&p))); \
  native_refused("echo-a", packet(&p), "arg0." label REJECTED_BY constructor); \
} while (0)
  STRICT(p.uint8_value = 100, "uint8Value", "uint8A"); STRICT(p.uint16_value = 100, "uint16Value", "uint16A");
  STRICT(p.uint32_value = 100, "uint32Value", "uint32A"); STRICT(p.uint64_value = 100, "uint64Value", "uint64A");
  STRICT(p.int8_value = 100, "int8Value", "int8A"); STRICT(p.int16_value = 100, "int16Value", "int16A");
  STRICT(p.int32_value = 100, "int32Value", "int32A"); STRICT(p.int64_value = 100, "int64Value", "int64A");
  STRICT(p.nat_limbs = hundred, "natValue", "natA"); STRICT(p.int_negative = false; p.int_limbs = hundred, "intValue", "intA");
  STRICT(p.float32_value = 12.5f, "float32Value", "float32A"); STRICT(p.float64_value = 12.5, "float64Value", "float64A");
  STRICT(p.text_data = produced_text; p.text_size = sizeof(produced_text) - 1, "textValue", "textA");
  STRICT(p.bytes_data = produced_bytes; p.bytes_size = sizeof(produced_bytes), "bytesValue", "bytesA");
  STRICT(p.char_value = 955, "charValue", "charA");
  STRICT(p.usize_value = 100, "usizeValue", "usizeA"); STRICT(p.isize_value = 100, "isizeValue", "isizeA");
#undef STRICT
  /* Predicate failures refuse the constructor-selected input API by exact field path. */
#define REJECTED(change, label, constructor) do { \
  p = base(); change; native_refused("echo-a", packet(&p), "arg0." label REJECTED_BY constructor); \
} while (0)
  REJECTED(p.bool_value = false, "boolValue", "boolA");
  REJECTED(p.uint8_value = 43, "uint8Value", "uint8A"); REJECTED(p.uint16_value = 43, "uint16Value", "uint16A");
  REJECTED(p.uint32_value = 43, "uint32Value", "uint32A"); REJECTED(p.uint64_value = 43, "uint64Value", "uint64A");
  REJECTED(p.int8_value = -43, "int8Value", "int8A"); REJECTED(p.int16_value = -43, "int16Value", "int16A");
  REJECTED(p.int32_value = -43, "int32Value", "int32A"); REJECTED(p.int64_value = -43, "int64Value", "int64A");
  REJECTED(p.nat_limbs = forty_three, "natValue", "natA"); REJECTED(p.int_limbs = forty_three, "intValue", "intA");
  REJECTED(p.float32_value = INFINITY, "float32Value", "float32A"); REJECTED(p.float64_value = INFINITY, "float64Value", "float64A");
  REJECTED(p.text_size = 0, "textValue", "textA"); REJECTED(p.bytes_size = 0, "bytesValue", "bytesA");
  REJECTED(p.char_value = 0, "charValue", "charA");
  REJECTED(p.usize_value = 43, "usizeValue", "usizeA"); REJECTED(p.isize_value = -43, "isizeValue", "isizeA");
#undef REJECTED
  p = base(); p.digit = 3; native_refused("echo-a", packet(&p), "arg0.digit is not below its Fin 3 bound");
  native_refused("refuse-unit", packet(&a), "arg0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject");
  expect("echo-b", packet(&b), packet(&n));
  expect_two("combine", packet(&a), packet(&b), pair(packet(&a), packet(&n)));
  /* Wrapping and sign edges of every B normalization. */
  fields e;
#define EDGE(change, want) do { p = b; e = n; change; want; expect("echo-b", packet(&p), packet(&e)); } while (0)
  EDGE(p.uint8_value = UINT8_MAX - 1, e.uint8_value = 0);
  EDGE(p.uint16_value = UINT16_MAX - 1, e.uint16_value = 0);
  EDGE(p.uint32_value = UINT32_MAX - 1, e.uint32_value = 0);
  EDGE(p.uint64_value = UINT64_MAX - 1, e.uint64_value = 0);
  EDGE(p.int8_value = INT8_MAX - 1, e.int8_value = INT8_MIN);
  EDGE(p.int16_value = INT16_MAX - 1, e.int16_value = INT16_MIN);
  EDGE(p.int32_value = INT32_MAX - 1, e.int32_value = INT32_MIN);
  EDGE(p.int64_value = INT64_MAX - 1, e.int64_value = INT64_MIN);
  EDGE(p.usize_value = UINT64_MAX - 1, e.usize_value = 0);
  EDGE(p.isize_value = INT64_MAX - 1, e.isize_value = INT64_MIN);
  EDGE(p.nat_limbs = two_to_100; p.nat_size = 4, e.nat_limbs = two_to_100_plus_2; e.nat_size = 4);
  EDGE(p.int_limbs = two_to_100; p.int_size = 4, e.int_limbs = two_to_100_minus_2; e.int_size = 4);
  EDGE(p.float32_value = 0.0f, e.float32_value = -0.0f); EDGE(p.float32_value = -0.0f, e.float32_value = 0.0f);
  EDGE(p.float64_value = 0.0, e.float64_value = -0.0); EDGE(p.float64_value = -0.0, e.float64_value = 0.0);
  EDGE(p.text_data = unicode_text; p.text_size = sizeof(unicode_text) - 1, e.text_data = unicode_normalized; e.text_size = sizeof(unicode_normalized) - 1);
  EDGE(p.char_value = 128512, e.char_value = 128512);
  EDGE(p.bytes_size = 0, e.bytes_data = appended_bytes; e.bytes_size = 1);
#undef EDGE
  const double nonfinite[] = {NAN, INFINITY, -INFINITY};
  for (unsigned i = 0; i < 3; ++i) {
    p = b; p.float32_value = (float)nonfinite[i];
    native_refused("echo-b", packet(&p), "arg0.float32Value was rejected by NominalPrimitiveSubtypes.float32B");
    p.bool_value = true; produce_none(&p);
    p = b; p.float64_value = nonfinite[i];
    native_refused("echo-b", packet(&p), "arg0.float64Value was rejected by NominalPrimitiveSubtypes.float64B");
    p.bool_value = true; produce_none(&p);
  }
  /* Aliased groups and pairs keep every absent slot and normalize only B slots. */
  fields bad = b; bad.nat_limbs = forty_three;
  value joined = list(5);
  joined.of.list.data[0] = none(); joined.of.list.data[1] = some(packet(&a)); joined.of.list.data[2] = some(packet(&n));
  joined.of.list.data[3] = none(); joined.of.list.data[4] = some(packet(&n));
  expect_two("aliases", left_group(&a), right_group(&b, NULL, 0), joined);
  native_refused_two("aliases", left_group(&a), right_group(&b, &bad, 0), "arg1[0]?.natValue was rejected by NominalPrimitiveSubtypes.natB");
  expect("echo-pair", boxes(left_group(&a), right_group(&b, NULL, 0)), boxes(left_group(&a), right_group(&n, NULL, 0)));
  expect("echo-pair", boxes(list(0), absent_group()), boxes(list(0), absent_group()));
  for (unsigned round = 0; round < 256; ++round) {
    const unsigned position = round % 3;
    snprintf(message, sizeof(message), "arg0.right[%u]?.natValue was rejected by NominalPrimitiveSubtypes.natB", position);
    native_refused("echo-pair", boxes(left_group(&a), right_group(&b, &bad, position)), message);
    expect("echo-b", packet(&b), packet(&n));
  }
  for (unsigned second = 0; second < 2; ++second) {
    const char *label = second ? "echo-event-b" : "echo-event-a";
    const fields *in = second ? &b : &a, *out = second ? &n : &a;
    expect(label, event_empty(), event_empty());
    expect(label, event_box(packet(in)), event_box(packet(out)));
    snprintf(message, sizeof(message), "arg0.box.value.natValue was rejected by NominalPrimitiveSubtypes.nat%s", second ? "B" : "A");
    p = *in; p.nat_limbs = forty_three; native_refused(label, event_box(packet(&p)), message);
    expect(label, event_box(packet(in)), event_box(packet(out)));
    expect(label, event_choices(list(0)), event_choices(list(0)));
    expect(label, absent_choices(), absent_choices());
    expect(label, input_choices(in, second ? &a : &b), input_choices(out, second ? &a : &n));
    for (unsigned branch_index = 0; branch_index < 2; ++branch_index) {
      snprintf(message, sizeof(message), "arg0.choices.values[%u]?.%s.natValue was rejected by NominalPrimitiveSubtypes.nat%s",
        branch_index + 1, branch_index ? "error" : "ok", second != branch_index ? "B" : "A");
      fields ok = *in, error = second ? a : b, *target = branch_index ? &error : &ok; target->nat_limbs = forty_three;
      native_refused(label, input_choices(&ok, &error), message);
      expect(label, input_choices(in, second ? &a : &b), input_choices(out, second ? &a : &n));
    }
  }
  /* Every Fin bound is checked before any selected Subtype constructor. */
  p = a; p.nat_limbs = forty_three; e = b; e.digit = 3;
  native_refused_two("combine", packet(&p), packet(&e), "arg1.digit is not below its Fin 3 bound");
  native_refused("echo-event-a", event_box(packet(&e)), "arg0.box.value.digit is not below its Fin 3 bound");
  /* Wrong shapes have valid backing storage and remain safe to clone/delete. */
  host_refused("combine", packet(&a));
  host_refused_two("combine", packet(&a), u8(1));
  host_refused("echo-event-a", event("unknown", NULL));
  host_refused("echo-event-a", event("box", NULL));
  value extra = packet(&a); host_refused("echo-event-a", event("empty", &extra));
  value malformed = {.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = true, .val = NULL}};
  value wrong = list(1); wrong.of.list.data[0] = some(malformed); host_refused("echo-event-a", event_choices(wrong));
  host_refused("echo-pair", boxes(group(u8(1)), list(0)));
  host_refused_two("aliases", left_group(&a), group(u8(1)));
  host_refused("echo-a", one_field("payload", small(40)));
  expect("echo-a", packet(&a), packet(&a));
}
