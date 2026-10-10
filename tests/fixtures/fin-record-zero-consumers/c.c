#include <finrecordzero.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks;
static const char *huge = "1267650600228229401496703205376";
#define CHECK(value) do { if (!(value)) { fprintf(stderr, "failed at %d\n", __LINE__); exit(1); } ++checks; } while (0)
typedef struct fixture { finrecordzero_fields value; mpz_t payload[2], digit; } fixture;
static void init(fixture *f, const char *member, const char *digit) {
  memset(f, 0, sizeof(*f));
  mpz_init_set_ui(f->payload[0], 7); mpz_init_set_str(f->payload[1], huge, 10); mpz_init_set_str(f->digit, digit, 10);
  f->value.label = (finrecordzero_string){"kept", 4, NULL, NULL};
  f->value.payload.data = f->payload; f->value.payload.length = 2;
  if (!strcmp(member, "array")) { f->value.array.data = &f->digit; f->value.array.length = 1; }
  if (!strcmp(member, "list")) { f->value.list.data = &f->digit; f->value.list.length = 1; }
}
static void drop(fixture *f) { mpz_clear(f->payload[0]); mpz_clear(f->payload[1]); mpz_clear(f->digit); }
static int same_nats(const mpz_t *a, size_t n, const mpz_t *b, size_t m) {
  if (n != m) return 0;
  for (size_t i = 0; i < n; ++i) if (mpz_cmp(a[i], b[i])) return 0;
  return 1;
}
static int same(const finrecordzero_fields *a, const finrecordzero_fields *b) {
  return a->label.length == b->label.length && (!a->label.length || !memcmp(a->label.data, b->label.data, a->label.length))
    && same_nats(a->payload.data, a->payload.length, b->payload.data, b->payload.length)
    && same_nats(a->array.data, a->array.length, b->array.data, b->array.length)
    && same_nats(a->list.data, a->list.length, b->list.data, b->list.length);
}
static int rejected(finrecordzero_status status, const finrecordzero_error *error, const char *path) {
  char expected[160]; snprintf(expected, sizeof(expected), "%s is not below its Fin 0 bound", path);
  return status == FINRECORDZERO_STATUS_INVALID_ARGUMENT && error->code == FINRECORDZERO_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && !memcmp(error->message, expected, strlen(expected));
}
static void field_call(const char *member, const char *digit, int fail) {
  fixture input, before; init(&input, member, digit); init(&before, member, digit);
  finrecordzero_fields out = {0}; unsigned char output_before[sizeof(out)]; memcpy(output_before, &out, sizeof(out));
  finrecordzero_error error = {0};
  finrecordzero_status status = finrecordzero_field_collections(&input.value, &out, &error);
  if (fail) {
    char path[80]; snprintf(path, sizeof(path), "arg0.%s[0]", member);
    CHECK(rejected(status, &error, path) && same(&input.value, &before.value) && !memcmp(output_before, &out, sizeof(out)));
  } else {
    CHECK(status == FINRECORDZERO_STATUS_OK && same(&input.value, &before.value) && same(&out, &before.value));
    finrecordzero_fields_clear(&out);
  }
  drop(&input); drop(&before);
}
#define RECORDS(SPAN, CALL, CLEAR) do { \
  SPAN input = {0}, out = {0}; finrecordzero_error error = {0}; \
  CHECK(CALL(&input, &out, &error) == FINRECORDZERO_STATUS_OK && out.length == 0); CLEAR(&out); \
  for (unsigned d = 0; d < 3; ++d) { \
    finrecordzero_zero value; finrecordzero_zero_init(&value); mpz_set_str(value.digit, digits[d], 10); \
    mpz_t before; mpz_init_set_str(before, digits[d], 10); \
    input.data = &value; input.length = 1; unsigned char kept[sizeof(out)]; memcpy(kept, &out, sizeof(out)); \
    CHECK(rejected(CALL(&input, &out, &error), &error, "arg0[0].digit") && input.data == &value && input.length == 1 \
      && mpz_cmp(value.digit, before) == 0 && !memcmp(kept, &out, sizeof(out))); \
    finrecordzero_zero_clear(&value); mpz_clear(before); \
  } \
  input.data = NULL; input.length = 0; \
  CHECK(CALL(&input, &out, &error) == FINRECORDZERO_STATUS_OK && out.length == 0); CLEAR(&out); \
} while (0)
#define ROWS(SPAN, CALL, CLEAR) do { \
  SPAN input = {0}, out = {0}; finrecordzero_error error = {0}; \
  CHECK(CALL(&input, &out, &error) == FINRECORDZERO_STATUS_OK && out.length == 0); CLEAR(&out); \
  fixture values[3], snapshots[3]; finrecordzero_fields row[3]; \
  for (unsigned k = 0; k < 3; ++k) { init(&values[k], "", "0"); init(&snapshots[k], "", "0"); row[k] = values[k].value; } \
  input.data = row; input.length = 3; \
  finrecordzero_status status = CALL(&input, &out, &error); \
  int valid = status == FINRECORDZERO_STATUS_OK && out.length == 3; \
  for (unsigned k = 0; k < 3 && valid; ++k) valid = same(&row[k], &snapshots[k].value) && same(&out.data[k], &snapshots[k].value); \
  CHECK(valid); CLEAR(&out); \
  for (unsigned index = 0; index < 3; ++index) for (unsigned part = 0; part < 2; ++part) { \
    const char *member = part ? "list" : "array"; \
    drop(&values[index]); drop(&snapshots[index]); init(&values[index], member, "0"); init(&snapshots[index], member, "0"); row[index] = values[index].value; \
    char path[80]; snprintf(path, sizeof(path), "arg0[%u].%s[0]", index, member); \
    unsigned char output_before[sizeof(out)]; memcpy(output_before, &out, sizeof(out)); \
    status = CALL(&input, &out, &error); \
    valid = rejected(status, &error, path) && input.data == row && input.length == 3 && !memcmp(output_before, &out, sizeof(out)); \
    for (unsigned k = 0; k < 3 && valid; ++k) valid = same(&row[k], &snapshots[k].value); \
    CHECK(valid); \
    drop(&values[index]); drop(&snapshots[index]); init(&values[index], "", "0"); init(&snapshots[index], "", "0"); row[index] = values[index].value; \
    status = CALL(&input, &out, &error); valid = status == FINRECORDZERO_STATUS_OK && out.length == 3; \
    for (unsigned k = 0; k < 3 && valid; ++k) valid = same(&row[k], &snapshots[k].value) && same(&out.data[k], &snapshots[k].value); \
    CHECK(valid); CLEAR(&out); \
  } \
  for (unsigned k = 0; k < 3; ++k) { drop(&values[k]); drop(&snapshots[k]); } \
} while (0)
int main(void) {
  const char *digits[] = {"0", "1", huge};
  RECORDS(finrecordzero_array_lean_fin_record_zero_zero_span, finrecordzero_array_records, finrecordzero_array_lean_fin_record_zero_zero_span_clear);
  RECORDS(finrecordzero_list_lean_fin_record_zero_zero_span, finrecordzero_list_records, finrecordzero_list_lean_fin_record_zero_zero_span_clear);
  field_call("", "0", 0);
  for (unsigned part = 0; part < 2; ++part) for (unsigned d = 0; d < 3; ++d) field_call(part ? "list" : "array", digits[d], 1);
  field_call("", "0", 0);
  ROWS(finrecordzero_array_lean_fin_record_zero_fields_span, finrecordzero_array_fields, finrecordzero_array_lean_fin_record_zero_fields_span_clear);
  ROWS(finrecordzero_list_lean_fin_record_zero_fields_span, finrecordzero_list_fields, finrecordzero_list_lean_fin_record_zero_fields_span_clear);
  for (unsigned index = 0; index < 1000; ++index) {
    char digit[16]; snprintf(digit, sizeof(digit), "%u", index);
    field_call("", "0", 0); field_call(index % 2 ? "list" : "array", digit, 1);
  }
  printf("fin-record-zero-ok:%u\n", checks);
  return 0;
}
