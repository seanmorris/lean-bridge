/* Appended to the installed C callback probe, using only its public helpers. */
typedef struct {
  owned_aggregates_result **root;
  owned_aggregates_result *view, *nested;
  owned_aggregates_ticket_t escaped;
  unsigned calls, fail;
} combined_state;

static owned_aggregates_status combined_reply(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  (void)owner;
  combined_state *state = context; ++state->calls;
  CHECK(!*state->root);
  CHECK(owned_aggregates_result_validate(session, state->view) == OWNED_AGGREGATES_CLOSED);
  CHECK(owned_aggregates_result_validate(session, state->nested) == OWNED_AGGREGATES_CLOSED);
  serial(session, input->primary, 42);
  state->escaped = input->primary; *out = *input;
  return state->fail ? OWNED_AGGREGATES_INVALID_ARGUMENT : OWNED_AGGREGATES_OK;
}

static void callback_combinations(owned_aggregates_session *session) {
  owned_aggregates_result *ticket_owner = NULL, *root_owner = NULL, *closure_owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 42, &ticket_owner);
  mpz_t number; mpz_init_set_ui(number, 7);
  uint8_t bytes[] = {42};
  owned_aggregates_payload_t payload = {number, {bytes, 1}};
  owned_aggregates_bundle_spare_t spare = {0};
  owned_aggregates_bundle_peers_t peers = {0};
  owned_aggregates_bundle_history_t history = {0};
  owned_aggregates_bundle_t input = {first, &spare, &peers, &history, &payload}, root = {0};
  owned_aggregates_make_record_result_t closure = NULL;
  OK(owned_aggregates_echo_record(session, &input, &root, &root_owner));
  OK(owned_aggregates_make_record(session, &root, &closure, &closure_owner));
  owned_aggregates_bundle_t view = {0}, nested = {0}, retained = {0}, moved = {0}, captured = {0};
  owned_aggregates_result *view_owner = NULL, *nested_owner = NULL, *retained_owner = NULL;
  owned_aggregates_result *moved_owner = NULL, *captured_owner = NULL;
  OK(owned_aggregates_make_record_result_t_call(session, closure, false, &root, root_owner, &view, &view_owner));
  OK(owned_aggregates_borrow_record(session, &view, view_owner, &nested, &nested_owner));
  OK(owned_aggregates_echo_record(session, &nested, &retained, &retained_owner));
  combined_state state = {.root = &root_owner, .view = view_owner, .nested = nested_owner};
  owned_aggregates_callback_record_argument1_t_host callback = {.call = combined_reply, .context = &state};
  owned_aggregates_result *original_view = view_owner;
  CHECK(owned_aggregates_move_record(session, &view, &view_owner, &callback, &moved, &moved_owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(view_owner == original_view);
  CHECK(!moved_owner && !moved.primary && state.calls == 0);
  OK(owned_aggregates_result_validate(session, root_owner)); serial(session, nested.primary, 42);
  OK(owned_aggregates_move_record(session, &root, &root_owner, &callback, &moved, &moved_owner));
  CHECK(!root_owner && state.calls == 1);
  expired(session, view.primary); expired(session, nested.primary); expired(session, state.escaped);
  serial(session, moved.primary, 42); serial(session, retained.primary, 42);
  OK(owned_aggregates_make_record_result_t_call(session, closure, true, &moved, moved_owner, &captured, &captured_owner));
  serial(session, captured.primary, 42);
  clear(&moved_owner);
  CHECK(owned_aggregates_result_validate(session, captured_owner) == OWNED_AGGREGATES_CLOSED);
  expired(session, captured.primary);
  clear(&captured_owner); clear(&view_owner); clear(&nested_owner);
  /* A callback failure after handoff must not resurrect the consumed receiver. */
  OK(owned_aggregates_echo_record(session, &retained, &root, &root_owner));
  OK(owned_aggregates_make_record_result_t_call(session, closure, false, &root, root_owner, &view, &view_owner));
  OK(owned_aggregates_borrow_record(session, &view, view_owner, &nested, &nested_owner));
  state = (combined_state){.root = &root_owner, .view = view_owner, .nested = nested_owner, .fail = 1};
  unsigned char saved[sizeof(moved)]; memset(&moved, 0xa5, sizeof(moved)); memcpy(saved, &moved, sizeof(moved));
  CHECK(owned_aggregates_move_record(session, &root, &root_owner, &callback, &moved, &moved_owner) == OWNED_AGGREGATES_CALLBACK_FAILED);
  CHECK(!root_owner && !moved_owner && state.calls == 1 && !memcmp(saved, &moved, sizeof(moved)));
  expired(session, view.primary); expired(session, nested.primary); expired(session, state.escaped);
  serial(session, retained.primary, 42);
  clear(&view_owner); clear(&nested_owner); clear(&closure_owner); clear(&retained_owner); clear(&ticket_owner);
  mpz_clear(number);
}
