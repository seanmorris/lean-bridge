  /* VO #1454: this block owns every input and result; old checks above are unchanged. */
  {
    unsigned edge_before = checks;
    fincontainers_error edge_error = {0};
    const char *edge_zero_error = "arg0[0] is not below its Fin 0 bound";
    const char *edge_zero_option_error = "arg0? is not below its Fin 0 bound";
    char edge_digit_error[128];
    const char *edge_structural_error = "Invalid copied value, negative Nat or 16 MiB call limit exceeded";
#define EDGE_STRUCTURAL_REFUSED(call) (edge_error = (fincontainers_error){0}, rejected((call), &edge_error, edge_structural_error))
    mpz_t edge_values[3];
    for (unsigned i = 0; i < 3; ++i) mpz_init_set_ui(edge_values[i], i + 1);
    nats edge_array = {edge_values, 1, NULL, NULL}, edge_empty_array = {0}, edge_array_out = {0};
    fincontainers_list_nat_span edge_list = {edge_values, 1, NULL, NULL}, edge_empty_list = {0}, edge_list_out = {0};
    maybe edge_option, edge_option_out;
    fincontainers_option_nat_value_init(&edge_option);
    fincontainers_option_nat_value_init(&edge_option_out);
    CHECK(OK(fincontainers_empty_array(&edge_empty_array, &edge_array_out, &edge_error)) && edge_array_out.length == 0);
    fincontainers_array_nat_span_clear(&edge_array_out);
    CHECK(OK(fincontainers_empty_list(&edge_empty_list, &edge_list_out, &edge_error)) && edge_list_out.length == 0);
    fincontainers_list_nat_span_clear(&edge_list_out);
    CHECK(OK(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error)) && edge_option_out.has_value == 0);
    fincontainers_option_nat_value_clear(&edge_option_out);
    fincontainers_option_nat_value_init(&edge_option_out);
    for (unsigned i = 0; i < 3; ++i) {
      mpz_set_ui(edge_values[0], i == 1 ? 1 : 0);
      if (i == 2) mpz_setbit(edge_values[0], 70);
      edge_array_out = (nats){edge_values, 3, NULL, NULL};
      edge_list_out = (fincontainers_list_nat_span){edge_values, 3, NULL, NULL};
      edge_option.has_value = 1; mpz_set(edge_option.value, edge_values[0]);
      edge_option_out.has_value = 1; mpz_set_ui(edge_option_out.value, 99);
      CHECK(rejected(fincontainers_empty_array(&edge_array, &edge_array_out, &edge_error), &edge_error, edge_zero_error));
      CHECK(edge_array_out.data == edge_values && edge_array_out.length == 3);
      CHECK(rejected(fincontainers_empty_list(&edge_list, &edge_list_out, &edge_error), &edge_error, edge_zero_error));
      CHECK(edge_list_out.data == edge_values && edge_list_out.length == 3);
      CHECK(rejected(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error), &edge_error, edge_zero_option_error));
      CHECK(edge_option_out.has_value == 1 && is_small(edge_option_out.value, 99) && mpz_cmp(edge_option.value, edge_values[0]) == 0);
      CHECK(i == 2 ? mpz_tstbit(edge_values[0], 70) && mpz_popcount(edge_values[0]) == 1 : is_small(edge_values[0], i));
    }
    /* Discard borrowed sentinels without freeing caller-owned values. */
    edge_array_out = (nats){0}; edge_list_out = (fincontainers_list_nat_span){0};
    fincontainers_option_nat_value_clear(&edge_option_out);
    fincontainers_option_nat_value_init(&edge_option_out);

    fincontainers_option_list_nat_value edge_optional, edge_optional_out;
    fincontainers_option_list_nat_value_init(&edge_optional);
    fincontainers_option_list_nat_value_init(&edge_optional_out);
    CHECK(OK(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)) && !edge_optional_out.has_value);
    fincontainers_option_list_nat_value_clear(&edge_optional_out);
    fincontainers_option_list_nat_value_init(&edge_optional_out);
    edge_optional.has_value = 1;
    CHECK(OK(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)) && edge_optional_out.has_value && !edge_optional_out.value.length);
    fincontainers_option_list_nat_value_clear(&edge_optional_out);
    fincontainers_option_list_nat_value_init(&edge_optional_out);
    mpz_set_ui(edge_values[0], 0); mpz_set_ui(edge_values[1], 9);
    edge_optional.value = (fincontainers_list_nat_span){edge_values, 2, NULL, NULL};
    CHECK(OK(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)) && edge_optional_out.has_value && edge_optional_out.value.length == 2 && is_small(edge_optional_out.value.data[0], 0) && is_small(edge_optional_out.value.data[1], 9));
    fincontainers_option_list_nat_value_clear(&edge_optional_out);
    fincontainers_option_list_nat_value_init(&edge_optional_out);

    maybe edge_mixed[3];
    for (unsigned i = 0; i < 3; ++i) fincontainers_option_nat_value_init(&edge_mixed[i]);
    fincontainers_array_option_nat_span edge_options = {edge_mixed, 3, NULL, NULL};
    mpz_t edge_cells[3][3]; nats edge_rows[3];
    for (unsigned r = 0; r < 3; ++r) {
      for (unsigned c = 0; c < 3; ++c) mpz_init_set_ui(edge_cells[r][c], 1 + 3 * r + c);
      edge_rows[r] = (nats){edge_cells[r], 3, NULL, NULL};
    }
    fincontainers_list_array_nat_span edge_table = {edge_rows, 3, NULL, NULL};
    for (unsigned position = 0; position < 3; ++position) {
      for (unsigned i = 0; i < 3; ++i) {
        mpz_set_ui(edge_values[i], i + 1);
        edge_mixed[i].has_value = 1; mpz_set_ui(edge_mixed[i].value, i + 1);
      }
      mpz_set_ui(edge_values[position], 10); mpz_set_ui(edge_mixed[position].value, 10);
      edge_optional.value = (fincontainers_list_nat_span){edge_values, 3, NULL, NULL};
      snprintf(edge_digit_error, sizeof(edge_digit_error), "arg0[%u]? is not below its Fin 10 bound", position);
      CHECK(rejected(fincontainers_present(&edge_options, &edge_array_out, &edge_error), &edge_error, edge_digit_error));
      CHECK(!edge_array_out.data && !edge_array_out.length && is_small(edge_mixed[position].value, 10));
      snprintf(edge_digit_error, sizeof(edge_digit_error), "arg0?[%u] is not below its Fin 10 bound", position);
      CHECK(rejected(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error), &edge_error, edge_digit_error));
      CHECK(!edge_optional_out.has_value && !edge_optional_out.value.data && is_small(edge_values[position], 10));
      for (unsigned column = 0; column < 3; ++column) {
        mpz_set_ui(edge_cells[position][column], 10);
        snprintf(edge_digit_error, sizeof(edge_digit_error), "arg0[%u][%u] is not below its Fin 10 bound", position, column);
        CHECK(rejected(fincontainers_flatten(&edge_table, &edge_optional_out, &edge_error), &edge_error, edge_digit_error));
        CHECK(!edge_optional_out.has_value && !edge_optional_out.value.data && is_small(edge_cells[position][column], 10));
        mpz_set_ui(edge_cells[position][column], 1 + 3 * position + column);
      }
    }
    /* Inactive invalid payloads must not be read. These are public carriers, not Lean objects. */
    edge_option.has_value = 0; mpz_set_ui(edge_option.value, 123);
    CHECK(OK(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error)) && !edge_option_out.has_value && is_small(edge_option.value, 123));
    fincontainers_option_nat_value_clear(&edge_option_out);
    fincontainers_option_nat_value_init(&edge_option_out);
    edge_optional.has_value = 0;
    edge_optional.value = (fincontainers_list_nat_span){NULL, 2, NULL, NULL};
    CHECK(OK(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)) && !edge_optional_out.has_value);
    fincontainers_option_list_nat_value_clear(&edge_optional_out);
    fincontainers_option_list_nat_value_init(&edge_optional_out);
    for (unsigned i = 0; i < 3; ++i) { edge_mixed[i].has_value = 0; mpz_set_ui(edge_mixed[i].value, 123); }
    CHECK(OK(fincontainers_present(&edge_options, &edge_array_out, &edge_error)) && !edge_array_out.length);
    fincontainers_array_nat_span_clear(&edge_array_out);
    /* Invalid structural tags and spans must not be mistaken for bound refusals. */
    edge_option.has_value = 2;
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error)));
    CHECK(!edge_option_out.has_value && is_small(edge_option.value, 123));
    edge_optional.has_value = 2;
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)));
    CHECK(!edge_optional_out.has_value && !edge_optional_out.value.data);
    nats edge_bad_array = {NULL, 2, NULL, NULL};
    fincontainers_list_nat_span edge_bad_list = {NULL, 2, NULL, NULL};
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_empty_array(&edge_bad_array, &edge_array_out, &edge_error)));
    CHECK(!edge_array_out.data && !edge_array_out.length);
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_empty_list(&edge_bad_list, &edge_list_out, &edge_error)));
    CHECK(!edge_list_out.data && !edge_list_out.length);
    edge_optional.has_value = 1;
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)));
    CHECK(!edge_optional_out.has_value && !edge_optional_out.value.data);
    edge_rows[1] = edge_bad_array;
    CHECK(EDGE_STRUCTURAL_REFUSED(fincontainers_flatten(&edge_table, &edge_optional_out, &edge_error)));
    CHECK(!edge_optional_out.has_value && !edge_optional_out.value.data);
    edge_rows[1] = (nats){edge_cells[1], 3, NULL, NULL};

    for (unsigned cycle = 0; cycle < 1000; ++cycle) {
      mpz_set_ui(edge_values[0], 0); edge_option.has_value = 1; mpz_set_ui(edge_option.value, 0);
      CHECK(rejected(fincontainers_empty_array(&edge_array, &edge_array_out, &edge_error), &edge_error, edge_zero_error));
      CHECK(OK(fincontainers_empty_array(&edge_empty_array, &edge_array_out, &edge_error)) && !edge_array_out.length);
      fincontainers_array_nat_span_clear(&edge_array_out);
      CHECK(rejected(fincontainers_empty_list(&edge_list, &edge_list_out, &edge_error), &edge_error, edge_zero_error));
      CHECK(OK(fincontainers_empty_list(&edge_empty_list, &edge_list_out, &edge_error)) && !edge_list_out.length);
      fincontainers_list_nat_span_clear(&edge_list_out);
      CHECK(rejected(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error), &edge_error, edge_zero_option_error));
      edge_option.has_value = 0;
      CHECK(OK(fincontainers_empty_option(&edge_option, &edge_option_out, &edge_error)) && !edge_option_out.has_value);
      fincontainers_option_nat_value_clear(&edge_option_out);
      fincontainers_option_nat_value_init(&edge_option_out);
      edge_mixed[1].has_value = 1; mpz_set_ui(edge_mixed[1].value, 10);
      CHECK(rejected(fincontainers_present(&edge_options, &edge_array_out, &edge_error), &edge_error, "arg0[1]? is not below its Fin 10 bound"));
      mpz_set_ui(edge_mixed[1].value, 9);
      CHECK(OK(fincontainers_present(&edge_options, &edge_array_out, &edge_error)) && edge_array_out.length == 1 && is_small(edge_array_out.data[0], 9));
      fincontainers_array_nat_span_clear(&edge_array_out);
      mpz_set_ui(edge_cells[1][1], 10);
      CHECK(rejected(fincontainers_flatten(&edge_table, &edge_optional_out, &edge_error), &edge_error, "arg0[1][1] is not below its Fin 10 bound"));
      mpz_set_ui(edge_cells[1][1], 5);
      CHECK(OK(fincontainers_flatten(&edge_table, &edge_optional_out, &edge_error)) && edge_optional_out.has_value && edge_optional_out.value.length == 9 && is_small(edge_optional_out.value.data[4], 5));
      fincontainers_option_list_nat_value_clear(&edge_optional_out);
      fincontainers_option_list_nat_value_init(&edge_optional_out);
      edge_optional.value = (fincontainers_list_nat_span){edge_values, 3, NULL, NULL};
      mpz_set_ui(edge_values[1], 10); mpz_set_ui(edge_values[2], 9);
      CHECK(rejected(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error), &edge_error, "arg0?[1] is not below its Fin 10 bound"));
      mpz_set_ui(edge_values[1], 1);
      CHECK(OK(fincontainers_optional_digits(&edge_optional, &edge_optional_out, &edge_error)) && edge_optional_out.has_value && edge_optional_out.value.length == 3 && is_small(edge_optional_out.value.data[1], 1));
      fincontainers_option_list_nat_value_clear(&edge_optional_out);
      fincontainers_option_list_nat_value_init(&edge_optional_out);
    }
    for (unsigned i = 0; i < 3; ++i) {
      mpz_clear(edge_values[i]); fincontainers_option_nat_value_clear(&edge_mixed[i]);
      for (unsigned j = 0; j < 3; ++j) mpz_clear(edge_cells[i][j]);
    }
    /* Borrowed inputs have no destructor; clear only owned values and returned allocations. */
    edge_optional.value = (fincontainers_list_nat_span){0};
    fincontainers_option_list_nat_value_clear(&edge_optional);
    fincontainers_option_list_nat_value_clear(&edge_optional_out);
    fincontainers_option_nat_value_clear(&edge_option);
    fincontainers_option_nat_value_clear(&edge_option_out);
    CHECK(checks - edge_before == 12072);
#undef EDGE_STRUCTURAL_REFUSED
  }
