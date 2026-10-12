#include <nominalsubtypes.h>
#include <stdio.h>
#include <string.h>

typedef nominalsubtypes_envelope Envelope;
typedef nominalsubtypes_option_lean_nominal_subtypes_envelope_value Maybe;
typedef nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span Group;
typedef nominalsubtypes_option_result_nat_nat_value Choice;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define OK(call) ((call) == NOMINALSUBTYPES_STATUS_OK)
static int small(mpz_srcptr value, unsigned long expected) { return mpz_cmp_ui(value, expected) == 0; }
static int projected(const Envelope *value, mpz_srcptr expected) { return mpz_cmp(value->payload, expected) == 0 && small(value->digit, 2); }
static int projected_group(const Group *value, mpz_srcptr expected) {
  return value->data && value->length == 2 && !value->data[0].has_value
    && value->data[1].has_value && projected(&value->data[1].value, expected);
}
#ifndef NOMINAL_RESULT_ONLY
static int rejected(nominalsubtypes_status status, const nominalsubtypes_error *error, const char *expected) {
  return status == NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT && error->code == NOMINALSUBTYPES_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}
static void box(Envelope *value, unsigned long payload, unsigned long digit) { mpz_set_ui(value->payload, payload); mpz_set_ui(value->digit, digit); }
static int same_box(const Envelope *a, const Envelope *b) { return mpz_cmp(a->payload, b->payload) == 0 && mpz_cmp(a->digit, b->digit) == 0; }
static int same_group(const Group *group, const Maybe *items, const Maybe *before, size_t length) {
  if (group->data != items || group->length != length || group->owner || group->release) return 0;
  for (size_t i = 0; i < length; ++i)
    if (items[i].has_value != before[i].has_value || !same_box(&items[i].value, &before[i].value)) return 0;
  return 1;
}
static void copy_maybe(Maybe *out, const Maybe *in) {
  out->has_value = in->has_value; mpz_set(out->value.payload, in->value.payload); mpz_set(out->value.digit, in->value.digit);
}
#endif

int main(void) {
  nominalsubtypes_error error = {0};
  mpz_t value, before, one, two, count, huge;
  mpz_inits(value, before, one, two, count, huge, NULL); mpz_setbit(huge, 100);
  for (unsigned which = 0; which < 3; ++which) {
    if (which < 2) mpz_set_ui(value, which ? 40 : 0); else mpz_set(value, huge);
    mpz_set(before, value); mpz_add_ui(one, value, 1); mpz_add_ui(two, value, 2);
    CHECK(OK(nominalsubtypes_scalar(value, count, &error)) && mpz_cmp(count, one) == 0);
    Envelope envelope; nominalsubtypes_envelope_init(&envelope);
    CHECK(OK(nominalsubtypes_produce_envelope(value, &envelope, &error)) && projected(&envelope, one));
    nominalsubtypes_envelope_clear(&envelope);
    nominalsubtypes_array_nat_span array = {0};
    CHECK(OK(nominalsubtypes_array_values(value, &array, &error)) && array.length == 2 && mpz_cmp(array.data[0], one) == 0 && mpz_cmp(array.data[1], two) == 0);
    nominalsubtypes_array_nat_span_clear(&array);
    nominalsubtypes_list_nat_span list = {0};
    CHECK(OK(nominalsubtypes_list_values(value, &list, &error)) && list.length == 2 && mpz_cmp(list.data[0], one) == 0 && mpz_cmp(list.data[1], two) == 0);
    nominalsubtypes_list_nat_span_clear(&list);
    nominalsubtypes_option_nat_value option; nominalsubtypes_option_nat_value_init(&option);
    CHECK(OK(nominalsubtypes_optional(value, &option, &error)) && (which == 0 ? !option.has_value : option.has_value && mpz_cmp(option.value, one) == 0));
    nominalsubtypes_option_nat_value_clear(&option);
    nominalsubtypes_tuple_nat_nat_value product; nominalsubtypes_tuple_nat_nat_value_init(&product);
    CHECK(OK(nominalsubtypes_product(value, &product, &error)) && mpz_cmp(product.fst, one) == 0 && mpz_cmp(product.snd, two) == 0);
    nominalsubtypes_tuple_nat_nat_value_clear(&product);
    nominalsubtypes_result_nat_nat_value branch; nominalsubtypes_result_nat_nat_value_init(&branch);
    CHECK(OK(nominalsubtypes_branch(value, &branch, &error)) && (which == 0 ? !branch.is_ok && mpz_cmp(branch.error, one) == 0 : branch.is_ok && mpz_cmp(branch.ok, one) == 0));
    nominalsubtypes_result_nat_nat_value_clear(&branch);
    Group group = {0};
    CHECK(OK(nominalsubtypes_group_values(value, &group, &error)) && projected_group(&group, one));
    nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(&group);
    nominalsubtypes_alias_pair pair; nominalsubtypes_alias_pair_init(&pair);
    CHECK(OK(nominalsubtypes_pair_values(value, &pair, &error)) && projected_group(&pair.left, one) && projected_group(&pair.right, two));
    nominalsubtypes_alias_pair_clear(&pair);
    nominalsubtypes_event event; nominalsubtypes_event_init(&event);
    CHECK(OK(nominalsubtypes_event_value(value, &event, &error)) && event.kind == NOMINALSUBTYPES_EVENT_KIND_BOX && projected(&event.cases.box.value, one));
    nominalsubtypes_event_clear(&event); nominalsubtypes_event_init(&event);
    CHECK(OK(nominalsubtypes_event_empty(value, &event, &error)) && event.kind == NOMINALSUBTYPES_EVENT_KIND_EMPTY);
    nominalsubtypes_event_clear(&event); nominalsubtypes_event_init(&event);
    CHECK(OK(nominalsubtypes_event_choices(value, &event, &error)) && event.kind == NOMINALSUBTYPES_EVENT_KIND_CHOICES
      && event.cases.choices.values.length == 3 && !event.cases.choices.values.data[0].has_value
      && event.cases.choices.values.data[1].has_value && event.cases.choices.values.data[1].value.is_ok && mpz_cmp(event.cases.choices.values.data[1].value.ok, one) == 0
      && event.cases.choices.values.data[2].has_value && !event.cases.choices.values.data[2].value.is_ok && mpz_cmp(event.cases.choices.values.data[2].value.error, two) == 0);
    nominalsubtypes_event_clear(&event);
    CHECK(OK(nominalsubtypes_no_items(value, &array, &error)) && array.length == 0);
    nominalsubtypes_array_nat_span_clear(&array);
    CHECK(mpz_cmp(value, before) == 0);
  }
#ifdef NOMINAL_RESULT_ONLY
  for (unsigned round = 0; round < 1000; ++round) {
    mpz_add_ui(value, huge, round); mpz_add_ui(one, value, 1); mpz_add_ui(two, value, 2);
    nominalsubtypes_alias_pair pair; nominalsubtypes_alias_pair_init(&pair);
    CHECK(OK(nominalsubtypes_pair_values(value, &pair, &error)) && projected_group(&pair.left, one));
    CHECK(projected_group(&pair.right, two));
    nominalsubtypes_alias_pair_clear(&pair);
  }
#else
  Envelope input, snapshot, output; nominalsubtypes_envelope_init(&input); nominalsubtypes_envelope_init(&snapshot); nominalsubtypes_envelope_init(&output);
  box(&input, 40, 2); box(&snapshot, 40, 2);
  CHECK(OK(nominalsubtypes_first(&input, count, &error)) && small(count, 41));
  CHECK(OK(nominalsubtypes_second(&input, count, &error)) && small(count, 42));
  CHECK(OK(nominalsubtypes_combine(&input, &input, count, &error)) && small(count, 4142));
  CHECK(same_box(&input, &snapshot));
  nominalsubtypes_pair nested; nominalsubtypes_pair_init(&nested); box(&nested.left, 40, 2); box(&nested.right, 40, 2);
  CHECK(OK(nominalsubtypes_nested(&nested, count, &error)) && small(count, 4142));
  box(&input, 99, 2); CHECK(OK(nominalsubtypes_first(&input, count, &error)) && small(count, 100));
  box(&input, 89, 2); CHECK(OK(nominalsubtypes_second(&input, count, &error)) && small(count, 91));
  box(&input, 90, 2); CHECK(OK(nominalsubtypes_first(&input, count, &error)) && small(count, 91));
  mpz_set_ui(count, 777);
  CHECK(rejected(nominalsubtypes_second(&input, count, &error), &error, "value0.payload was rejected by NominalSubtypes.plusTwo") && small(count, 777) && small(input.payload, 90));
  box(&input, 100, 2);
  CHECK(rejected(nominalsubtypes_first(&input, count, &error), &error, "value0.payload was rejected by NominalSubtypes.plusOne") && small(count, 777) && small(input.payload, 100));
  CHECK(rejected(nominalsubtypes_combine(&input, &snapshot, count, &error), &error, "value0.payload was rejected by NominalSubtypes.plusOne") && small(count, 777));
  box(&input, 90, 2);
  CHECK(rejected(nominalsubtypes_combine(&snapshot, &input, count, &error), &error, "value1.payload was rejected by NominalSubtypes.plusTwo") && small(count, 777));
  box(&nested.left, 100, 2);
  CHECK(rejected(nominalsubtypes_nested(&nested, count, &error), &error, "value0.left.payload was rejected by NominalSubtypes.plusOne") && small(count, 777));
  box(&nested.left, 40, 2); box(&nested.right, 90, 2);
  CHECK(rejected(nominalsubtypes_nested(&nested, count, &error), &error, "value0.right.payload was rejected by NominalSubtypes.plusTwo") && small(count, 777));
  box(&input, 40, 2); CHECK(OK(nominalsubtypes_echo(&input, &output, &error)) && small(output.payload, 41) && small(output.digit, 2) && same_box(&input, &snapshot));
  box(&input, 100, 2);
  CHECK(rejected(nominalsubtypes_echo(&input, &output, &error), &error, "value0.payload was rejected by NominalSubtypes.plusOne") && small(output.payload, 41) && small(output.digit, 2));
  box(&input, 40, 2);
  nominalsubtypes_event event; nominalsubtypes_event_init(&event);
  Choice choices[3], saved[3];
  for (unsigned i = 0; i < 3; ++i) { nominalsubtypes_option_result_nat_nat_value_init(&choices[i]); nominalsubtypes_option_result_nat_nat_value_init(&saved[i]); }
  for (unsigned which = 0; which < 2; ++which) {
    nominalsubtypes_status (*call)(const nominalsubtypes_event *, mpz_ptr, nominalsubtypes_error *) = which ? nominalsubtypes_event_second : nominalsubtypes_event_first;
    CHECK(OK(nominalsubtypes_event_select(&event, NOMINALSUBTYPES_EVENT_KIND_EMPTY)));
    CHECK(OK(call(&event, count, &error)) && small(count, 0));
    CHECK(OK(nominalsubtypes_event_select(&event, NOMINALSUBTYPES_EVENT_KIND_BOX))); box(&event.cases.box.value, 40, 2);
    CHECK(OK(call(&event, count, &error)) && small(count, which ? 42 : 41));
    CHECK(OK(nominalsubtypes_event_select(&event, NOMINALSUBTYPES_EVENT_KIND_CHOICES)));
    CHECK(OK(call(&event, count, &error)) && small(count, 0));
    event.cases.choices.values = (nominalsubtypes_array_option_result_nat_nat_span){choices, 3, NULL, NULL};
    choices[0].has_value = 0; choices[1].has_value = 1; choices[1].value.is_ok = 1; mpz_set_ui(choices[1].value.ok, 40);
    choices[2].has_value = 1; choices[2].value.is_ok = 0; mpz_set_ui(choices[2].value.error, 40);
    CHECK(OK(call(&event, count, &error)) && small(count, 83));
    for (unsigned branch = 0; branch < 2; ++branch) for (unsigned position = 0; position < 3; ++position) {
      for (unsigned i = 0; i < 3; ++i) {
        saved[i].has_value = choices[i].has_value; saved[i].value.is_ok = choices[i].value.is_ok;
        mpz_set(saved[i].value.ok, choices[i].value.ok); mpz_set(saved[i].value.error, choices[i].value.error);
      }
      choices[position].has_value = 1; choices[position].value.is_ok = branch == 0;
      mpz_set_ui(branch == 0 ? choices[position].value.ok : choices[position].value.error, 100);
      char message[200]; snprintf(message, sizeof(message), "value0.choices.values[%u]?.%s was rejected by NominalSubtypes.%s", position, branch == 0 ? "ok" : "error", (which == branch) ? "plusOne" : "plusTwo");
      mpz_set_ui(count, 777);
      CHECK(rejected(call(&event, count, &error), &error, message) && small(count, 777));
      CHECK(choices[position].has_value && choices[position].value.is_ok == (branch == 0) && small(branch == 0 ? choices[position].value.ok : choices[position].value.error, 100)
        && event.cases.choices.values.data == choices && event.cases.choices.values.length == 3 && !event.cases.choices.values.owner && !event.cases.choices.values.release);
      for (unsigned i = 0; i < 3; ++i) {
        if (i != position) CHECK(choices[i].has_value == saved[i].has_value && choices[i].value.is_ok == saved[i].value.is_ok && mpz_cmp(choices[i].value.ok, saved[i].value.ok) == 0 && mpz_cmp(choices[i].value.error, saved[i].value.error) == 0);
        choices[i].has_value = saved[i].has_value; choices[i].value.is_ok = saved[i].value.is_ok;
        mpz_set(choices[i].value.ok, saved[i].value.ok); mpz_set(choices[i].value.error, saved[i].value.error);
      }
    }
  }
  nominalsubtypes_event echoed; nominalsubtypes_event_init(&echoed);
  CHECK(OK(nominalsubtypes_echo_event(&event, &echoed, &error)) && echoed.kind == NOMINALSUBTYPES_EVENT_KIND_CHOICES
    && echoed.cases.choices.values.length == 3 && small(echoed.cases.choices.values.data[1].value.ok, 41) && small(echoed.cases.choices.values.data[2].value.error, 42));
  nominalsubtypes_event_clear(&echoed); nominalsubtypes_event_init(&echoed);
  CHECK(OK(nominalsubtypes_event_select(&event, NOMINALSUBTYPES_EVENT_KIND_BOX))); box(&event.cases.box.value, 40, 2);
  CHECK(OK(nominalsubtypes_echo_event(&event, &echoed, &error)) && echoed.kind == NOMINALSUBTYPES_EVENT_KIND_BOX && small(echoed.cases.box.value.payload, 41));
  box(&event.cases.box.value, 100, 3);
  CHECK(rejected(nominalsubtypes_echo_event(&event, &echoed, &error), &error, "value0.box.value.digit is not below its Fin 3 bound") && echoed.kind == NOMINALSUBTYPES_EVENT_KIND_BOX && small(echoed.cases.box.value.payload, 41));
  CHECK(OK(nominalsubtypes_event_select(&event, NOMINALSUBTYPES_EVENT_KIND_EMPTY)));
  CHECK(OK(nominalsubtypes_echo_event(&event, &echoed, &error)) && echoed.kind == NOMINALSUBTYPES_EVENT_KIND_EMPTY);
  nominalsubtypes_event_clear(&event); nominalsubtypes_event_clear(&echoed);
  for (unsigned i = 0; i < 3; ++i) { nominalsubtypes_option_result_nat_nat_value_clear(&choices[i]); nominalsubtypes_option_result_nat_nat_value_clear(&saved[i]); }
  Maybe left_items[3], right_items[2], left_before[3], right_before[2], bad_items[3], bad_before[3];
  for (unsigned i = 0; i < 3; ++i) {
    nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&left_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&left_before[i]);
    nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&bad_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&bad_before[i]);
  }
  for (unsigned i = 0; i < 2; ++i) { nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&right_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_init(&right_before[i]); }
  left_items[1].has_value = 1; box(&left_items[1].value, 40, 2); left_items[2].has_value = 1; box(&left_items[2].value, 1, 0);
  right_items[0].has_value = 1; box(&right_items[0].value, 2, 1);
  for (unsigned i = 0; i < 3; ++i) copy_maybe(&left_before[i], &left_items[i]);
  for (unsigned i = 0; i < 2; ++i) copy_maybe(&right_before[i], &right_items[i]);
  Group left = {left_items, 3, NULL, NULL}, right = {right_items, 2, NULL, NULL}, bad = {bad_items, 3, NULL, NULL}, groups_out = {0}, empty = {0};
  nominalsubtypes_alias_pair pair = {left, right}, pair_out; nominalsubtypes_alias_pair_init(&pair_out);
  CHECK(OK(nominalsubtypes_aliases(&left, &right, count, &error)) && small(count, 47));
  CHECK(OK(nominalsubtypes_inspect_alias_pair(&pair, count, &error)) && small(count, 47));
  CHECK(OK(nominalsubtypes_echo_groups(&left, &groups_out, &error)) && groups_out.data != left.data && groups_out.length == 3
    && !groups_out.data[0].has_value && groups_out.data[1].has_value && small(groups_out.data[1].value.payload, 41) && small(groups_out.data[2].value.payload, 2));
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(&groups_out);
  CHECK(OK(nominalsubtypes_echo_pair(&pair, &pair_out, &error)) && pair_out.left.length == 3 && pair_out.right.length == 2
    && small(pair_out.left.data[1].value.payload, 41) && small(pair_out.left.data[2].value.payload, 2) && small(pair_out.right.data[0].value.payload, 4));
  nominalsubtypes_alias_pair twice; nominalsubtypes_alias_pair_init(&twice);
  CHECK(OK(nominalsubtypes_echo_pair(&pair_out, &twice, &error)) && small(twice.left.data[1].value.payload, 42) && small(twice.left.data[2].value.payload, 3) && small(twice.right.data[0].value.payload, 6));
  nominalsubtypes_alias_pair_clear(&twice);
  CHECK(OK(nominalsubtypes_echo_groups(&empty, &groups_out, &error)) && groups_out.length == 0);
  nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear(&groups_out);
  for (unsigned position = 0; position < 3; ++position) {
    for (unsigned i = 0; i < 3; ++i) { bad_items[i].has_value = i != 1; box(&bad_items[i].value, 40, 2); }
    bad_items[position].has_value = 1; box(&bad_items[position].value, 100, 2);
    for (unsigned i = 0; i < 3; ++i) copy_maybe(&bad_before[i], &bad_items[i]);
    char message[200]; snprintf(message, sizeof(message), "value0[%u]?.payload was rejected by NominalSubtypes.plusOne", position);
    CHECK(rejected(nominalsubtypes_echo_groups(&bad, &groups_out, &error), &error, message) && !groups_out.data && !groups_out.length && same_group(&bad, bad_items, bad_before, 3));
    nominalsubtypes_alias_pair bad_pair = {bad, right}; mpz_set_ui(count, 777);
    snprintf(message, sizeof(message), "value0.left[%u]?.payload was rejected by NominalSubtypes.plusOne", position);
    CHECK(rejected(nominalsubtypes_inspect_alias_pair(&bad_pair, count, &error), &error, message) && small(count, 777));
    bad_pair = (nominalsubtypes_alias_pair){left, bad};
    snprintf(message, sizeof(message), "value0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo", position);
    CHECK(rejected(nominalsubtypes_inspect_alias_pair(&bad_pair, count, &error), &error, message) && small(count, 777));
    CHECK(same_group(&bad, bad_items, bad_before, 3));
  }
  box(&input, 100, 2); box(&snapshot, 40, 3); mpz_set_ui(count, 777);
  CHECK(rejected(nominalsubtypes_combine(&input, &snapshot, count, &error), &error, "value1.digit is not below its Fin 3 bound") && small(count, 777));
  box(&nested.left, 100, 2); box(&nested.right, 40, 3);
  CHECK(rejected(nominalsubtypes_nested(&nested, count, &error), &error, "value0.right.digit is not below its Fin 3 bound") && small(count, 777));
  box(&left_items[1].value, 100, 2); right_items[1].has_value = 1; box(&right_items[1].value, 40, 3);
  CHECK(rejected(nominalsubtypes_aliases(&left, &right, count, &error), &error, "value1[1]?.digit is not below its Fin 3 bound") && small(count, 777));
  for (unsigned i = 0; i < 3; ++i) copy_maybe(&left_items[i], &left_before[i]);
  for (unsigned i = 0; i < 2; ++i) copy_maybe(&right_items[i], &right_before[i]);
  mpz_set_ui(value, 2); CHECK(OK(nominalsubtypes_plain_fin(value, count, &error)) && small(count, 2));
  mpz_set_ui(value, 3); CHECK(rejected(nominalsubtypes_plain_fin(value, count, &error), &error, "value0 is not below its Fin 3 bound") && small(count, 2));
  for (unsigned round = 0; round < 1000; ++round) {
    for (unsigned i = 0; i < 3; ++i) { bad_items[i].has_value = i == 1; box(&bad_items[i].value, 1, 2); }
    bad_items[round % 3].has_value = 1; box(&bad_items[round % 3].value, 90, 2);
    for (unsigned i = 0; i < 3; ++i) copy_maybe(&bad_before[i], &bad_items[i]);
    const nominalsubtypes_alias_pair bad_pair = {left, bad};
    const Maybe *kept_left = pair_out.left.data, *kept_right = pair_out.right.data;
    char message[200]; snprintf(message, sizeof(message), "value0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo", round % 3);
    CHECK(rejected(nominalsubtypes_echo_pair(&bad_pair, &pair_out, &error), &error, message));
    CHECK(pair_out.left.data == kept_left && pair_out.right.data == kept_right && pair_out.left.length == 3 && pair_out.right.length == 2
      && small(pair_out.left.data[1].value.payload, 41) && small(pair_out.right.data[0].value.payload, 4));
    CHECK(same_group(&bad, bad_items, bad_before, 3) && same_group(&left, left_items, left_before, 3) && same_group(&right, right_items, right_before, 2));
    nominalsubtypes_alias_pair_clear(&pair_out); nominalsubtypes_alias_pair_init(&pair_out);
    CHECK(OK(nominalsubtypes_echo_pair(&pair, &pair_out, &error)) && small(pair_out.left.data[1].value.payload, 41) && small(pair_out.right.data[0].value.payload, 4));
  }
  nominalsubtypes_alias_pair_clear(&pair_out);
  for (unsigned i = 0; i < 3; ++i) {
    nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&left_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&left_before[i]);
    nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&bad_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&bad_before[i]);
  }
  for (unsigned i = 0; i < 2; ++i) { nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&right_items[i]); nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear(&right_before[i]); }
  nominalsubtypes_pair_clear(&nested); nominalsubtypes_envelope_clear(&input); nominalsubtypes_envelope_clear(&snapshot); nominalsubtypes_envelope_clear(&output);
#endif
  mpz_clears(value, before, one, two, count, huge, NULL);
  printf("nominal-subtype-ok:%u\n", checks);
  return 0;
}
