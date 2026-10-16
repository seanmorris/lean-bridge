#define NESTED_CHECKED_RECORD_RESULT_ONLY
#define NESTED_PARAMETER_PREFIX "value"
#include <nestedcheckedrecords.h>
#include <stdio.h>
#include <string.h>

#ifndef NESTED_PARAMETER_PREFIX
#define NESTED_PARAMETER_PREFIX "arg"
#endif

typedef nestedcheckedrecords_packet Packet;
typedef nestedcheckedrecords_array_lean_nested_checked_records_packet_span PacketArray;
typedef nestedcheckedrecords_option_lean_nested_checked_records_packet_value MaybePacket;
#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
typedef nestedcheckedrecords_list_lean_nested_checked_records_packet_span PacketList;
typedef nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value PacketPair;
typedef nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value PacketResult;
#endif

static unsigned checks;
static unsigned rejections;
static unsigned recoveries;
static unsigned snapshots;
static const unsigned rounds = 256;

#define CHECK(test) do { \
  if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)
#define SNAPSHOT(test) do { ++snapshots; CHECK(test); } while (0)
#define OK(call) ((call) == NESTEDCHECKEDRECORDS_STATUS_OK)

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
static int rejected(nestedcheckedrecords_status status, const nestedcheckedrecords_error *error,
                    const char *expected) {
  const int accepted = status == NESTEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
    && error->code == NESTEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
  if (accepted) ++rejections;
  return accepted;
}

static void packet_init(Packet *value, unsigned long digit, unsigned long word) {
  nestedcheckedrecords_packet_init(value);
  mpz_set_ui(value->digit, digit);
  mpz_set_ui(value->word, word);
}

static void packet_set(Packet *value, unsigned long digit, mpz_srcptr word) {
  mpz_set_ui(value->digit, digit);
  mpz_set(value->word, word);
}

static void packet_set_ui(Packet *value, unsigned long digit, unsigned long word) {
  mpz_set_ui(value->digit, digit);
  mpz_set_ui(value->word, word);
}
#endif

static int packet_is(const Packet *value, unsigned long digit, mpz_srcptr word) {
  return mpz_cmp_ui(value->digit, digit) == 0 && mpz_cmp(value->word, word) == 0;
}

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
static int packet_is_ui(const Packet *value, unsigned long digit, unsigned long word) {
  return mpz_cmp_ui(value->digit, digit) == 0 && mpz_cmp_ui(value->word, word) == 0;
}
#endif

int main(void) {
  nestedcheckedrecords_error error = {0};
  mpz_t input, next, out, huge;
  mpz_inits(input, next, out, huge, NULL);
  mpz_set_ui(huge, 1); mpz_mul_2exp(huge, huge, 100);
  for (unsigned round = 0; round < rounds; ++round) {
    mpz_add_ui(input, huge, round);
    mpz_add_ui(next, input, 1);
    MaybePacket option;
    nestedcheckedrecords_option_lean_nested_checked_records_packet_value_init(&option);
    CHECK(OK(nestedcheckedrecords_produce_option(input, &option, &error))
      && option.has_value && packet_is(&option.value, 0, next));
    nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear(&option);
    PacketArray array = {0};
    CHECK(OK(nestedcheckedrecords_produce_array(input, &array, &error))
      && array.length == 2 && packet_is(&array.data[0], 0, next));
    mpz_add_ui(next, input, 2);
    CHECK(array.length == 2 && packet_is(&array.data[1], 0, next));
    nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear(&array);
  }

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
  Packet first, second, rows[2];
  packet_init(&first, 2, 3); packet_init(&second, 7, 0);
  packet_init(&rows[0], 1, 2); packet_init(&rows[1], 3, 5);
  CHECK(OK(nestedcheckedrecords_first(&first, out, &error)) && mpz_cmp_ui(out, 3) == 0);
  CHECK(OK(nestedcheckedrecords_second(&second, out, &error)) && mpz_cmp_ui(out, 8) == 0);
  CHECK(OK(nestedcheckedrecords_pair(&first, &second, out, &error)) && mpz_cmp_ui(out, 11) == 0);
  PacketArray array = {rows, 2, NULL, NULL};
  CHECK(OK(nestedcheckedrecords_in_array(&array, out, &error)) && mpz_cmp_ui(out, 7) == 0);
  packet_set_ui(&rows[0], 1, 0); packet_set_ui(&rows[1], 3, 100);
  PacketList list = {rows, 2, NULL, NULL};
  CHECK(OK(nestedcheckedrecords_in_list(&list, out, &error)) && mpz_cmp_ui(out, 6) == 0);

  MaybePacket option;
  nestedcheckedrecords_option_lean_nested_checked_records_packet_value_init(&option);
  CHECK(OK(nestedcheckedrecords_in_option(&option, out, &error)) && mpz_sgn(out) == 0);
  option.has_value = 1; packet_set_ui(&option.value, 1, 2);
  CHECK(OK(nestedcheckedrecords_in_option(&option, out, &error)) && mpz_cmp_ui(out, 3) == 0);

  PacketPair pair;
  nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_init(&pair);
  packet_set_ui(&pair.fst, 1, 2); packet_set_ui(&pair.snd, 3, 0);
  CHECK(OK(nestedcheckedrecords_in_product(&pair, out, &error)) && mpz_cmp_ui(out, 6) == 0);
  PacketResult branch;
  nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_init(&branch);
  branch.is_ok = 1; packet_set_ui(&branch.ok, 2, 9);
  CHECK(OK(nestedcheckedrecords_in_except(&branch, out, &error)) && mpz_cmp_ui(out, 3) == 0);
  branch.is_ok = 0; packet_set_ui(&branch.error, 1, 2);
  CHECK(OK(nestedcheckedrecords_in_except(&branch, out, &error)) && mpz_cmp_ui(out, 3) == 0);
  nestedcheckedrecords_holder holder;
  nestedcheckedrecords_holder_init(&holder);
  packet_set_ui(&holder.packet, 3, 1); mpz_set_ui(holder.tag, 9);
  CHECK(OK(nestedcheckedrecords_in_holder(&holder, out, &error)) && mpz_cmp_ui(out, 13) == 0);
  nestedcheckedrecords_choice choice;
  nestedcheckedrecords_choice_init(&choice);
  CHECK(OK(nestedcheckedrecords_choice_select(&choice, NESTEDCHECKEDRECORDS_CHOICE_KIND_EMPTY))
    && OK(nestedcheckedrecords_in_choice(&choice, out, &error)) && mpz_sgn(out) == 0);
  CHECK(OK(nestedcheckedrecords_choice_select(&choice, NESTEDCHECKEDRECORDS_CHOICE_KIND_PACKET)));
  packet_set_ui(&choice.cases.packet.value, 2, 4);
  CHECK(OK(nestedcheckedrecords_in_choice(&choice, out, &error)) && mpz_cmp_ui(out, 5) == 0);
  packet_set_ui(&rows[0], 2, 3); packet_set(&rows[1], 1, huge);
  PacketArray echoedInput = {rows, 2, NULL, NULL}, echoed = {0};
  CHECK(OK(nestedcheckedrecords_echo_array(&echoedInput, &echoed, &error))
    && echoed.length == 2 && packet_is_ui(&echoed.data[0], 2, 3)
    && packet_is(&echoed.data[1], 1, huge));
  SNAPSHOT(packet_is_ui(&rows[0], 2, 3) && packet_is(&rows[1], 1, huge));
  nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear(&echoed);

  mpz_set_ui(out, 99); packet_set_ui(&first, 0, 0);
  CHECK(rejected(nestedcheckedrecords_first(&first, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.word was rejected by NestedCheckedRecords.mkWord")
    && mpz_cmp_ui(out, 99) == 0);
  SNAPSHOT(packet_is_ui(&first, 0, 0));
  packet_set_ui(&first, 4, 2);
  CHECK(rejected(nestedcheckedrecords_first(&first, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0 was rejected by NestedCheckedRecords.mkPacket")
    && mpz_cmp_ui(out, 99) == 0);
  SNAPSHOT(packet_is_ui(&first, 4, 2));
  packet_set_ui(&first, 10, 12);
  CHECK(rejected(nestedcheckedrecords_first(&first, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.digit is not below its Fin 10 bound")
    && mpz_cmp_ui(out, 99) == 0);
  SNAPSHOT(packet_is_ui(&first, 10, 12));
  packet_set_ui(&first, 2, 3);

  packet_set_ui(&rows[0], 2, 3); packet_set_ui(&rows[1], 1, 0);
  array = (PacketArray){rows, 2, NULL, NULL};
  CHECK(rejected(nestedcheckedrecords_in_array(&array, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0[1].word was rejected by NestedCheckedRecords.mkWord"));
  SNAPSHOT(packet_is_ui(&rows[0], 2, 3) && packet_is_ui(&rows[1], 1, 0));
  packet_set_ui(&rows[1], 5, 2);
  CHECK(rejected(nestedcheckedrecords_in_array(&array, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0[1] was rejected by NestedCheckedRecords.mkPacket"));
  SNAPSHOT(packet_is_ui(&rows[1], 5, 2));
  packet_set_ui(&rows[1], 10, 12);
  CHECK(rejected(nestedcheckedrecords_in_array(&array, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0[1].digit is not below its Fin 10 bound"));
  SNAPSHOT(packet_is_ui(&rows[1], 10, 12));

  option.has_value = 1; packet_set_ui(&option.value, 5, 2);
  CHECK(rejected(nestedcheckedrecords_in_option(&option, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0? was rejected by NestedCheckedRecords.mkPacket"));
  SNAPSHOT(packet_is_ui(&option.value, 5, 2));
  packet_set_ui(&pair.snd, 10, 0);
  CHECK(rejected(nestedcheckedrecords_in_product(&pair, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.1.digit is not below its Fin 10 bound"));
  SNAPSHOT(packet_is_ui(&pair.snd, 10, 0));
  branch.is_ok = 1; packet_set_ui(&branch.ok, 10, 0);
  CHECK(rejected(nestedcheckedrecords_in_except(&branch, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.ok.digit is not below its Fin 10 bound"));
  SNAPSHOT(branch.is_ok && packet_is_ui(&branch.ok, 10, 0));
  branch.is_ok = 0; packet_set_ui(&branch.error, 3, 1);
  CHECK(rejected(nestedcheckedrecords_in_except(&branch, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.error was rejected by NestedCheckedRecords.mkPacket"));
  SNAPSHOT(!branch.is_ok && packet_is_ui(&branch.error, 3, 1));
  packet_set_ui(&holder.packet, 10, 0);
  CHECK(rejected(nestedcheckedrecords_in_holder(&holder, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.packet.digit is not below its Fin 10 bound"));
  SNAPSHOT(packet_is_ui(&holder.packet, 10, 0) && mpz_cmp_ui(holder.tag, 9) == 0);
  packet_set_ui(&choice.cases.packet.value, 3, 1);
  CHECK(rejected(nestedcheckedrecords_in_choice(&choice, out, &error), &error,
    NESTED_PARAMETER_PREFIX "0.packet.value was rejected by NestedCheckedRecords.mkPacket"));
  SNAPSHOT(choice.kind == NESTEDCHECKEDRECORDS_CHOICE_KIND_PACKET
    && packet_is_ui(&choice.cases.packet.value, 3, 1));

  for (unsigned round = 0; round < rounds; ++round) {
    mpz_set_ui(input, round + 10);
    packet_set(&rows[0], round % 10, input);
    CHECK(OK(nestedcheckedrecords_first(&rows[0], out, &error)) && mpz_cmp(out, input) == 0);
    SNAPSHOT(packet_is(&rows[0], round % 10, input));
    packet_set_ui(&rows[1], 2, 1); mpz_set_ui(out, 99);
    CHECK(rejected(nestedcheckedrecords_first(&rows[1], out, &error), &error,
      NESTED_PARAMETER_PREFIX "0 was rejected by NestedCheckedRecords.mkPacket")
      && mpz_cmp_ui(out, 99) == 0);
    SNAPSHOT(packet_is_ui(&rows[1], 2, 1));
    packet_set_ui(&rows[1], round % 10, 0);
    CHECK(OK(nestedcheckedrecords_second(&rows[1], out, &error))
      && mpz_cmp_ui(out, round % 10 + 1) == 0);
    SNAPSHOT(packet_is_ui(&rows[1], round % 10, 0));
    packet_set_ui(&rows[1], 1, 0);
    array = (PacketArray){rows, 2, NULL, NULL};
    CHECK(rejected(nestedcheckedrecords_in_array(&array, out, &error), &error,
      NESTED_PARAMETER_PREFIX "0[1].word was rejected by NestedCheckedRecords.mkWord"));
    SNAPSHOT(packet_is(&rows[0], round % 10, input) && packet_is_ui(&rows[1], 1, 0));
    packet_set_ui(&rows[1], 2, 3);
    CHECK(OK(nestedcheckedrecords_in_array(&array, out, &error))
      && mpz_cmp_ui(out, round + 13) == 0);
    SNAPSHOT(packet_is(&rows[0], round % 10, input) && packet_is_ui(&rows[1], 2, 3));
    ++recoveries;
  }
  SNAPSHOT(packet_is_ui(&second, 7, 0));

  nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear(&option);
  nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear(&pair);
  nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear(&branch);
  nestedcheckedrecords_holder_clear(&holder);
  nestedcheckedrecords_choice_clear(&choice);
  nestedcheckedrecords_packet_clear(&first); nestedcheckedrecords_packet_clear(&second);
  nestedcheckedrecords_packet_clear(&rows[0]); nestedcheckedrecords_packet_clear(&rows[1]);
#endif

  mpz_clears(input, next, out, huge, NULL);
  printf("{\"checks\":%u,\"rejections\":%u,\"recoveries\":%u,\"snapshots\":%u,\"rounds\":%u}\n",
    checks, rejections, recoveries, snapshots, rounds);
  return 0;
}
