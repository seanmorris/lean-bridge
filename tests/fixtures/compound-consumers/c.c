#include "compounds.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int same(double a, double b) { return (isnan(a) && isnan(b)) || (a == b && (a != 0 || !!signbit(a) == !!signbit(b))); }
int main(void) {
  compounds_error error = {0}; uint8_t bytes[] = {0, 255};
  /* scalar cases */
  compounds_option_option_unit_value state, next;
  compounds_option_option_unit_value_init(&state); compounds_option_option_unit_value_init(&next);
  for (unsigned step = 0; step < 30; ++step) {
    uint32_t found = 9;
    CHECK(compounds_classify(&state, &found, &error) == COMPOUNDS_STATUS_OK); CHECK(found == step % 3);
    CHECK(compounds_next(&state, &next, &error) == COMPOUNDS_STATUS_OK); state = next;
  }
  compounds_option_option_unit_value_clear(&state); compounds_option_option_unit_value_clear(&next);
  compounds_option_result_tuple_uint64_unit_string_value made; compounds_option_result_tuple_uint64_unit_string_value_init(&made);
  CHECK(compounds_make(&made, &error) == COMPOUNDS_STATUS_OK);
  CHECK(made.has_value && made.value.is_ok && made.value.ok.fst == UINT64_MAX && made.value.ok.snd == 0);
  compounds_option_result_tuple_uint64_unit_string_value_clear(&made);
  compounds_packet input, output; compounds_packet_init(&input); compounds_packet_init(&output);
  input.choice.has_value = 1; input.choice.value.is_ok = 1; mpz_setbit(input.choice.value.ok.fst, 100);
  input.products.fst.fst = 4; input.products.fst.snd = (compounds_string){"a\0", 2, NULL, NULL};
  input.products.snd.fst = true; input.products.snd.snd = 0x1f331;
  input.nested.is_ok = 0; input.nested.error.has_value = 1; mpz_set_ui(input.nested.error.value, 123);
  compounds_option_result_tuple_string_uint64_tuple_bytes_int_value rows[3];
  for (unsigned i = 0; i < 3; ++i) compounds_option_result_tuple_string_uint64_tuple_bytes_int_value_init(&rows[i]);
  rows[1].has_value = 1; rows[1].value.is_ok = 1;
  rows[1].value.ok.fst = (compounds_string){"x\0", 2, NULL, NULL}; rows[1].value.ok.snd = UINT64_MAX;
  rows[2].has_value = 1; rows[2].value.is_ok = 0;
  rows[2].value.error.fst = (compounds_bytes){bytes, 2, NULL, NULL}; mpz_set_si(rows[2].value.error.snd, -123);
  input.rows = (compounds_array_option_result_tuple_string_uint64_tuple_bytes_int_span){rows, 3, NULL, NULL};
  for (unsigned round = 0; round < 30; ++round) {
    CHECK(compounds_transform(&input, &output, &error) == COMPOUNDS_STATUS_OK);
    CHECK(output.choice.has_value && output.choice.value.is_ok); CHECK(mpz_tstbit(output.choice.value.ok.fst, 100) && mpz_tstbit(output.choice.value.ok.fst, 0));
    CHECK(output.products.fst.fst == 5 && output.products.fst.snd.length == 3 && !memcmp(output.products.fst.snd.data, "a\0!", 3));
    CHECK(!output.products.snd.fst && output.products.snd.snd == 0x1f331);
    CHECK(!output.nested.is_ok && output.nested.error.has_value && !mpz_cmp_ui(output.nested.error.value, 123));
    CHECK(output.rows.length == 3 && !output.rows.data[2].has_value);
    CHECK(output.rows.data[0].has_value && !output.rows.data[0].value.is_ok && !mpz_cmp_si(output.rows.data[0].value.error.snd, -123));
    CHECK(output.rows.data[1].has_value && output.rows.data[1].value.is_ok && output.rows.data[1].value.ok.snd == UINT64_MAX);
    CHECK(output.rows.data[0].value.error.fst.data != bytes);
    compounds_packet_clear(&output); compounds_packet_clear(&output);
  }
  input.choice.value.is_ok = 0; input.choice.value.error = (compounds_string){"bad", 3, NULL, NULL};
  CHECK(compounds_transform(&input, &output, &error) == COMPOUNDS_STATUS_OK);
  CHECK(!output.choice.value.is_ok && output.choice.value.error.length == 4 && !memcmp(output.choice.value.error.data, "bad!", 4));
  compounds_packet_clear(&output);
  input.products.snd.snd = 0xd800; CHECK(compounds_transform(&input, &output, &error) == COMPOUNDS_STATUS_INVALID_ARGUMENT);
  input.products.snd.snd = 65; CHECK(compounds_transform(&input, &output, &error) == COMPOUNDS_STATUS_OK);
  compounds_packet_clear(&input); compounds_packet_clear(&output);
  for (unsigned i = 0; i < 3; ++i) compounds_option_result_tuple_string_uint64_tuple_bytes_int_value_clear(&rows[i]);
  compounds_option_bytes_value big; compounds_option_bytes_value_init(&big);
  compounds_result_option_array_bytes_string_value copied; compounds_result_option_array_bytes_string_value_init(&copied);
  big.has_value = 1; big.value.length = 6u * 1024u * 1024u; big.value.data = calloc(big.value.length, 1); CHECK(big.value.data);
  CHECK(compounds_duplicate(&big, &copied, &error) == COMPOUNDS_STATUS_INVALID_ARGUMENT); CHECK(!copied.is_ok);
  free((void*)big.value.data); big.value = (compounds_bytes){bytes, 2, NULL, NULL};
  CHECK(compounds_duplicate(&big, &copied, &error) == COMPOUNDS_STATUS_OK);
  CHECK(copied.is_ok && copied.ok.has_value && copied.ok.value.length == 2 && copied.ok.value.data[0].length == 2);
  CHECK(copied.ok.value.data[0].data != copied.ok.value.data[1].data);
  compounds_result_option_array_bytes_string_value_clear(&copied); compounds_option_bytes_value_clear(&big);
  /* deep cases */
  printf("compound-ok:%u\n", checks);
}
