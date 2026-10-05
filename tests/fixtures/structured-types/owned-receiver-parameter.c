/* Included after the independent public borrow consumer's shared helpers. */
static void receiver_parameter_anchor(void) {
  owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
  owned_aggregates_result *receiver_owner = NULL, *source_owner = NULL, *owner = NULL;
  owned_aggregates_ticket_t receiver = ticket(session, 42, &receiver_owner);
  owned_aggregates_ticket_t source = ticket(session, 99, &source_owner), result = NULL;
  owned_aggregates_result *label_owner = NULL, *payload_owner = NULL;
  owned_aggregates_scalar_string_t label = {0};
  OK(owned_aggregates_label(session, receiver, &label, &label_owner));
  CHECK(label.length == 12 && memcmp(label.data, "borrow\0label", 12) == 0);
  bundle_input input; bundle_init(&input, receiver);
  owned_aggregates_payload_t payload = {0};
  OK(owned_aggregates_payload(session, &input.value, &payload, &payload_owner));
  CHECK(mpz_cmp_si(payload.count, -1234567) == 0);
  CHECK(payload.bytes.length == 3 && payload.bytes.data[1] == 255);
  mpz_clear(input.number);
  CHECK(owned_aggregates_choose_ticket(session, receiver, source, receiver_owner, &result, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!result && !owner);
  OK(owned_aggregates_choose_ticket(session, receiver, source, source_owner, &result, &owner));
  clear(&receiver_owner); serial(session, result, 99);
  OK(owned_aggregates_result_validate(session, label_owner));
  OK(owned_aggregates_result_validate(session, payload_owner));
  CHECK(memcmp(label.data, "borrow\0label", 12) == 0);
  CHECK(mpz_cmp_si(payload.count, -1234567) == 0);
  clear(&source_owner); expired(session, result);
  CHECK(owned_aggregates_result_validate(session, owner) == OWNED_AGGREGATES_CLOSED);
  clear(&owner); clear(&label_owner); clear(&payload_owner);
  OK(owned_aggregates_session_close(&session)); clean();
}
