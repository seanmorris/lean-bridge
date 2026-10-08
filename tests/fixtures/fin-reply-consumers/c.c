#define _GNU_SOURCE
#include <finreplies.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

/* Installed C acceptance for host callback replies with Fin bounds (VO #1453). The harness defines
   HOST_<export> from the installed header's callback names, and TILE_REPLY, whose name embeds the
   module path. Every reply shape is exercised at n - 1,
   n and n + 1, with rejected leaves first, middle and last, inactive branches, malformed
   discriminants, a host error, suppression of later host calls, an untouched caller output,
   exact-once release of host-owned spans and recovery by a fresh call. */

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
#define RUN(test) do { if (test) return 1; } while (0)
#define MALFORMED "Invalid copied value, negative Nat or 16 MiB call limit exceeded"
#define WIDE "184467440737095516170"

static char bound_text[128];
static const char *bound(const char *n) { snprintf(bound_text, sizeof bound_text, "callback result is not below its Fin %s bound", n); return bound_text; }
static int message_is(const finreplies_error *error, const char *expected) {
  return error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}

/* A refused call: INVALID_ARGUMENT with the exact message, the caller's output still 777. */
static mpz_t out;
static int refused(finreplies_status status, const finreplies_error *error, const char *expected) {
  return status == FINREPLIES_STATUS_INVALID_ARGUMENT && error->code == FINREPLIES_ERROR_INVALID_ARGUMENT
    && message_is(error, expected) && mpz_cmp_ui(out, 777) == 0;
}
static int accepted(finreplies_status status, unsigned long expected) { return status == FINREPLIES_STATUS_OK && mpz_cmp_ui(out, expected) == 0; }
static void preset(void) { mpz_set_ui(out, 777); }

/* Each host records its calls; `reply` is the value it gives at call `at` (other calls reply n). */
typedef struct { unsigned calls; long at; const char *reply; int malformed; int host_error; unsigned released; } host_state;
static void set(mpz_ptr target, const char *decimal) { mpz_set_str(target, decimal, 10); }
static const char *pick(host_state *state, unsigned long n, char *buffer) {
  if ((long)n == state->at && state->reply) return state->reply;
  snprintf(buffer, 32, "%lu", n); return buffer;
}
static finreplies_status host_failed(host_state *state, finreplies_error *error) {
  static const char text[] = "host refused";
  if (!state->host_error || (long)(state->calls - 1) != state->at) return FINREPLIES_STATUS_OK;
  *error = (finreplies_error){FINREPLIES_ERROR_INVALID_ARGUMENT, text, sizeof text - 1};
  return FINREPLIES_STATUS_INVALID_ARGUMENT;
}

/* Option (Fin 5): maybe calls n = 0..3; aliased calls 0; wide and none0 call 1. */
static finreplies_status option_host(void *context, mpz_srcptr arg0, finreplies_option_nat_value *reply, finreplies_error *error) {
  host_state *state = context; char buffer[32]; unsigned long n = mpz_get_ui(arg0);
  ++state->calls;
  finreplies_status failed = host_failed(state, error); if (failed) return failed;
  if (state->malformed && (long)n == state->at) { reply->has_value = 2; return FINREPLIES_STATUS_OK; }
  const char *value = pick(state, n, buffer);
  if (strcmp(value, "none") == 0) return FINREPLIES_STATUS_OK;
  reply->has_value = 1; set(reply->value, value);
  return FINREPLIES_STATUS_OK;
}

/* Host-owned spans: every element is the host's mpz, released exactly once through owner. */
typedef struct { mpz_t values[4]; size_t length; host_state *state; } owned_span;
static void release_span(void *owner) {
  owned_span *span = owner;
  for (size_t i = 0; i < span->length; ++i) mpz_clear(span->values[i]);
  ++span->state->released;
}
static owned_span span_storage[8];
static unsigned span_next;
/* Elements are "a,b,c"; an empty text is an empty span. */
static void fill_span(host_state *state, const char *elements, const finreplies_nat **data, size_t *length, void **owner, void (**release)(void *)) {
  owned_span *span = &span_storage[span_next++ % 8];
  span->length = 0; span->state = state;
  char copy[128]; snprintf(copy, sizeof copy, "%s", elements);
  for (char *item = strtok(copy, ","); item && span->length < 4; item = strtok(NULL, ",")) mpz_init_set_str(span->values[span->length++], item, 10);
  *data = (const finreplies_nat *)span->values; *length = span->length; *owner = span; *release = release_span;
}
static finreplies_status array_host(void *context, mpz_srcptr arg0, finreplies_array_nat_span *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  fill_span(state, state->reply, &reply->data, &reply->length, &reply->owner, &reply->release);
  return FINREPLIES_STATUS_OK;
}
static finreplies_status list_host(void *context, mpz_srcptr arg0, finreplies_list_nat_span *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  fill_span(state, state->reply, &reply->data, &reply->length, &reply->owner, &reply->release);
  return FINREPLIES_STATUS_OK;
}
static finreplies_status nested_host(void *context, mpz_srcptr arg0, finreplies_option_array_nat_value *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (strcmp(state->reply, "none") == 0) return FINREPLIES_STATUS_OK;
  reply->has_value = 1;
  fill_span(state, state->reply, &reply->value.data, &reply->value.length, &reply->value.owner, &reply->value.release);
  return FINREPLIES_STATUS_OK;
}
/* Except (Fin 7) Nat: "ok:<n>" or "error:<d>". */
static finreplies_status failure_host(void *context, mpz_srcptr arg0, finreplies_result_nat_nat_value *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (state->malformed) { reply->is_ok = 2; return FINREPLIES_STATUS_OK; }
  reply->is_ok = strncmp(state->reply, "ok:", 3) == 0;
  set(reply->is_ok ? reply->ok : reply->error, strchr(state->reply, ':') + 1);
  return FINREPLIES_STATUS_OK;
}
/* Except Nat (Array (Fin 3)): "ok:a,b" or "error:<n>". */
static finreplies_status success_host(void *context, mpz_srcptr arg0, finreplies_result_array_nat_nat_value *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  reply->is_ok = strncmp(state->reply, "ok:", 3) == 0;
  if (reply->is_ok) fill_span(state, strchr(state->reply, ':') + 1, &reply->ok.data, &reply->ok.length, &reply->ok.owner, &reply->ok.release);
  else set(reply->error, strchr(state->reply, ':') + 1);
  return FINREPLIES_STATUS_OK;
}
/* Trailing: "label:<text>" or "digit:<d>". */
static finreplies_status late_host(void *context, mpz_srcptr arg0, finreplies_trailing *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (state->malformed) { reply->kind = 7; return FINREPLIES_STATUS_OK; }
  if (strncmp(state->reply, "label:", 6) == 0) {
    if (finreplies_trailing_select(reply, FINREPLIES_TRAILING_KIND_LABEL) != FINREPLIES_STATUS_OK) return FINREPLIES_STATUS_UNEXPECTED_ERROR;
    reply->cases.label.text = (finreplies_string){state->reply + 6, strlen(state->reply + 6), NULL, NULL};
  } else {
    if (finreplies_trailing_select(reply, FINREPLIES_TRAILING_KIND_DIGIT) != FINREPLIES_STATUS_OK) return FINREPLIES_STATUS_UNEXPECTED_ERROR;
    set(reply->cases.digit.value, state->reply + 6);
  }
  return FINREPLIES_STATUS_OK;
}
/* Option Tile: "none" or "<digit>:<count>". */
static finreplies_status tile_host(void *context, mpz_srcptr arg0, TILE_REPLY *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (strcmp(state->reply, "none") == 0) return FINREPLIES_STATUS_OK;
  char digit[32]; snprintf(digit, sizeof digit, "%.*s", (int)(strchr(state->reply, ':') - state->reply), state->reply);
  reply->has_value = 1; set(reply->value.digit, digit); set(reply->value.count, strchr(state->reply, ':') + 1);
  return FINREPLIES_STATUS_OK;
}
/* Option (Fin 5) × Nat and Slot: "none" or "<digit>", with 9 as the Nat. */
static finreplies_status product_host(void *context, mpz_srcptr arg0, finreplies_tuple_option_nat_nat_value *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (strcmp(state->reply, "none") != 0) { reply->fst.has_value = 1; set(reply->fst.value, state->reply); }
  mpz_set_ui(reply->snd, 9);
  return FINREPLIES_STATUS_OK;
}
static finreplies_status slot_host(void *context, mpz_srcptr arg0, finreplies_slot *reply, finreplies_error *error) {
  (void)arg0; (void)error; host_state *state = context; ++state->calls;
  if (state->malformed) reply->digit.has_value = 2;
  else if (strcmp(state->reply, "none") != 0) { reply->digit.has_value = 1; set(reply->digit.value, state->reply); }
  mpz_set_ui(reply->count, 9);
  return FINREPLIES_STATUS_OK;
}
static finreplies_status second_host(void *context, mpz_srcptr arg0, mpz_ptr reply, finreplies_error *error) {
  (void)error; ++((host_state *)context)->calls; mpz_fdiv_r_ui(reply, arg0, 8); return FINREPLIES_STATUS_OK;
}

static finreplies_error error;
#define CALL(name, host, state) finreplies_##name(&(HOST_##name){.call = host, .context = &(state)}, out, &error)

/* One bounded leaf: the reply `format` filled with n - 1 is accepted as `expected`; with n and n + 1
   it is refused naming Fin n. Host-owned spans are released exactly once either way. */
typedef finreplies_status (*caller)(host_state *);
static int leaf_bounds(caller call, const char *format, unsigned n, long at, unsigned long expected, int spans) {
  char reply[64], text[8];
  snprintf(text, sizeof text, "%u", n);
  for (unsigned value = n - 1; value <= n + 1; ++value) {
    snprintf(reply, sizeof reply, format, value);
    host_state state = {.at = at, .reply = reply}; preset();
    finreplies_status status = call(&state);
    if (value == n - 1) CHECK(accepted(status, expected) && (!spans || state.released == 1));
    else CHECK(refused(status, &error, bound(text)) && state.calls == 1 && (!spans || state.released == 1));
  }
  return 0;
}
static finreplies_status call_tile(host_state *state) { return CALL(maybe_tile, tile_host, *state); }
static finreplies_status call_product(host_state *state) { return CALL(product, product_host, *state); }
static finreplies_status call_slot(host_state *state) { return CALL(slotted, slot_host, *state); }
static finreplies_status call_aliased(host_state *state) { return CALL(aliased, option_host, *state); }
static finreplies_status call_nested(host_state *state) { return CALL(nested, nested_host, *state); }
static finreplies_status call_success(host_state *state) { return CALL(success, success_host, *state); }
static finreplies_status call_listed(host_state *state) { return CALL(listed, list_host, *state); }

/* maybe: 10 + 20 + 30 + 40 for replies 0..3; a refused reply at call `at` stops the host there. */
static int check_maybe(void) {
  host_state ok = {.at = -1}; preset();
  CHECK(accepted(CALL(maybe, option_host, ok), 100) && ok.calls == 4);
  host_state below = {.at = 3, .reply = "4"}; preset();
  CHECK(accepted(CALL(maybe, option_host, below), 10 + 20 + 30 + 50) && below.calls == 4);
  const long positions[] = {0, 1, 3};
  for (int i = 0; i < 3; ++i) for (int j = 0; j < 2; ++j) {
    host_state bad = {.at = positions[i], .reply = j ? "6" : "5"}; preset();
    CHECK(refused(CALL(maybe, option_host, bad), &error, bound("5")) && bad.calls == (unsigned)positions[i] + 1);
  }
  host_state malformed = {.at = 1, .malformed = 1}; preset();
  CHECK(refused(CALL(maybe, option_host, malformed), &error, MALFORMED) && malformed.calls == 2);
  /* A host error keeps its own first message and also stops later host calls. */
  host_state failing = {.at = 1, .host_error = 1}; preset();
  CHECK(refused(CALL(maybe, option_host, failing), &error, "host refused") && failing.calls == 2);
  host_state fresh = {.at = -1}; preset();
  CHECK(accepted(CALL(maybe, option_host, fresh), 100));
  return 0;
}

/* Array (Fin 3) through a host-owned span released exactly once, accepted or refused. */
static int check_digits(void) {
  host_state ok = {.reply = "0,1,2"}; preset();
  CHECK(accepted(CALL(digits, array_host, ok), 123) && ok.released == 1);
  host_state below = {.reply = "2,2,2"}; preset();
  CHECK(accepted(CALL(digits, array_host, below), 333) && below.released == 1);
  const char *bad[] = {"3,1,2", "0,3,2", "0,1,3", "4,1,2", "0,4,2", "0,1,4"};
  for (int i = 0; i < 6; ++i) {
    host_state state = {.reply = bad[i]}; preset();
    CHECK(refused(CALL(digits, array_host, state), &error, bound("3")) && state.calls == 1 && state.released == 1);
  }
  host_state empty = {.reply = ""}; preset();
  CHECK(accepted(CALL(digits, array_host, empty), 0) && empty.released == 1);
  return 0;
}

/* Fin 0 has no values: none and the empty list are the only valid replies. */
static int check_zero(void) {
  host_state none = {.at = 1, .reply = "none"}; preset();
  CHECK(accepted(CALL(none0, option_host, none), 11));
  host_state some = {.at = 1, .reply = "0"}; preset();
  CHECK(refused(CALL(none0, option_host, some), &error, bound("0")));
  host_state empty = {.reply = ""}; preset();
  CHECK(accepted(CALL(empty0, list_host, empty), 0) && empty.released == 1);
  host_state populated = {.reply = "0"}; preset();
  CHECK(refused(CALL(empty0, list_host, populated), &error, bound("0")) && populated.released == 1);
  return 0;
}

/* A bound wider than 64 bits: n - 1 is accepted, n and n + 1 are refused. */
static int check_wide(void) {
  host_state below = {.at = 1, .reply = "184467440737095516169"}; preset();
  finreplies_status status = CALL(wide, option_host, below);
  CHECK(status == FINREPLIES_STATUS_OK && mpz_cmp_ui(out, 0) > 0);
  mpz_t expected; mpz_init_set_str(expected, WIDE, 10);
  CHECK(mpz_cmp(out, expected) == 0);
  mpz_clear(expected);
  const char *bad[] = {WIDE, "184467440737095516171"};
  for (int i = 0; i < 2; ++i) {
    host_state state = {.at = 1, .reply = bad[i]}; preset();
    CHECK(refused(CALL(wide, option_host, state), &error, bound(WIDE)));
  }
  return 0;
}

/* Except (Fin 7) Nat: only the error branch is bounded; the ok branch is not checked. */
static int check_failure(void) {
  host_state ok = {.reply = "ok:1000000"}; preset();
  CHECK(accepted(CALL(failure, failure_host, ok), 1000000));
  host_state below = {.reply = "error:6"}; preset();
  CHECK(accepted(CALL(failure, failure_host, below), 700));
  const char *bad[] = {"error:7", "error:8"};
  for (int i = 0; i < 2; ++i) {
    host_state state = {.reply = bad[i]}; preset();
    CHECK(refused(CALL(failure, failure_host, state), &error, bound("7")));
  }
  host_state malformed = {.malformed = 1}; preset();
  CHECK(refused(CALL(failure, failure_host, malformed), &error, MALFORMED));
  RUN(leaf_bounds(call_success, "ok:0,%u", 3, -1, 2, 1));
  host_state errorBranch = {.reply = "error:1000000"}; preset();
  CHECK(accepted(CALL(success, success_host, errorBranch), 1000000));
  return 0;
}

/* Trailing: the label case is not checked; only the active digit case is. */
static int check_late(void) {
  host_state label = {.reply = "label:abcdefghijkl"}; preset();
  CHECK(accepted(CALL(late, late_host, label), 12));
  host_state below = {.reply = "digit:9"}; preset();
  CHECK(accepted(CALL(late, late_host, below), 81));
  const char *bad[] = {"digit:10", "digit:11"};
  for (int i = 0; i < 2; ++i) {
    host_state state = {.reply = bad[i]}; preset();
    CHECK(refused(CALL(late, late_host, state), &error, bound("10")));
  }
  host_state malformed = {.malformed = 1}; preset();
  CHECK(refused(CALL(late, late_host, malformed), &error, MALFORMED));
  return 0;
}

/* Records, products, aliases and nested spans whose stand-in holds no Fin, at n - 1, n and n + 1. */
static int check_composites(void) {
  RUN(leaf_bounds(call_tile, "%u:5", 5, -1, 50 + 5, 0));
  host_state noTile = {.reply = "none"}; preset();
  CHECK(accepted(CALL(maybe_tile, tile_host, noTile), 3));
  RUN(leaf_bounds(call_product, "%u", 5, -1, 9, 0));
  host_state noPair = {.reply = "none"}; preset();
  CHECK(accepted(CALL(product, product_host, noPair), 9));
  RUN(leaf_bounds(call_slot, "%u", 5, -1, 9, 0));
  host_state noSlot = {.reply = "none"}; preset();
  CHECK(accepted(CALL(slotted, slot_host, noSlot), 9));
  host_state malformedSlot = {.malformed = 1}; preset();
  CHECK(refused(CALL(slotted, slot_host, malformedSlot), &error, MALFORMED));
  RUN(leaf_bounds(call_aliased, "%u", 5, 0, 4, 0));
  RUN(leaf_bounds(call_nested, "0,%u", 3, -1, 2, 1));
  host_state noNested = {.reply = "none"}; preset();
  CHECK(accepted(CALL(nested, nested_host, noNested), 2));
  return 0;
}

/* A nonempty List (Fin 3): valid values, then each of the first, middle and last leaves at its bounds. */
static int check_listed(void) {
  host_state ok = {.reply = "0,1,2"}; preset();
  CHECK(accepted(CALL(listed, list_host, ok), 123) && ok.released == 1);
  RUN(leaf_bounds(call_listed, "%u,1,2", 3, -1, 323, 1));
  RUN(leaf_bounds(call_listed, "0,%u,2", 3, -1, 133, 1));
  RUN(leaf_bounds(call_listed, "0,1,%u", 3, -1, 123, 1));
  host_state empty = {.reply = ""}; preset();
  CHECK(accepted(CALL(listed, list_host, empty), 0) && empty.released == 1);
  return 0;
}

/* After a refused first reply the second host callback never runs. */
static int check_twice(void) {
  host_state first = {.at = 1, .reply = "6"}, second = {0};
  preset();
  CHECK(refused(finreplies_twice(&(HOST_twice){.call = option_host, .context = &first}, &(HOST_twice_second){.call = second_host, .context = &second}, out, &error), &error, bound("5")));
  CHECK(first.calls == 1 && second.calls == 0);
  host_state good = {.at = -1}; preset();
  CHECK(finreplies_twice(&(HOST_twice){.call = option_host, .context = &good}, &(HOST_twice_second){.call = second_host, .context = &second}, out, &error) == FINREPLIES_STATUS_OK);
  CHECK(mpz_cmp_ui(out, 24) == 0 && second.calls == 1);
  return 0;
}

/* A refusal inside a reentrant call stays in the nested frame. */
static finreplies_status nested_status;
static finreplies_status reentering_host(void *context, mpz_srcptr arg0, finreplies_option_nat_value *reply, finreplies_error *host_error) {
  if (mpz_cmp_ui(arg0, 0) == 0) {
    host_state inner = {.at = 1, .reply = "5"};
    mpz_t inner_out; mpz_init(inner_out); finreplies_error inner_error = {0};
    nested_status = finreplies_maybe(&(HOST_maybe){.call = option_host, .context = &inner}, inner_out, &inner_error);
    mpz_clear(inner_out);
  }
  return option_host(context, arg0, reply, host_error);
}
static int check_reentry(void) {
  host_state outer = {.at = -1}; preset();
  CHECK(accepted(CALL(maybe, reentering_host, outer), 100) && nested_status == FINREPLIES_STATUS_INVALID_ARGUMENT);
  return 0;
}

static int thread_result = -1;
static void *other_thread(void *unused) {
  (void)unused;
  host_state bad = {.at = 2, .reply = "5"}, good = {.at = -1};
  mpz_t local; mpz_init_set_ui(local, 777); finreplies_error local_error = {0};
  finreplies_status refusal = finreplies_maybe(&(HOST_maybe){.call = option_host, .context = &bad}, local, &local_error);
  int first = refusal == FINREPLIES_STATUS_INVALID_ARGUMENT && mpz_cmp_ui(local, 777) == 0 && bad.calls == 3;
  finreplies_status recovery = finreplies_maybe(&(HOST_maybe){.call = option_host, .context = &good}, local, &local_error);
  thread_result = first && recovery == FINREPLIES_STATUS_OK && mpz_cmp_ui(local, 100) == 0 ? 0 : 1;
  mpz_clear(local);
  return NULL;
}

int main(void) {
  mpz_init(out);
  RUN(check_maybe()); RUN(check_digits()); RUN(check_zero()); RUN(check_wide()); RUN(check_failure());
  RUN(check_late()); RUN(check_composites()); RUN(check_listed()); RUN(check_twice()); RUN(check_reentry());
  mpz_t forty_one; mpz_init_set_ui(forty_one, 41); preset();
  CHECK(finreplies_plain(forty_one, out, &error) == FINREPLIES_STATUS_OK && mpz_cmp_ui(out, 42) == 0);
  mpz_clear(forty_one);
  pthread_t thread;
  CHECK(pthread_create(&thread, NULL, other_thread, NULL) == 0 && pthread_join(thread, NULL) == 0 && thread_result == 0);
  fflush(NULL);
  pid_t child = fork();
  if (child == 0) {
    host_state forked = {.at = -1};
    mpz_t ignored; mpz_init(ignored); finreplies_error child_error = {0};
    finreplies_status status = finreplies_maybe(&(HOST_maybe){.call = option_host, .context = &forked}, ignored, &child_error);
    printf("fork-status %d %u\n", (int)status, forked.calls);
    fflush(stdout);
    _exit(status != FINREPLIES_STATUS_OK && forked.calls == 0 ? 0 : 1);
  }
  int code = 0;
  CHECK(child > 0 && waitpid(child, &code, 0) == child && WIFEXITED(code) && WEXITSTATUS(code) == 0);
  mpz_clear(out);
  printf("fin-reply-ok c %u\n", checks);
  return 0;
}
