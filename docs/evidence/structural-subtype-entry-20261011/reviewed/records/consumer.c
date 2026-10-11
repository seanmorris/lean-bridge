#include <structuralsubtypes.h>
#include <stdio.h>
#include <string.h>

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == STRUCTURALSUBTYPES_STATUS_OK)
typedef structuralsubtypes_array_nat_span Nats;
typedef structuralsubtypes_option_nat_value Maybe;
typedef structuralsubtypes_array_option_nat_span Group;
static int small(mpz_srcptr value, unsigned long expected) { return mpz_cmp_ui(value, expected) == 0; }
static int rejected(structuralsubtypes_status status, const structuralsubtypes_error *error, const char *expected) {
  return status == STRUCTURALSUBTYPES_STATUS_INVALID_ARGUMENT && error->code == STRUCTURALSUBTYPES_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static int same_group(const Group *group, const Maybe *values, const mpz_t *snapshot, const unsigned char *tags) {
  if (group->data != values || group->length != 3 || group->owner || group->release) return 0;
  for (unsigned i = 0; i < 3; ++i) if (values[i].has_value != tags[i] || mpz_cmp(values[i].value, snapshot[i])) return 0;
  return 1;
}

int main(void) {
  structuralsubtypes_error error = {0};
  mpz_t huge, wide, count, values[3];
  mpz_inits(huge, wide, count, NULL); mpz_setbit(huge, 100); mpz_set_str(wide, "184467440737095516170", 10);
  for (unsigned i = 0; i < 3; ++i) mpz_init_set_ui(values[i], i + 1);
  mpz_set(values[1], huge);
  CHECK(OK(structuralsubtypes_scalar(huge, count, &error)) && mpz_cmp(count, huge) == 0);
  mpz_set_ui(count, 0);
  CHECK(rejected(structuralsubtypes_scalar(count, count, &error), &error, "value0 was rejected by StructuralSubtypes.checkedPositive") && small(count, 0));
  Nats input = {values, 3, NULL, NULL}, out = {0}, empty = {0};
  structuralsubtypes_list_nat_span list = {values, 3, NULL, NULL}, list_out = {0}, empty_list = {0};
  CHECK(OK(structuralsubtypes_arrays(&empty, &out, &error)) && out.length == 0);
  structuralsubtypes_array_nat_span_clear(&out);
  CHECK(OK(structuralsubtypes_lists(&empty_list, &list_out, &error)) && list_out.length == 0);
  structuralsubtypes_list_nat_span_clear(&list_out);
  CHECK(OK(structuralsubtypes_arrays(&input, &out, &error)) && out.length == 3 && mpz_cmp(out.data[1], huge) == 0);
  structuralsubtypes_array_nat_span_clear(&out);
  CHECK(OK(structuralsubtypes_lists(&list, &list_out, &error)) && list_out.length == 3 && mpz_cmp(list_out.data[1], huge) == 0);
  structuralsubtypes_list_nat_span_clear(&list_out);
  CHECK(OK(structuralsubtypes_specialized(&list, &list_out, &error)) && list_out.length == 3 && mpz_cmp(list_out.data[1], huge) == 0);
  structuralsubtypes_list_nat_span_clear(&list_out);
  for (unsigned i = 0; i < 3; ++i) {
    char message[128]; mpz_t saved; mpz_init_set(saved, values[i]); mpz_set_ui(values[i], 0);
    snprintf(message, sizeof(message), "value0[%u] was rejected by StructuralSubtypes.checkedPositive", i);
    CHECK(rejected(structuralsubtypes_arrays(&input, &out, &error), &error, message));
    CHECK(!out.data && !out.length && small(values[i], 0));
    CHECK(rejected(structuralsubtypes_lists(&list, &list_out, &error), &error, message));
    CHECK(!list_out.data && !list_out.length && small(values[i], 0));
    CHECK(rejected(structuralsubtypes_specialized(&list, &list_out, &error), &error, message));
    CHECK(!list_out.data && !list_out.length && small(values[i], 0));
    mpz_set(values[i], saved); mpz_clear(saved);
  }
  Maybe optional, option_out;
  structuralsubtypes_option_nat_value_init(&optional); structuralsubtypes_option_nat_value_init(&option_out);
  CHECK(OK(structuralsubtypes_options(&optional, &option_out, &error)) && !option_out.has_value);
  optional.has_value = 1; mpz_set(optional.value, huge);
  CHECK(OK(structuralsubtypes_options(&optional, &option_out, &error)) && option_out.has_value && mpz_cmp(option_out.value, huge) == 0);
  mpz_set_ui(optional.value, 0);
  CHECK(rejected(structuralsubtypes_options(&optional, &option_out, &error), &error, "value0? was rejected by StructuralSubtypes.checkedPositive"));
  CHECK(option_out.has_value && mpz_cmp(option_out.value, huge) == 0);
  structuralsubtypes_option_nat_value_clear(&optional); structuralsubtypes_option_nat_value_clear(&option_out);
  const char text[] = {'a', 0, 't', 'a', 'i', 'l'};
  structuralsubtypes_tuple_nat_string_value product, product_out;
  structuralsubtypes_tuple_nat_string_value_init(&product); structuralsubtypes_tuple_nat_string_value_init(&product_out);
  mpz_set(product.fst, huge); product.snd = (structuralsubtypes_string){text, sizeof(text), NULL, NULL};
  CHECK(OK(structuralsubtypes_product(&product, &product_out, &error)) && mpz_cmp(product_out.fst, huge) == 0 && product_out.snd.length == sizeof(text) && memcmp(product_out.snd.data, text, sizeof(text)) == 0);
  structuralsubtypes_tuple_nat_string_value_clear(&product_out); structuralsubtypes_tuple_nat_string_value_init(&product_out);
  product.snd.length = 0;
  CHECK(rejected(structuralsubtypes_product(&product, &product_out, &error), &error, "value0.1 was rejected by StructuralSubtypes.checkedWord"));
  product.snd.length = sizeof(text); mpz_set_ui(product.fst, 0);
  CHECK(rejected(structuralsubtypes_product(&product, &product_out, &error), &error, "value0.0 was rejected by StructuralSubtypes.checkedPositive"));
  structuralsubtypes_tuple_nat_string_value_clear(&product); structuralsubtypes_tuple_nat_string_value_clear(&product_out);
  structuralsubtypes_result_nat_string_value branch, branch_out;
  structuralsubtypes_result_nat_string_value_init(&branch); structuralsubtypes_result_nat_string_value_init(&branch_out);
  branch.is_ok = 1; mpz_set(branch.ok, huge);
  CHECK(OK(structuralsubtypes_branch(&branch, &branch_out, &error)) && branch_out.is_ok && mpz_cmp(branch_out.ok, huge) == 0);
  structuralsubtypes_result_nat_string_value_clear(&branch_out); structuralsubtypes_result_nat_string_value_init(&branch_out);
  mpz_set_ui(branch.ok, 0);
  CHECK(rejected(structuralsubtypes_branch(&branch, &branch_out, &error), &error, "value0.ok was rejected by StructuralSubtypes.checkedPositive"));
  branch.is_ok = 0; branch.error = (structuralsubtypes_string){text, sizeof(text), NULL, NULL};
  CHECK(OK(structuralsubtypes_branch(&branch, &branch_out, &error)) && !branch_out.is_ok && branch_out.error.length == sizeof(text) && memcmp(branch_out.error.data, text, sizeof(text)) == 0);
  structuralsubtypes_result_nat_string_value_clear(&branch_out); structuralsubtypes_result_nat_string_value_init(&branch_out);
  branch.error.length = 0;
  CHECK(rejected(structuralsubtypes_branch(&branch, &branch_out, &error), &error, "value0.error was rejected by StructuralSubtypes.checkedWord"));
  structuralsubtypes_result_nat_string_value_clear(&branch); structuralsubtypes_result_nat_string_value_clear(&branch_out);
  structuralsubtypes_option_tuple_uint8_nat_value byte_rows[2];
  for (unsigned i = 0; i < 2; ++i) structuralsubtypes_option_tuple_uint8_nat_value_init(&byte_rows[i]);
  byte_rows[1].has_value = 1; byte_rows[1].value.fst = 255; mpz_set(byte_rows[1].value.snd, huge);
  structuralsubtypes_array_option_tuple_uint8_nat_span bytes = {byte_rows, 2, NULL, NULL}, bytes_out = {0};
  CHECK(OK(structuralsubtypes_byte_branches(&bytes, &bytes_out, &error)) && bytes_out.length == 2 && !bytes_out.data[0].has_value && bytes_out.data[1].value.fst == 255 && mpz_cmp(bytes_out.data[1].value.snd, huge) == 0);
  structuralsubtypes_array_option_tuple_uint8_nat_span_clear(&bytes_out);
  byte_rows[1].value.fst = 0;
  CHECK(rejected(structuralsubtypes_byte_branches(&bytes, &bytes_out, &error), &error, "value0[1]?.0 was rejected by StructuralSubtypes.checkedByte"));
  byte_rows[1].value.fst = 1; mpz_set_ui(byte_rows[1].value.snd, 0);
  CHECK(rejected(structuralsubtypes_byte_branches(&bytes, &bytes_out, &error), &error, "value0[1]?.1 was rejected by StructuralSubtypes.checkedPositive"));
  for (unsigned i = 0; i < 2; ++i) structuralsubtypes_option_tuple_uint8_nat_value_clear(&byte_rows[i]);
  structuralsubtypes_option_tuple_nat_nat_value row;
  structuralsubtypes_option_tuple_nat_nat_value_init(&row); row.has_value = 1;
  mpz_set(row.value.fst, huge); mpz_sub_ui(row.value.snd, wide, 1);
  structuralsubtypes_list_option_tuple_nat_nat_span lists[3] = {{0}, {0}, {&row, 1, NULL, NULL}};
  structuralsubtypes_array_list_option_tuple_nat_nat_span nested = {lists, 3, NULL, NULL};
  CHECK(OK(structuralsubtypes_nested(&nested, count, &error)) && small(count, 3));
  mpz_set_ui(row.value.fst, 0); mpz_set(row.value.snd, wide); mpz_set_ui(count, 99);
  CHECK(rejected(structuralsubtypes_nested(&nested, count, &error), &error, "value0[2][0]?.1 is not below its Fin 184467440737095516170 bound"));
  CHECK(small(count, 99) && small(row.value.fst, 0) && mpz_cmp(row.value.snd, wide) == 0);
  mpz_sub_ui(row.value.snd, wide, 1);
  CHECK(rejected(structuralsubtypes_nested(&nested, count, &error), &error, "value0[2][0]?.0 was rejected by StructuralSubtypes.checkedPositive"));
  mpz_set_ui(row.value.fst, 1); CHECK(OK(structuralsubtypes_nested(&nested, count, &error)) && small(count, 3));
  structuralsubtypes_option_tuple_nat_nat_value_clear(&row);
  Maybe first_cells[3], second_cells[3]; mpz_t first_snapshot[3], second_snapshot[3];
  const unsigned char first_tags[3] = {1, 0, 1}, second_tags[3] = {1, 1, 1};
  for (unsigned i = 0; i < 3; ++i) {
    structuralsubtypes_option_nat_value_init(&first_cells[i]); structuralsubtypes_option_nat_value_init(&second_cells[i]);
    first_cells[i].has_value = first_tags[i]; second_cells[i].has_value = 1;
    mpz_set_ui(first_cells[i].value, i + 1); mpz_set_ui(second_cells[i].value, i + 2);
    mpz_init(first_snapshot[i]); mpz_init(second_snapshot[i]);
  }
  mpz_set(first_cells[2].value, huge); mpz_set(second_cells[0].value, huge);
  Group first = {first_cells, 3, NULL, NULL}, second = {second_cells, 3, NULL, NULL}, joined = {0};
  structuralsubtypes_tuple_array_option_nat_array_option_nat_value pair = {first, second}, pair_out;
  structuralsubtypes_tuple_array_option_nat_array_option_nat_value_init(&pair_out);
  CHECK(OK(structuralsubtypes_alias_pair(&pair, &pair_out, &error)) && small(pair_out.fst.data[0].value, 1) && !pair_out.fst.data[1].has_value && mpz_cmp(pair_out.fst.data[2].value, huge) == 0 && small(pair_out.snd.data[1].value, 4));
  mpz_add_ui(count, huge, 1); CHECK(mpz_cmp(pair_out.snd.data[0].value, count) == 0);
  structuralsubtypes_tuple_array_option_nat_array_option_nat_value_clear(&pair_out);
  CHECK(OK(structuralsubtypes_alias_arguments(&first, &second, &joined, &error)) && joined.length == 6 && mpz_cmp(joined.data[3].value, count) == 0 && small(joined.data[4].value, 4));
  structuralsubtypes_array_option_nat_span_clear(&joined);
  Maybe digit; structuralsubtypes_option_nat_value_init(&digit); Group digits = {&digit, 1, NULL, NULL};
  CHECK(OK(structuralsubtypes_plain_fin(&digits, count, &error)) && small(count, 1));
  digit.has_value = 1; mpz_set_ui(digit.value, 10);
  CHECK(rejected(structuralsubtypes_plain_fin(&digits, count, &error), &error, "value0[0]? is not below its Fin 10 bound"));
  structuralsubtypes_option_nat_value_clear(&digit);
  for (unsigned round = 0; round < 1000; ++round) {
    const unsigned bad = round % 3; mpz_t saved; mpz_init_set(saved, second_cells[bad].value); mpz_set_ui(second_cells[bad].value, 0);
    for (unsigned i = 0; i < 3; ++i) { mpz_set(first_snapshot[i], first_cells[i].value); mpz_set(second_snapshot[i], second_cells[i].value); }
    char message[128]; snprintf(message, sizeof(message), "value1[%u]? was rejected by StructuralSubtypes.normalizePositive", bad);
    CHECK(rejected(structuralsubtypes_alias_arguments(&first, &second, &joined, &error), &error, message));
    CHECK(!joined.data && !joined.length && same_group(&first, first_cells, first_snapshot, first_tags) && same_group(&second, second_cells, second_snapshot, second_tags));
    mpz_set(second_cells[bad].value, saved); mpz_clear(saved);
    for (unsigned i = 0; i < 3; ++i) mpz_set(second_snapshot[i], second_cells[i].value);
    CHECK(OK(structuralsubtypes_alias_arguments(&first, &second, &joined, &error)) && joined.length == 6 && small(joined.data[4].value, 4));
    CHECK(same_group(&first, first_cells, first_snapshot, first_tags) && same_group(&second, second_cells, second_snapshot, second_tags));
    structuralsubtypes_array_option_nat_span_clear(&joined);
  }
  for (unsigned i = 0; i < 3; ++i) {
    structuralsubtypes_option_nat_value_clear(&first_cells[i]); structuralsubtypes_option_nat_value_clear(&second_cells[i]);
    mpz_clears(first_snapshot[i], second_snapshot[i], values[i], NULL);
  }
  mpz_clears(huge, wide, count, NULL);
  printf("structural-subtype-ok:%u\n", checks);
  return 0;
}
