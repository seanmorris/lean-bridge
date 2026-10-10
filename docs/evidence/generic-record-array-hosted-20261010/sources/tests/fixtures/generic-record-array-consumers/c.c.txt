  /* Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field. */
  mpz_t array_wide, array_sum, array_expected, array_count; mpz_init(array_wide); mpz_setbit(array_wide, 70);
  mpz_init(array_sum); mpz_init(array_expected); mpz_init(array_count);
  mpz_t array_values[3]; mpz_init_set_ui(array_values[0], 1); mpz_init_set(array_values[1], array_wide); mpz_init_set_ui(array_values[2], 3);
  genericrecords_array_box array_in, array_out; genericrecords_array_box_init(&array_in); genericrecords_array_box_init(&array_out);
  const genericrecords_array_nat_span array_items = {array_values, 3, NULL, NULL}, array_empty = {NULL, 0, NULL, NULL}, array_null = {NULL, 2, NULL, NULL};
  array_in.value = array_items; mpz_set_ui(array_in.count, 3);
  CHECK(OK(genericrecords_push_count(&array_in, &array_out, &error)) && array_out.value.length == 4 && is_small(array_out.value.data[0], 1)
    && mpz_cmp(array_out.value.data[1], array_wide) == 0 && is_small(array_out.value.data[2], 3) && is_small(array_out.value.data[3], 3) && is_small(array_out.count, 4));
  CHECK(array_in.value.data == array_values && array_in.value.length == 3 && is_small(array_values[0], 1) && mpz_cmp(array_values[1], array_wide) == 0
    && is_small(array_values[2], 3) && is_small(array_in.count, 3));
  genericrecords_array_box_clear(&array_out);
  array_in.value = array_empty; mpz_set_ui(array_in.count, 0);
  CHECK(OK(genericrecords_push_count(&array_in, &array_out, &error)) && array_out.value.length == 1 && is_small(array_out.value.data[0], 0) && is_small(array_out.count, 1));
  genericrecords_array_box_clear(&array_out);
  genericrecords_nat_box row_items[3];
  for (unsigned a = 0; a < 3; ++a) genericrecords_nat_box_init(&row_items[a]);
  mpz_set_ui(row_items[0].value, 2); mpz_set_ui(row_items[0].count, 3);
  mpz_set(row_items[1].value, array_wide); mpz_set_ui(row_items[1].count, 1);
  mpz_set_ui(row_items[2].value, 0); mpz_set_ui(row_items[2].count, 5);
  const genericrecords_array_lean_generic_records_nat_box_span row = {row_items, 3, NULL, NULL}, no_row = {NULL, 0, NULL, NULL}, null_row = {NULL, 2, NULL, NULL};
  mpz_add_ui(array_expected, array_wide, 6);
  CHECK(OK(genericrecords_row_total(&row, array_sum, &error)) && mpz_cmp(array_sum, array_expected) == 0);
  CHECK(OK(genericrecords_row_total(&no_row, array_sum, &error)) && is_small(array_sum, 0));
  CHECK(is_small(row_items[0].value, 2) && is_small(row_items[0].count, 3) && mpz_cmp(row_items[1].value, array_wide) == 0 && is_small(row_items[2].count, 5));
  genericrecords_array_lean_generic_records_nat_box_span made = {NULL, 0, NULL, NULL};
  mpz_set_ui(array_count, 3);
  CHECK(OK(genericrecords_row_of(array_count, &made, &error)) && made.length == 3 && is_small(made.data[0].value, 0) && is_small(made.data[2].value, 2) && is_small(made.data[2].count, 3));
  CHECK(OK(genericrecords_row_total(&made, array_sum, &error)) && is_small(array_sum, 9));
  genericrecords_array_lean_generic_records_nat_box_span_clear(&made);
  mpz_set_ui(array_count, 0);
  CHECK(OK(genericrecords_row_of(array_count, &made, &error)) && made.length == 0);
  genericrecords_array_lean_generic_records_nat_box_span_clear(&made);
  genericrecords_row_box row_box; genericrecords_row_box_init(&row_box);
  row_box.value = row; mpz_set_ui(row_box.count, 4);
  CHECK(OK(genericrecords_row_box_sum(&row_box, array_sum, &error)) && mpz_cmp(array_sum, array_expected) == 0);
  row_box.value = no_row; mpz_set_ui(row_box.count, 9);
  CHECK(OK(genericrecords_row_box_sum(&row_box, array_sum, &error)) && is_small(array_sum, 9));
  /* A negative GMP member at the first, middle and last position is the generated API's invalid argument; the caller's input is unchanged and the next valid call succeeds. */
#define ARRAY_REJECTED(call) ((call) == GENERICRECORDS_STATUS_INVALID_ARGUMENT && error.code == GENERICRECORDS_ERROR_INVALID_ARGUMENT)
  /* A refused call leaves its output exactly as seeded: a sentinel sum, or an empty span beside a sentinel count. */
#define SUM_REJECTED(call) (mpz_set_ui(array_sum, 77777), ARRAY_REJECTED(call) && is_small(array_sum, 77777))
#define BOX_REJECTED(call) (mpz_set_ui(array_out.count, 77777), ARRAY_REJECTED(call) && array_out.value.length == 0 && array_out.value.data == NULL && is_small(array_out.count, 77777))
  for (unsigned a = 0; a < 3; ++a) {
    mpz_t saved; mpz_init_set(saved, array_values[a]);
    array_in.value = array_items; mpz_set_ui(array_in.count, 3); mpz_set_si(array_values[a], -1);
    CHECK(BOX_REJECTED(genericrecords_push_count(&array_in, &array_out, &error)));
    CHECK(mpz_cmp_si(array_values[a], -1) == 0 && array_in.value.data == array_values && array_in.value.length == 3 && is_small(array_in.count, 3));
    mpz_set(array_values[a], saved); mpz_clear(saved);
    CHECK(OK(genericrecords_push_count(&array_in, &array_out, &error)) && array_out.value.length == 4 && mpz_cmp(array_out.value.data[a], array_values[a]) == 0);
    genericrecords_array_box_clear(&array_out);
    for (unsigned field = 0; field < 2; ++field) {
      mpz_ptr member = field ? row_items[a].count : row_items[a].value;
      mpz_init_set(saved, member); mpz_set_si(member, -1);
      CHECK(SUM_REJECTED(genericrecords_row_total(&row, array_sum, &error)) && mpz_cmp_si(member, -1) == 0);
      row_box.value = row; mpz_set_ui(row_box.count, 4);
      CHECK(SUM_REJECTED(genericrecords_row_box_sum(&row_box, array_sum, &error)) && mpz_cmp_si(member, -1) == 0 && row_box.value.data == row_items && is_small(row_box.count, 4));
      mpz_set(member, saved); mpz_clear(saved);
      CHECK(OK(genericrecords_row_total(&row, array_sum, &error)) && mpz_cmp(array_sum, array_expected) == 0);
      CHECK(OK(genericrecords_row_box_sum(&row_box, array_sum, &error)) && mpz_cmp(array_sum, array_expected) == 0);
    }
  }
  /* A negative count beside an Array field, and NULL data with a nonzero length, are refused too. */
  array_in.value = array_items; mpz_set_si(array_in.count, -1);
  CHECK(BOX_REJECTED(genericrecords_push_count(&array_in, &array_out, &error)));
  row_box.value = row; mpz_set_si(row_box.count, -1);
  CHECK(SUM_REJECTED(genericrecords_row_box_sum(&row_box, array_sum, &error)));
  array_in.value = array_null; mpz_set_ui(array_in.count, 1);
  CHECK(BOX_REJECTED(genericrecords_push_count(&array_in, &array_out, &error)));
  CHECK(SUM_REJECTED(genericrecords_row_total(&null_row, array_sum, &error)));
  row_box.value = null_row; mpz_set_ui(row_box.count, 1);
  CHECK(SUM_REJECTED(genericrecords_row_box_sum(&row_box, array_sum, &error)));
  /* One thousand Array rounds: a rejected member, then valid Array input and result calls, each result cleared. */
  for (unsigned long r = 0; r < 1000; ++r) {
    const unsigned position = (unsigned)(r % 3), size = (unsigned)(r % 4);
    array_in.value = array_items; mpz_set_ui(array_in.count, r); mpz_set_si(array_values[position], -1);
    int failed = !BOX_REJECTED(genericrecords_push_count(&array_in, &array_out, &error));
    mpz_set_ui(array_values[0], 1); mpz_set(array_values[1], array_wide); mpz_set_ui(array_values[2], 3);
    failed = failed || !OK(genericrecords_push_count(&array_in, &array_out, &error)) || array_out.value.length != 4 || !is_small(array_out.value.data[3], r) || !is_small(array_out.count, r + 1);
    genericrecords_array_box_clear(&array_out);
    mpz_set_ui(array_count, size);
    failed = failed || !OK(genericrecords_row_of(array_count, &made, &error)) || made.length != size;
    failed = failed || !OK(genericrecords_row_total(&made, array_sum, &error)) || !is_small(array_sum, size * size * (size ? size - 1 : 0) / 2);
    genericrecords_row_box made_box; genericrecords_row_box_init(&made_box);
    made_box.value = made; mpz_set_ui(made_box.count, r);
    failed = failed || !OK(genericrecords_row_box_sum(&made_box, array_sum, &error)) || !is_small(array_sum, r + size * (size ? size - 1 : 0) / 2);
    mpz_clear(made_box.count);
    genericrecords_array_lean_generic_records_nat_box_span_clear(&made);
    /* The rejected RowBox holds the real row with one negative member, then that same restored input recovers. */
    row_box.value = row; mpz_set_ui(row_box.count, r); mpz_set_si(row_items[position].value, -1);
    failed = failed || !SUM_REJECTED(genericrecords_row_box_sum(&row_box, array_sum, &error))
      || row_box.value.data != row_items || row_box.value.length != 3 || mpz_cmp_si(row_items[position].value, -1) != 0;
    mpz_set_ui(row_items[0].value, 2); mpz_set(row_items[1].value, array_wide); mpz_set_ui(row_items[2].value, 0);
    mpz_add_ui(array_expected, array_wide, 2 + r);
    failed = failed || !OK(genericrecords_row_box_sum(&row_box, array_sum, &error)) || mpz_cmp(array_sum, array_expected) != 0;
    if (failed) { fprintf(stderr, "array round %lu failed\n", r); return 1; }
  }
  checks += 1000;
#undef BOX_REJECTED
#undef SUM_REJECTED
#undef ARRAY_REJECTED
  genericrecords_array_box_clear(&array_out); mpz_clear(array_in.count); mpz_clear(row_box.count);
  for (unsigned a = 0; a < 3; ++a) { mpz_clear(array_values[a]); genericrecords_nat_box_clear(&row_items[a]); }
  mpz_clear(array_wide); mpz_clear(array_sum); mpz_clear(array_expected); mpz_clear(array_count);
