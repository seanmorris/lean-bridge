  /* Array fields and results: Array Nat inside array-box, box-row as list<nat-box>, and row-box's list<nat-box> field. Nat crosses as
     u32 limbs, so a negative member does not exist; a non-canonical zero limb, a wrong kind and a missing field at the first, middle and
     last position are refused, each leaving the output untouched and the session usable. Arguments pass ownership to the call. */
#define ARRAY_LIST3(dst, a, b, c) do { dst = (value){.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&dst.of.list, 3); \
    dst.of.list.data[0] = (a); dst.of.list.data[1] = (b); dst.of.list.data[2] = (c); } while (0)
#define ARRAY_EMPTY(dst) do { dst = (value){.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&dst.of.list, 0); } while (0)
#define ARRAY_ZERO(dst) do { dst = (value){.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&dst.of.list, 1); \
    dst.of.list.data[0] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 0}; } while (0)
#define ARRAY_ROW(dst) ARRAY_LIST3(dst, box(2, 3), record2("value", power(70), "count", nat(1)), box(0, 5))
  value array_list, array_member;
  ARRAY_LIST3(array_list, nat(1), power(70), nat(3));
  args[0] = record2("value", array_list, "count", nat(3)); out = call("push-count", args, 1);
  const value *array_out = field(&out, "value");
  CHECK(array_out && array_out->kind == WASMTIME_COMPONENT_LIST && array_out->of.list.size == 4 && is_nat(&array_out->of.list.data[0], 1)
    && is_power_plus(&array_out->of.list.data[1], 70, 0) && is_nat(&array_out->of.list.data[2], 3) && is_nat(&array_out->of.list.data[3], 3) && is_nat(field(&out, "count"), 4));
  clear(&out);
  ARRAY_EMPTY(array_list);
  args[0] = record2("value", array_list, "count", nat(0)); out = call("push-count", args, 1);
  array_out = field(&out, "value");
  CHECK(array_out && array_out->kind == WASMTIME_COMPONENT_LIST && array_out->of.list.size == 1 && is_nat(&array_out->of.list.data[0], 0) && is_nat(field(&out, "count"), 1));
  clear(&out);
  ARRAY_ROW(args[0]); out = call("row-total", args, 1); CHECK(is_power_plus(&out, 70, 6)); clear(&out);
  ARRAY_EMPTY(args[0]); out = call("row-total", args, 1); CHECK(is_nat(&out, 0)); clear(&out);
  args[0] = nat(3); out = call("row-of", args, 1);
  CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 3 && is_nat(field(&out.of.list.data[0], "value"), 0) && is_nat(field(&out.of.list.data[0], "count"), 3)
    && is_nat(field(&out.of.list.data[2], "value"), 2) && is_nat(field(&out.of.list.data[2], "count"), 3));
  args[0] = out; out = call("row-total", args, 1); CHECK(is_nat(&out, 9)); clear(&out);
  args[0] = nat(0); out = call("row-of", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
  ARRAY_ROW(array_list); args[0] = record2("value", array_list, "count", nat(4)); out = call("row-box-sum", args, 1); CHECK(is_power_plus(&out, 70, 6)); clear(&out);
  ARRAY_EMPTY(array_list); args[0] = record2("value", array_list, "count", nat(9)); out = call("row-box-sum", args, 1); CHECK(is_nat(&out, 9)); clear(&out);
  for (unsigned position = 0; position < 3; ++position) {
    for (unsigned kind = 0; kind < 2; ++kind) {
      ARRAY_LIST3(array_list, nat(1), power(70), nat(3));
      clear(&array_list.of.list.data[position]);
      if (kind == 0) ARRAY_ZERO(array_list.of.list.data[position]); else array_list.of.list.data[position] = text("1");
      args[0] = record2("value", array_list, "count", nat(3)); CHECK(rejected("push-count", &args[0]));
      ARRAY_LIST3(array_list, nat(1), power(70), nat(3));
      args[0] = record2("value", array_list, "count", nat(3)); out = call("push-count", args, 1); CHECK(is_nat(field(&out, "count"), 4)); clear(&out);
    }
    for (unsigned kind = 0; kind < 3; ++kind) {
      for (unsigned target = 0; target < 2; ++target) {
        ARRAY_ROW(array_list);
        clear(&array_list.of.list.data[position]);
        if (kind == 0) { ARRAY_ZERO(array_member); array_list.of.list.data[position] = record2("value", array_member, "count", nat(1)); }
        else if (kind == 1) array_list.of.list.data[position] = record1("value", nat(1));
        else array_list.of.list.data[position] = record2("value", text("1"), "count", nat(1));
        if (target == 0) { args[0] = array_list; CHECK(rejected("row-total", &args[0])); }
        else { args[0] = record2("value", array_list, "count", nat(4)); CHECK(rejected("row-box-sum", &args[0])); }
      }
      ARRAY_ROW(args[0]); out = call("row-total", args, 1); CHECK(is_power_plus(&out, 70, 6)); clear(&out);
    }
  }
  /* A non-list Array field, a non-canonical count beside an Array field, and a list of the wrong record are refused too. */
  args[0] = record2("value", nat(5), "count", nat(1)); CHECK(rejected("push-count", &args[0]));
  ARRAY_ZERO(array_member); ARRAY_LIST3(array_list, nat(1), nat(2), nat(3)); args[0] = record2("value", array_list, "count", array_member); CHECK(rejected("push-count", &args[0]));
  ARRAY_ZERO(array_member); ARRAY_ROW(array_list); args[0] = record2("value", array_list, "count", array_member); CHECK(rejected("row-box-sum", &args[0]));
  ARRAY_ZERO(args[0]); CHECK(rejected("row-of", &args[0]));
  ARRAY_LIST3(args[0], nat(1), nat(2), nat(3)); CHECK(rejected("row-total", &args[0]));
  ARRAY_LIST3(array_list, nat(1), nat(2), nat(3)); args[0] = record2("value", array_list, "count", nat(1)); CHECK(rejected("row-box-sum", &args[0]));
  ARRAY_ROW(array_list); args[0] = record2("value", array_list, "count", nat(4)); out = call("row-box-sum", args, 1); CHECK(is_power_plus(&out, 70, 6)); clear(&out);
  /* One thousand Array rounds: a refused member, then valid Array input and result calls, each result released. */
  for (uint64_t r = 0; r < 1000; ++r) {
    const unsigned position = (unsigned)(r % 3);
    const uint64_t size = r % 4, triangle = size * (size ? size - 1 : 0) / 2;
    ARRAY_LIST3(array_list, nat(1), power(70), nat(3));
    clear(&array_list.of.list.data[position]); ARRAY_ZERO(array_list.of.list.data[position]);
    args[0] = record2("value", array_list, "count", nat(r));
    int failed = !rejected("push-count", &args[0]);
    ARRAY_LIST3(array_list, nat(1), power(70), nat(3));
    args[0] = record2("value", array_list, "count", nat(r)); out = call("push-count", args, 1);
    array_out = field(&out, "value");
    failed |= !(array_out && array_out->of.list.size == 4 && is_nat(&array_out->of.list.data[3], r) && is_nat(field(&out, "count"), r + 1));
    clear(&out);
    args[0] = nat(size); out = call("row-of", args, 1);
    failed |= !(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == size);
    args[0] = out; out = call("row-total", args, 1); failed |= !is_nat(&out, size * triangle); clear(&out);
    args[0] = nat(size); out = call("row-of", args, 1);
    args[0] = record2("value", out, "count", nat(r)); out = call("row-box-sum", args, 1); failed |= !is_nat(&out, r + triangle); clear(&out);
    if (failed) { fprintf(stderr, "array round %llu failed\n", (unsigned long long)r); return 1; }
  }
  checks += 1000;
#undef ARRAY_ROW
#undef ARRAY_ZERO
#undef ARRAY_EMPTY
#undef ARRAY_LIST3
