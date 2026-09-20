#include "lists.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int same(double a, double b) { return (isnan(a) && isnan(b)) || (a == b && (a != 0 || !!signbit(a) == !!signbit(b))); }
int main(void) {
  lists_error error = {0}; uint8_t bytes[] = {0, 255};
  /* scalar cases */
  lists_string texts[] = {{"a\0", 2, NULL, NULL}, {"", 0, NULL, NULL}, {"z", 1, NULL, NULL}};
  lists_list_string_span words = {texts, 3, NULL, NULL}; lists_string joined; lists_string_init(&joined);
  CHECK(lists_join(&words, &joined, &error) == LISTS_STATUS_OK);
  CHECK(joined.length == 11 && !memcmp(joined.data, "a\0🌱🌱z", 11)); lists_string_clear(&joined);
  uint32_t values[] = {1, 2, 3};
  lists_array_uint32_span arrayRows[] = {{values, 3, NULL, NULL}, {NULL, 0, NULL, NULL}};
  lists_list_array_uint32_span mixed = {arrayRows, 2, NULL, NULL};
  lists_array_list_uint32_span mixedOut; lists_array_list_uint32_span_init(&mixedOut);
  CHECK(lists_mix(&mixed, &mixedOut, &error) == LISTS_STATUS_OK);
  CHECK(mixedOut.length == 2 && !mixedOut.data[0].length && mixedOut.data[1].length == 3);
  CHECK(mixedOut.data[1].data[0] == 3 && mixedOut.data[1].data[2] == 1); lists_array_list_uint32_span_clear(&mixedOut);
  lists_packet packet, copied; lists_packet_init(&packet); lists_packet_init(&copied);
  lists_list_uint32_span sequences[] = {{values, 3, NULL, NULL}, {NULL, 0, NULL, NULL}};
  lists_option_result_tuple_nat_unit_string_value branches[3];
  for (unsigned i = 0; i < 3; ++i) lists_option_result_tuple_nat_unit_string_value_init(&branches[i]);
  branches[1].has_value = 1; branches[1].value.is_ok = 1; mpz_setbit(branches[1].value.ok.fst, 100);
  branches[2].has_value = 1; branches[2].value.error = (lists_string){"x\0", 2, NULL, NULL};
  lists_bytes buffers[] = {{bytes, 2, NULL, NULL}, {NULL, 0, NULL, NULL}};
  lists_tuple_bool_char_value pairRows[] = {{true, 0x1f331}, {false, 0x10ffff}};
  lists_list_tuple_bool_char_span arrays[] = {{pairRows, 2, NULL, NULL}, {NULL, 0, NULL, NULL}};
  packet.sequences = (lists_list_list_uint32_span){sequences, 2, NULL, NULL};
  packet.branches = (lists_list_option_result_tuple_nat_unit_string_span){branches, 3, NULL, NULL};
  packet.buffers = (lists_list_bytes_span){buffers, 2, NULL, NULL};
  packet.arrays = (lists_array_list_tuple_bool_char_span){arrays, 2, NULL, NULL};
  for (unsigned round = 0; round < 20; ++round) {
    CHECK(lists_transform(&packet, &copied, &error) == LISTS_STATUS_OK);
    CHECK(copied.sequences.length == 2 && !copied.sequences.data[0].length && copied.sequences.data[1].data[0] == 3);
    CHECK(copied.branches.length == 3 && !copied.branches.data[2].has_value);
    CHECK(copied.branches.data[0].has_value && !copied.branches.data[0].value.is_ok);
    CHECK(copied.branches.data[0].value.error.length == 3 && !memcmp(copied.branches.data[0].value.error.data, "x\0!", 3));
    CHECK(copied.branches.data[1].has_value && copied.branches.data[1].value.is_ok);
    CHECK(mpz_tstbit(copied.branches.data[1].value.ok.fst, 100) && mpz_tstbit(copied.branches.data[1].value.ok.fst, 0));
    CHECK(copied.buffers.length == 2 && !copied.buffers.data[0].length && copied.buffers.data[1].data != bytes);
    CHECK(copied.arrays.length == 2 && !copied.arrays.data[0].length && copied.arrays.data[1].data[0].snd == 0x10ffff);
    lists_packet_clear(&copied); lists_packet_clear(&copied);
  }
  pairRows[0].snd = 0xd800; CHECK(lists_transform(&packet, &copied, &error) == LISTS_STATUS_INVALID_ARGUMENT);
  pairRows[0].snd = 65; CHECK(lists_transform(&packet, &copied, &error) == LISTS_STATUS_OK); lists_packet_clear(&copied);
  lists_packet_clear(&packet); for (unsigned i = 0; i < 3; ++i) lists_option_result_tuple_nat_unit_string_value_clear(&branches[i]);
  lists_option_list_result_list_unit_string_value nest, nested;
  lists_option_list_result_list_unit_string_value_init(&nest); lists_option_list_result_list_unit_string_value_init(&nested);
  CHECK(lists_nest(&nest, &nested, &error) == LISTS_STATUS_OK); CHECK(!nested.has_value);
  uint8_t units[] = {0, 0}; lists_result_list_unit_string_value nestRows[2];
  for (unsigned i = 0; i < 2; ++i) lists_result_list_unit_string_value_init(&nestRows[i]);
  nestRows[0].is_ok = 1; nestRows[0].ok = (lists_list_unit_span){units, 2, NULL, NULL}; nestRows[1].error = texts[0];
  nest.has_value = 1; nest.value = (lists_list_result_list_unit_string_span){nestRows, 2, NULL, NULL};
  CHECK(lists_nest(&nest, &nested, &error) == LISTS_STATUS_OK);
  CHECK(nested.has_value && nested.value.length == 2 && !nested.value.data[0].is_ok && nested.value.data[0].error.length == 3);
  CHECK(nested.value.data[1].is_ok && nested.value.data[1].ok.length == 2); lists_option_list_result_list_unit_string_value_clear(&nested);
  lists_result_tuple_list_nat_list_uint32_list_string_value sum; lists_result_tuple_list_nat_list_uint32_list_string_value_init(&sum);
  lists_result_list_string_tuple_list_nat_list_uint32_value swapped; lists_result_list_string_tuple_list_nat_list_uint32_value_init(&swapped);
  sum.error = words; CHECK(lists_swap(&sum, &swapped, &error) == LISTS_STATUS_OK);
  CHECK(swapped.is_ok && swapped.ok.length == 3 && swapped.ok.data[0].length == 1 && swapped.ok.data[0].data[0] == 'z'); lists_result_list_string_tuple_list_nat_list_uint32_value_clear(&swapped);
  mpz_t numbers[2]; mpz_init_set_ui(numbers[0], 42); mpz_init_set_ui(numbers[1], 0);
  sum.is_ok = 1; sum.ok.fst = (lists_list_nat_span){numbers, 2, NULL, NULL}; sum.ok.snd = sequences[0];
  CHECK(lists_swap(&sum, &swapped, &error) == LISTS_STATUS_OK);
  CHECK(!swapped.is_ok && swapped.error.fst.length == 2 && !mpz_cmp_ui(swapped.error.fst.data[1], 42));
  CHECK(swapped.error.snd.length == 3 && swapped.error.snd.data[0] == 3); lists_result_list_string_tuple_list_nat_list_uint32_value_clear(&swapped);
  mpz_clear(numbers[0]); mpz_clear(numbers[1]);
  lists_list_bytes_span duplicated; lists_list_bytes_span_init(&duplicated);
  CHECK(lists_duplicate(&buffers[0], &duplicated, &error) == LISTS_STATUS_OK);
  CHECK(duplicated.length == 2 && duplicated.data[0].data != duplicated.data[1].data && duplicated.data[0].data != bytes);
  bytes[0] = 9; CHECK(duplicated.data[0].data[0] == 0 && duplicated.data[1].data[0] == 0); lists_list_bytes_span_clear(&duplicated);
  lists_bytes big = {calloc(6u * 1024u * 1024u, 1), 6u * 1024u * 1024u, NULL, NULL}; CHECK(big.data);
  CHECK(lists_duplicate(&big, &duplicated, &error) == LISTS_STATUS_INVALID_ARGUMENT); CHECK(!duplicated.length); free((void*)big.data);
  mpz_t count; mpz_init_set_ui(count, 30000); lists_list_uint32_span generated; lists_list_uint32_span_init(&generated);
  CHECK(lists_generate(count, &generated, &error) == LISTS_STATUS_OK); CHECK(generated.length == 30000);
  for (unsigned i = 0; i < generated.length; ++i) CHECK(generated.data[i] == 7);
  lists_list_uint32_span_clear(&generated);
  mpz_set_ui(count, 2097153); CHECK(lists_generate(count, &generated, &error) == LISTS_STATUS_INVALID_ARGUMENT); CHECK(!generated.length);
  mpz_set_ui(count, 1); CHECK(lists_generate(count, &generated, &error) == LISTS_STATUS_OK); CHECK(generated.length == 1); lists_list_uint32_span_clear(&generated); mpz_clear(count);
  double floats[] = {NAN, INFINITY, -INFINITY, -0.0, 0.0}; lists_list_float64_span f = {floats, 5, NULL, NULL}, g; lists_list_float64_span_init(&g);
  CHECK(lists_reverse_float64(&f, &g, &error) == LISTS_STATUS_OK); for (unsigned i = 0; i < 5; ++i) CHECK(same(g.data[i], floats[4-i])); lists_list_float64_span_clear(&g);
  /* deep cases */
  printf("list-ok:%u\n", checks);
}
