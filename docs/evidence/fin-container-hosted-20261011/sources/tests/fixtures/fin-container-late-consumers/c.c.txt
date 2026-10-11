  {
    const unsigned late_before = checks;
    char late_bytes[3][8] = {"alpha", "mid\0dle", "omega"}, late_saved_bytes[3][8];
    memcpy(late_saved_bytes, late_bytes, sizeof(late_bytes));
    const size_t late_lengths[] = {5, 7, 5};
    fincontainers_string late_names[3];
    mpz_t late_offsets[3], late_saved_offsets[3];
    for (unsigned i = 0; i < 3; ++i) {
      late_names[i] = (fincontainers_string){late_bytes[i], late_lengths[i], NULL, NULL};
      mpz_init_set_ui(late_offsets[i], i + 1); mpz_init_set(late_saved_offsets[i], late_offsets[i]);
    }
    fincontainers_array_string_span late_labels = {late_names, 3, NULL, NULL};
    nats late_values = {late_offsets, 3, NULL, NULL};
#define LATE_NAME_SAME(i) (late_names[i].data == late_bytes[i] && late_names[i].length == late_lengths[i] && !late_names[i].owner && !late_names[i].release && memcmp(late_bytes[i], late_saved_bytes[i], sizeof(late_bytes[i])) == 0)
#define LATE_NAMES_SAME (late_labels.data == late_names && late_labels.length == 3 && !late_labels.owner && !late_labels.release && LATE_NAME_SAME(0) && LATE_NAME_SAME(1) && LATE_NAME_SAME(2))
#define LATE_OFFSETS_SAME (late_values.data == late_offsets && late_values.length == 3 && !late_values.owner && !late_values.release && mpz_cmp(late_offsets[0], late_saved_offsets[0]) == 0 && mpz_cmp(late_offsets[1], late_saved_offsets[1]) == 0 && mpz_cmp(late_offsets[2], late_saved_offsets[2]) == 0)
    /* Six deliberate mutations prove that neither snapshot aliases mutable input. */
    for (unsigned i = 0; i < 3; ++i) {
      unsigned at = i == 1 ? 5 : 0;
      late_bytes[i][at] ^= 1; CHECK(!LATE_NAMES_SAME); late_bytes[i][at] ^= 1;
      mpz_add_ui(late_offsets[i], late_offsets[i], 1); CHECK(!LATE_OFFSETS_SAME); mpz_sub_ui(late_offsets[i], late_offsets[i], 1);
    }
    CHECK(LATE_NAMES_SAME); CHECK(LATE_OFFSETS_SAME);
    /* Nine position/value combinations, then 1,000 rejection/recovery pairs. */
    for (unsigned cycle = 0; cycle < 1009; ++cycle) {
      unsigned position = cycle % 3, representation = (cycle / 3) % 3;
      for (unsigned i = 0; i < 3; ++i) mpz_set_ui(late_offsets[i], i + 1);
      if (representation == 2) mpz_set_str(late_offsets[position], huge_text, 10);
      else mpz_set_ui(late_offsets[position], 4 + representation);
      for (unsigned i = 0; i < 3; ++i) mpz_set(late_saved_offsets[i], late_offsets[i]);
      char message[96], poison[] = "unchanged";
      snprintf(message, sizeof(message), "arg1[%u] is not below its Fin 4 bound", position);
      fincontainers_error late_error = {0};
      fincontainers_string late_output = {poison, 991, NULL, NULL};
      CHECK(rejected(fincontainers_label(&late_labels, &late_values, &late_output, &late_error), &late_error, message));
      CHECK(late_output.data == poison && late_output.length == 991 && !late_output.owner && !late_output.release);
      CHECK(LATE_NAMES_SAME); CHECK(LATE_OFFSETS_SAME);
      for (unsigned i = 0; i < 3; ++i) { mpz_set_ui(late_offsets[i], i + 1); mpz_set(late_saved_offsets[i], late_offsets[i]); }
      late_output = (fincontainers_string){0};
      static const char result[] = "alpha:1,mid\0dle:2,omega:3";
      CHECK(OK(fincontainers_label(&late_labels, &late_values, &late_output, &late_error)) && late_output.length == sizeof(result) - 1 && memcmp(late_output.data, result, sizeof(result) - 1) == 0);
      CHECK(LATE_NAMES_SAME); CHECK(LATE_OFFSETS_SAME);
      fincontainers_string_clear(&late_output);
    }
    for (unsigned i = 0; i < 3; ++i) { mpz_clear(late_offsets[i]); mpz_clear(late_saved_offsets[i]); }
    CHECK(checks - late_before == 7071);
#undef LATE_OFFSETS_SAME
#undef LATE_NAMES_SAME
#undef LATE_NAME_SAME
  }
