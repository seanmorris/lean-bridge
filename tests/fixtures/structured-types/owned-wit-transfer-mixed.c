/* Extends the independent public C transfer consumer with mixed and boxed data. */
#include <math.h>

static void missing_transfer_frame(void) {
  owned_aggregates_session *session = NULL;
  OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *owner = NULL, *output_owner = NULL;
  owned_aggregates_ticket_t input = ticket(session, 42, &owner), output = NULL;
  owned_aggregates_result *original = owner;
  CHECK(owned_aggregates_retain_ticket(session, input, &owner, &output, &output_owner)
      == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owner == original && !output && !output_owner);
  serial(session, input, 42); clear(&owner);
  OK(owned_aggregates_session_close(&session));
  CHECK(live == 0 && owned_test_identities() == 0);
}

static void mixed_and_boxed_moves(void) {
  owned_aggregates_session *session = NULL;
  OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t item = ticket(session, 42, &ticket_owner);
  owned_aggregates_scalar_string_t label = {0};
  OK(owned_aggregates_label(session, item, &label, &owner));
  CHECK(label.length == 12 && !memcmp(label.data, "ticket\0label", 12)); clear(&owner);
  bundle_input bundle; bundle_init(&bundle, item);
  owned_aggregates_ticket_t primary = NULL;
  OK(owned_aggregates_primary(session, &bundle.value, &primary, &owner));
  CHECK(primary == item); clear(&owner);
  owned_aggregates_payload_t payload = {0};
  OK(owned_aggregates_payload(session, &bundle.value, &payload, &owner));
  CHECK(mpz_cmp(payload.count, bundle.number) == 0 && payload.bytes.length == 3);
  CHECK(!memcmp(payload.bytes.data, bundle.bytes, 3)); clear(&owner);

  owned_aggregates_chain_t stop = { .kind = OWNED_AGGREGATES_CHAIN_T_KIND_STOP };
  owned_aggregates_chain_link_next_t end = {true, &stop};
  owned_aggregates_chain_t chain = { .kind = OWNED_AGGREGATES_CHAIN_T_KIND_LINK, .cases.link = {item, &end} };
  owned_aggregates_chain_t copied_chain = {0}, returned_chain = {0};
  OK(owned_aggregates_chain_t_copy(session, &chain, &copied_chain, &input_owner));
  owned_aggregates_result *stale = input_owner;
  end.value = &chain;
  CHECK(owned_aggregates_echo_chain(session, &chain, &input_owner, &returned_chain, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(input_owner == stale && !owner); end.value = &stop;
  OK(owned_aggregates_echo_chain(session, &copied_chain, &input_owner, &returned_chain, &owner));
  CHECK(!input_owner && returned_chain.kind == OWNED_AGGREGATES_CHAIN_T_KIND_LINK);
  CHECK(returned_chain.cases.link.ticket == item && returned_chain.cases.link.next->has_value);
  CHECK(returned_chain.cases.link.next->value->kind == OWNED_AGGREGATES_CHAIN_T_KIND_STOP);
  clear(&owner);
  OK(owned_aggregates_chain_t_copy(session, &stop, &copied_chain, &input_owner));
  OK(owned_aggregates_echo_chain(session, &copied_chain, &input_owner, &returned_chain, &owner));
  CHECK(!input_owner && returned_chain.kind == OWNED_AGGREGATES_CHAIN_T_KIND_STOP); clear(&owner);

  owned_aggregates_mixed_markers_element_value_t absent = {0}, present = {true, false};
  owned_aggregates_mixed_markers_element_t items[] = {{0}, {true, &absent}, {true, &present}};
  owned_aggregates_mixed_markers_t markers = {items, 3};
  owned_aggregates_mixed_unit_t unit = {true, 0};
  owned_aggregates_mixed_result_t result = {.is_ok = true, .ok = &bundle.value};
  uint64_t integers[] = {0, UINT64_MAX};
  owned_aggregates_mixed_words_t words = {integers, 2};
  owned_aggregates_mixed_product_snd_t tail = {&bundle.spare, &bundle.payload};
  owned_aggregates_mixed_product_t product = {item, &tail};
  mpz_t huge, negative; mpz_init(huge); mpz_init(negative);
  mpz_setbit(huge, 180); mpz_add_ui(huge, huge, 7); mpz_neg(negative, huge);
  owned_aggregates_mixed_t source = {
    .ticket = item, .markers = &markers, .unit = &unit, .result = &result,
    .signed_ = negative, .unsigned_ = huge, .scalar = 0x1f680, .precise = -0.0,
    .approximate = INFINITY, .bytes = {bundle.bytes, 3}, .words = &words,
    .product = &product, .chain = &chain
  };
  for (unsigned branch = 0; branch < 2; ++branch) {
    result.is_ok = branch != 0; result.error = item;
    unit.has_value = branch != 0;
    owned_aggregates_mixed_t input = {0}, out = {0};
    OK(owned_aggregates_mixed_t_copy(session, &source, &input, &input_owner));
    stale = input_owner;
    source.unsigned_ = negative;
    CHECK(owned_aggregates_echo_mixed(session, &source, &input_owner, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
    CHECK(input_owner == stale && !owner); source.unsigned_ = huge;
    OK(owned_aggregates_echo_mixed(session, &input, &input_owner, &out, &owner));
    CHECK(!input_owner && out.ticket == item && out.scalar == 0x1f680);
    CHECK(mpz_cmp(out.signed_, negative) == 0 && mpz_cmp(out.unsigned_, huge) == 0);
    CHECK(out.precise == 0 && signbit(out.precise) && isinf(out.approximate) && out.approximate > 0);
    CHECK(out.markers->length == 3 && !out.markers->data[0].has_value);
    CHECK(out.markers->data[1].has_value && !out.markers->data[1].value->has_value);
    CHECK(out.markers->data[2].has_value && out.markers->data[2].value->has_value && !out.markers->data[2].value->value);
    CHECK(out.unit->has_value == unit.has_value);
    if (unit.has_value) CHECK(out.unit->value == 0);
    CHECK(out.result->is_ok == result.is_ok);
    if (result.is_ok) bundle_check(out.result->ok); else CHECK(out.result->error == item);
    CHECK(out.words->length == 2 && out.words->data[0] == 0 && out.words->data[1] == UINT64_MAX);
    CHECK(out.bytes.length == 3 && !memcmp(out.bytes.data, bundle.bytes, 3));
    CHECK(out.product->fst == item && out.product->snd->fst->has_value && out.product->snd->fst->value == item);
    CHECK(mpz_cmp(out.product->snd->snd->count, bundle.number) == 0);
    CHECK(out.chain->kind == OWNED_AGGREGATES_CHAIN_T_KIND_LINK && out.chain->cases.link.ticket == item);
    CHECK(out.chain->cases.link.next->has_value && out.chain->cases.link.next->value->kind == OWNED_AGGREGATES_CHAIN_T_KIND_STOP);
    clear(&owner);
  }
  mpz_clear(huge); mpz_clear(negative); mpz_clear(bundle.number); clear(&ticket_owner);
  OK(owned_aggregates_session_close(&session)); CHECK(live == 0 && owned_test_identities() == 0);
}
