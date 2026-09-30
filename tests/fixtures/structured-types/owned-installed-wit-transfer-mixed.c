/* Installed mixed values use only public C types and standard C/GMP APIs. */
#include <math.h>

static void mixed_values(void) {
  owned_aggregates_session *s = NULL; OK(owned_aggregates_session_open(&s));
  owned_aggregates_result *ticket_owner = NULL, *input_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t item = ticket(s, 42, &ticket_owner);
  sample v; sample_init(&v, item);
  owned_aggregates_scalar_string_t label = {0};
  OK(owned_aggregates_label(s, item, &label, &owner));
  CHECK(label.length == 8 && !memcmp(label.data, "key\0name", 8)); release(&owner);
  owned_aggregates_ticket_t primary = NULL;
  OK(owned_aggregates_primary(s, &v.bundle, &primary, &owner));
  CHECK(primary == item); release(&owner);
  owned_aggregates_payload_t payload = {0};
  OK(owned_aggregates_payload(s, &v.bundle, &payload, &owner));
  CHECK(mpz_cmp(payload.count, v.n) == 0 && payload.bytes.length == 3);
  CHECK(!memcmp(payload.bytes.data, v.bytes, 3)); release(&owner);
  owned_aggregates_chain_t stop = {.kind = OWNED_AGGREGATES_CHAIN_T_KIND_STOP};
  owned_aggregates_chain_link_next_t next = {true, &stop};
  owned_aggregates_chain_t chain = {.kind = OWNED_AGGREGATES_CHAIN_T_KIND_LINK, .cases.link = {item, &next}};
  owned_aggregates_chain_t copied = {0}, returned = {0};
  OK(owned_aggregates_chain_t_copy(s, &chain, &copied, &input_owner));
  owned_aggregates_result *stale = input_owner;
  next.value = &chain;
  CHECK(owned_aggregates_echo_chain(s, &chain, &input_owner, &returned, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(input_owner == stale && !owner); next.value = &stop;
  OK(owned_aggregates_echo_chain(s, &copied, &input_owner, &returned, &owner));
  CHECK(!input_owner && returned.kind == OWNED_AGGREGATES_CHAIN_T_KIND_LINK);
  CHECK(returned.cases.link.ticket == item && returned.cases.link.next->has_value);
  CHECK(returned.cases.link.next->value->kind == OWNED_AGGREGATES_CHAIN_T_KIND_STOP); release(&owner);
  owned_aggregates_mixed_markers_element_value_t absent = {0}, present = {true, false};
  owned_aggregates_mixed_markers_element_t options[] = {{0}, {true, &absent}, {true, &present}};
  owned_aggregates_mixed_markers_t markers = {options, 3};
  owned_aggregates_mixed_unit_t unit = {true, 0};
  owned_aggregates_mixed_result_t result = {.is_ok = true, .ok = &v.bundle};
  uint64_t integers[] = {0, UINT64_MAX}; owned_aggregates_mixed_words_t words = {integers, 2};
  owned_aggregates_mixed_product_snd_t tail = {&v.spare, &v.payload};
  owned_aggregates_mixed_product_t product = {item, &tail};
  mpz_t big; mpz_init(big); mpz_setbit(big, 180); mpz_add_ui(big, big, 7);
  owned_aggregates_mixed_t source = {.ticket = item, .markers = &markers, .unit = &unit,
    .result = &result, .signed_ = v.n, .unsigned_ = big, .scalar = 0x1f680,
    .precise = -0.0, .approximate = INFINITY, .bytes = {v.bytes, 3},
    .words = &words, .product = &product, .chain = &chain};
  for (unsigned branch = 0; branch < 2; ++branch) {
    result.is_ok = branch != 0; result.error = item; unit.has_value = branch != 0;
    owned_aggregates_mixed_t input = {0}, out = {0};
    OK(owned_aggregates_mixed_t_copy(s, &source, &input, &input_owner)); stale = input_owner;
    source.unsigned_ = v.n;
    CHECK(owned_aggregates_echo_mixed(s, &source, &input_owner, &out, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
    CHECK(input_owner == stale && !owner); source.unsigned_ = big;
    OK(owned_aggregates_echo_mixed(s, &input, &input_owner, &out, &owner));
    CHECK(!input_owner && out.ticket == item && out.scalar == 0x1f680);
    CHECK(mpz_cmp(out.signed_, v.n) == 0 && mpz_cmp(out.unsigned_, big) == 0);
    CHECK(out.precise == 0 && signbit(out.precise) && isinf(out.approximate) && out.approximate > 0);
    CHECK(out.markers->length == 3 && !out.markers->data[0].has_value);
    CHECK(out.markers->data[1].has_value && !out.markers->data[1].value->has_value);
    CHECK(out.markers->data[2].has_value && out.markers->data[2].value->has_value && !out.markers->data[2].value->value);
    CHECK(out.unit->has_value == unit.has_value && (!unit.has_value || out.unit->value == 0));
    CHECK(out.result->is_ok == result.is_ok);
    if (result.is_ok) bundle_check(out.result->ok); else CHECK(out.result->error == item);
    CHECK(out.words->length == 2 && !out.words->data[0] && out.words->data[1] == UINT64_MAX);
    CHECK(out.bytes.length == 3 && !memcmp(out.bytes.data, v.bytes, 3));
    CHECK(out.product->fst == item && out.product->snd->fst->has_value && out.product->snd->fst->value == item);
    CHECK(mpz_cmp(out.product->snd->snd->count, v.n) == 0);
    CHECK(out.chain->kind == OWNED_AGGREGATES_CHAIN_T_KIND_LINK && out.chain->cases.link.ticket == item);
    CHECK(out.chain->cases.link.next->has_value && out.chain->cases.link.next->value->kind == OWNED_AGGREGATES_CHAIN_T_KIND_STOP);
    release(&owner);
  }
  mpz_clear(big); mpz_clear(v.n); release(&ticket_owner); OK(owned_aggregates_session_close(&s));
}
