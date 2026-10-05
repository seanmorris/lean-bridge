/* Whole-owner moves must revoke borrowed descendants before callbacks run. */
typedef struct {
  owned_aggregates_result **slot;
  owned_aggregates_result *original;
  owned_aggregates_result *borrowed;
  owned_aggregates_ticket_t old_view;
  unsigned calls, fail;
} wit_move_state;
static owned_aggregates_status wit_move_callback(void *raw, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  wit_move_state *state = raw; ++state->calls;
  CHECK(!*state->slot && !*owner);
  CHECK(owned_aggregates_result_validate(session, state->original) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(owned_aggregates_result_validate(session, state->borrowed) == OWNED_AGGREGATES_CLOSED);
  expired(session, state->old_view);
  serial(session, input->primary, 42);
  CHECK(input->peers->length == 2 && mpz_cmp_si(input->payload->count, -1234567) == 0);
  if (state->fail) return OWNED_AGGREGATES_CALLBACK_FAILED;
  *out = *input; return OWNED_AGGREGATES_OK;
}
static void wit_borrowed_moves(void) {
  for (unsigned fail = 0; fail < 2; ++fail) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *root = NULL, *anchor = NULL, *borrowed = NULL, *owner = NULL;
    owned_aggregates_ticket_t value = ticket(session, 42, &root);
    bundle_input input; bundle_init(&input, value);
    owned_aggregates_scalar_string_t label = {0}; owned_aggregates_payload_t payload = {0};
    OK(owned_aggregates_label(session, value, &label, &owner));
    CHECK(label.length == 12 && !memcmp(label.data, "borrow\0label", 12)); clear(&owner);
    OK(owned_aggregates_payload(session, &input.value, &payload, &owner));
    CHECK(mpz_cmp_si(payload.count, -1234567) == 0 && payload.bytes.length == 3); clear(&owner);
    owned_aggregates_bundle_t argument = {0}, view = {0}, out, unchanged;
    OK(owned_aggregates_bundle_t_copy(session, &input.value, &argument, &anchor));
    OK(owned_aggregates_echo_record(session, &argument, anchor, &view, &borrowed));
    wit_move_state state = {&anchor, anchor, borrowed, view.primary, 0, fail};
    owned_aggregates_callback_record_argument1_t_host host = {.call = wit_move_callback, .context = &state};
    memset(&out, 0xa5, sizeof(out)); unchanged = out;
    owned_aggregates_status status = owned_aggregates_move_record(session, &argument, &anchor, &host, &out, &owner);
    CHECK(!anchor && state.calls == 1);
    CHECK(owned_aggregates_result_validate(session, borrowed) == OWNED_AGGREGATES_CLOSED);
    if (fail) {
      CHECK(status == OWNED_AGGREGATES_CALLBACK_FAILED && !owner);
      CHECK(!memcmp(&out, &unchanged, sizeof(out)));
    } else {
      OK(status); bundle_check(session, &out, value); clear(&owner);
    }
    serial(session, value, 42); clear(&borrowed); clear(&root); mpz_clear(input.number);
    OK(owned_aggregates_session_close(&session)); clean();
  }
  for (unsigned present = 0; present < 2; ++present) {
    owned_aggregates_session *session = NULL; OK(owned_aggregates_session_open(&session));
    owned_aggregates_result *root = NULL, *anchor = NULL, *borrowed = NULL, *owner = NULL;
    owned_aggregates_ticket_t value = ticket(session, 42, &root);
    owned_aggregates_echo_array_argument0_t input = {present ? &value : NULL, present};
    owned_aggregates_echo_array_result_t source = {0}, view = {0}, out = {0};
    OK(COPY_ARRAY(session, &input, &source, &anchor));
    OK(owned_aggregates_echo_array(session, &source, anchor, &view, &borrowed));
    OK(owned_aggregates_move_array(session, &source, &anchor, &out, &owner));
    CHECK(!anchor && out.length == present);
    CHECK(owned_aggregates_result_validate(session, borrowed) == OWNED_AGGREGATES_CLOSED);
    if (present) { expired(session, view.data[0]); serial(session, out.data[0], 42); }
    clear(&borrowed); clear(&owner); clear(&root);
    OK(owned_aggregates_session_close(&session)); clean();
  }
}
