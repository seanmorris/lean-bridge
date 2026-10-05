/* Appended to the public callback lifetime probe. No native owner internals. */
#if HOST_CALLBACKS
typedef struct {
  unsigned calls, expected, reply, order;
  unsigned *sequence;
  owned_aggregates_result **consumed;
  owned_aggregates_ticket_t replacement;
  bool whole;
} mixed_state;
static owned_aggregates_status mixed_reply(void *context, owned_aggregates_session *session,
    const owned_aggregates_bundle_t *input, owned_aggregates_bundle_t *out, owned_aggregates_result **owner) {
  mixed_state *state = context; ++state->calls;
  if (state->sequence) CHECK(++*state->sequence == state->order);
  if (state->consumed) CHECK(!*state->consumed);
  serial(session, input->primary, state->expected);
  owned_aggregates_bundle_t reply = *input; reply.primary = state->replacement;
  serial(session, reply.primary, state->reply);
  if (state->whole) return owned_aggregates_echo_record(session, &reply, out, owner);
  *out = reply; return OWNED_AGGREGATES_OK;
}
#endif

static void mixed_callbacks(owned_aggregates_session *session) {
  owned_aggregates_result *first_owner = NULL, *second_owner = NULL, *root_owner = NULL;
  owned_aggregates_ticket_t first = ticket(session, 41, &first_owner), second = ticket(session, 97, &second_owner);
  mpz_t number; mpz_init_set_si(number, -37);
  uint8_t bytes[] = {0, 37, 255};
  owned_aggregates_payload_t payload = {number, {bytes, 3}};
  owned_aggregates_bundle_spare_t spare = {0}; owned_aggregates_bundle_peers_t peers = {0};
  owned_aggregates_bundle_history_t history = {0};
  owned_aggregates_bundle_t input = {first, &spare, &peers, &history, &payload}, root = {0}, result = {0};
  OK(owned_aggregates_echo_record(session, &input, &root, &root_owner));
  input.primary = second;
  owned_aggregates_apply_twice_argument1_t closure = NULL, retained = NULL;
  owned_aggregates_result *closure_owner = NULL, *retain_owner = NULL, *owner = NULL;
  OK(owned_aggregates_make_record_callback(session, &input, &closure, &closure_owner));
  OK(owned_aggregates_apply_twice_argument1_t_retain(session, closure, &retained, &retain_owner));
  bool equal = false;
  OK(owned_aggregates_apply_twice_argument1_t_equal(session, closure, retained, &equal)); CHECK(equal);
  OK(owned_aggregates_apply_twice_argument1_t_call(session, retained, &root, root_owner, &result, &owner));
  serial(session, result.primary, 97);
  owned_aggregates_ticket_t independent = NULL; owned_aggregates_result *independent_owner = NULL;
  OK(owned_aggregates_ticket_t_retain(session, result.primary, &independent, &independent_owner));
  clear(&owner);
  owned_aggregates_dispatch_result_t dispatch = NULL; owned_aggregates_result *dispatch_owner = NULL;
  OK(owned_aggregates_dispatch(session, &root, &dispatch, &dispatch_owner));
#if HOST_CALLBACKS
  owned_aggregates_apply_twice_argument1_t_host native = {.closure = retained};
  OK(owned_aggregates_dispatch_result_t_call(session, dispatch, &native, &result, &owner));
#else
  OK(owned_aggregates_dispatch_result_t_call(session, dispatch, retained, &result, &owner));
#endif
  serial(session, result.primary, 97); clear(&owner);
#if HOST_CALLBACKS
  unsigned sequence = 0;
  mixed_state left = {.expected = 41, .reply = 97, .order = 1, .sequence = &sequence, .replacement = second};
  mixed_state right = {.expected = 97, .reply = 41, .order = 2, .sequence = &sequence, .replacement = first, .whole = true};
  owned_aggregates_apply_twice_argument1_t_host host_left = {.call = mixed_reply, .context = &left};
  owned_aggregates_apply_twice_argument1_t_host host_right = {.call = mixed_reply, .context = &right};
  OK(owned_aggregates_apply_twice(session, &root, &host_left, &host_right, &result, &owner));
  CHECK(sequence == 2 && left.calls == 1 && right.calls == 1); serial(session, result.primary, 41); clear(&owner);
  right.sequence = NULL;
  OK(owned_aggregates_apply_twice(session, &root, &native, &host_right, &result, &owner));
  CHECK(right.calls == 2); serial(session, result.primary, 41); clear(&owner);
  left.sequence = NULL;
  OK(owned_aggregates_apply_twice(session, &root, &host_left, &native, &result, &owner));
  CHECK(left.calls == 2); serial(session, result.primary, 97); clear(&owner);
  OK(owned_aggregates_dispatch_result_t_call(session, dispatch, &host_left, &result, &owner));
  CHECK(left.calls == 3); serial(session, result.primary, 97); clear(&owner);
#if COMBINED
  sequence = 0; left.sequence = right.sequence = &sequence;
  left.consumed = right.consumed = &root_owner;
  OK(owned_aggregates_move_twice(session, &root, &root_owner, &host_left, &host_right, &result, &owner));
  CHECK(!root_owner && sequence == 2 && left.calls == 4 && right.calls == 3);
  serial(session, result.primary, 41); clear(&owner);
  OK(owned_aggregates_echo_record(session, &input, &root, &root_owner));
  owned_aggregates_result *saved = root_owner;
  host_right.closure = retained; /* Invalid descriptor must fail before either callback or handoff. */
  CHECK(owned_aggregates_move_twice(session, &root, &root_owner, &host_left, &host_right, &result, &owner) == OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(root_owner == saved && left.calls == 4 && right.calls == 3 && !owner);
#endif
#else
  OK(owned_aggregates_apply_twice(session, &root, retained, retained, &result, &owner));
  serial(session, result.primary, 97); clear(&owner);
#endif
  clear(&root_owner); clear(&closure_owner); clear(&retain_owner); clear(&dispatch_owner);
  serial(session, independent, 97); clear(&independent_owner);
  clear(&first_owner); clear(&second_owner); mpz_clear(number);
}
