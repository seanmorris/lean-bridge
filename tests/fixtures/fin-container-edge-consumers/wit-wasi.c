  /* Original checks remain intact. Run before the original session close, not after it. */
  {
    unsigned edge_before = checks;
    const char *zero_error = "arg0 is not below its Fin 0 bound";
    const char *digit_error = "arg0 is not below its Fin 10 bound";
    args[0] = list(0, NULL); out = call("empty-array", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
    args[0] = list(0, NULL); out = call("empty-list", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
    args[0] = none(); out = call("empty-option", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && !out.of.option); clear(&out);
    for (unsigned which = 0; which < 3; ++which) {
      const char *methods[] = {"empty-array", "empty-list"};
      for (unsigned method = 0; method < 2; ++method) {
        value member = which == 2 ? nat(huge, 3) : small(which);
        args[0] = list(1, &member);
        CHECK(edge_refused(methods[method], &args[0], zero_error));
      }
      args[0] = some(which == 2 ? nat(huge, 3) : small(which));
      CHECK(edge_refused("empty-option", &args[0], zero_error));
    }
    args[0] = none(); out = call("optional-digits", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && !out.of.option); clear(&out);
    args[0] = some(list(0, NULL)); out = call("optional-digits", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 0); clear(&out);
    const uint32_t endpoints[] = {0, 9};
    args[0] = some(digits(endpoints, 2)); out = call("optional-digits", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 2
      && is_small(&out.of.option->of.list.data[0], 0) && is_small(&out.of.option->of.list.data[1], 9)); clear(&out);
    for (unsigned position = 0; position < 3; ++position) {
      uint32_t members[] = {1, 2, 3}; members[position] = 10;
      value options[3];
      for (unsigned i = 0; i < 3; ++i) options[i] = some(small(members[i]));
      args[0] = list(3, options); CHECK(edge_refused("present", &args[0], digit_error));
      args[0] = some(digits(members, 3)); CHECK(edge_refused("optional-digits", &args[0], digit_error));
      for (unsigned column = 0; column < 3; ++column) {
        uint32_t cells[3][3] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        cells[position][column] = 10;
        value rows[3];
        for (unsigned i = 0; i < 3; ++i) rows[i] = digits(cells[i], 3);
        args[0] = list(3, rows); CHECK(edge_refused("flatten", &args[0], digit_error));
      }
    }
    value absent[3] = {none(), none(), none()};
    args[0] = list(3, absent); out = call("present", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
    value empty_rows[3] = {list(0, NULL), list(0, NULL), list(0, NULL)};
    args[0] = list(3, empty_rows); out = call("flatten", args, 1);
    CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 0); clear(&out);
    /* Nat's u32 limbs cannot encode a negative value. Malformed raw carriers are a separate required gate. */
    for (unsigned cycle = 0; cycle < 1000; ++cycle) {
      const char *methods[] = {"empty-array", "empty-list"};
      for (unsigned method = 0; method < 2; ++method) {
        value zero = small(0); args[0] = list(1, &zero);
        CHECK(edge_refused(methods[method], &args[0], zero_error));
        args[0] = list(0, NULL); out = call(methods[method], args, 1);
        CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 0); clear(&out);
      }
      args[0] = some(small(0)); CHECK(edge_refused("empty-option", &args[0], zero_error));
      args[0] = none(); out = call("empty-option", args, 1);
      CHECK(out.kind == WASMTIME_COMPONENT_OPTION && !out.of.option); clear(&out);
      value bad_options[3] = {some(small(1)), some(small(10)), none()};
      args[0] = list(3, bad_options); CHECK(edge_refused("present", &args[0], digit_error));
      value good_options[3] = {some(small(1)), none(), some(small(9))};
      args[0] = list(3, good_options); out = call("present", args, 1);
      CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 2 && is_small(&out.of.list.data[0], 1) && is_small(&out.of.list.data[1], 9)); clear(&out);
      uint32_t a = 1, b = 10, c = 9;
      value bad_rows[3] = {digits(&a, 1), digits(&b, 1), digits(&c, 1)};
      args[0] = list(3, bad_rows); CHECK(edge_refused("flatten", &args[0], digit_error));
      value good_rows[3] = {digits(&a, 1), list(0, NULL), digits(&c, 1)};
      args[0] = list(3, good_rows); out = call("flatten", args, 1);
      CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 2
        && is_small(&out.of.option->of.list.data[0], 1) && is_small(&out.of.option->of.list.data[1], 9)); clear(&out);
      const uint32_t bad_digits[] = {1, 10, 9}, good_digits[] = {1, 9};
      args[0] = some(digits(bad_digits, 3)); CHECK(edge_refused("optional-digits", &args[0], digit_error));
      args[0] = some(digits(good_digits, 2)); out = call("optional-digits", args, 1);
      CHECK(out.kind == WASMTIME_COMPONENT_OPTION && out.of.option && out.of.option->kind == WASMTIME_COMPONENT_LIST && out.of.option->of.list.size == 2
        && is_small(&out.of.option->of.list.data[0], 1) && is_small(&out.of.option->of.list.data[1], 9)); clear(&out);
    }
    CHECK(checks - edge_before == 12032);
  }
