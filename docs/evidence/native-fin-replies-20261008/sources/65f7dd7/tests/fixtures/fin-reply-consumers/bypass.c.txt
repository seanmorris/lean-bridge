#define _GNU_SOURCE
#include <finreplies.h>
#include <pthread.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

/* Host callback replies with Fin bounds (VO #1453). The harness defines HOST_MAYBE, HOST_TWICE_FIRST
   and HOST_TWICE_SECOND from the generated header. argv[1] is "checked" for the generated package and
   "stripped" for the same wrapper rebuilt without its C reply walk, where only Lean's check refuses. */

static unsigned checks;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

static const uint32_t limbs[8] = {0, 1, 2, 3, 4, 5, 6, 7};
static const uint32_t sentinel_limbs[1] = {777};
/* 2^64, three limbs wide. */
static const uint32_t wide_limbs[3] = {0, 0, 1};

/* Each host records how often Lean called it; bad_at names the call that replies outside Fin 5. */
typedef struct { unsigned calls; long bad_at; unsigned bad_value; int wide; int reenter; finreplies_status nested; } host_state;

static unsigned nat_value(const finreplies_nat *value) { return value->length ? value->data[0] : 0; }

static finreplies_status maybe_host(void *context, const finreplies_nat *arg0, finreplies_option_nat_value *out, finreplies_error *error);
static finreplies_status run_maybe(host_state *state, finreplies_nat *out, finreplies_error *error) {
  HOST_MAYBE host = {.call = maybe_host, .context = state};
  return finreplies_maybe(&host, out, error);
}

static finreplies_status maybe_host(void *context, const finreplies_nat *arg0, finreplies_option_nat_value *out, finreplies_error *error) {
  (void)error;
  host_state *state = context;
  unsigned n = nat_value(arg0);
  ++state->calls;
  /* A nested call whose own reply is refused fails alone; the outer call is unaffected. */
  if (state->reenter && n == 0) {
    host_state inner = {.bad_at = 1, .bad_value = 5};
    finreplies_nat nested = {0};
    finreplies_error nested_error = {0};
    state->nested = run_maybe(&inner, &nested, &nested_error);
    finreplies_nat_clear(&nested);
  }
  out->has_value = 1;
  unsigned digit = (long)n == state->bad_at ? state->bad_value : n;
  out->value = state->wide && (long)n == state->bad_at ? (finreplies_nat){wide_limbs, 3, NULL, NULL} : (finreplies_nat){limbs + digit, 1, NULL, NULL};
  return FINREPLIES_STATUS_OK;
}

static finreplies_status second_host(void *context, const finreplies_nat *arg0, finreplies_nat *out, finreplies_error *error) {
  (void)error;
  ++*(unsigned *)context;
  out->data = limbs + (nat_value(arg0) % 8); out->length = 1; out->owner = NULL; out->release = NULL;
  return FINREPLIES_STATUS_OK;
}

static int matches(const finreplies_error *error, const char *expected) {
  return error->message_length == strlen(expected) && memcmp(error->message, expected, error->message_length) == 0;
}

/* A refused call keeps the caller's output exactly as it was. */
static int untouched(const finreplies_nat *out) { return out->data == sentinel_limbs && out->length == 1 && out->owner == NULL && out->release == NULL; }

static const char *refusal;

static int refuse_and_recover(void) {
  host_state state = {.bad_at = 2, .bad_value = 5};
  finreplies_nat out = {sentinel_limbs, 1, NULL, NULL};
  finreplies_error error = {0};
  CHECK(run_maybe(&state, &out, &error) == FINREPLIES_STATUS_INVALID_ARGUMENT);
  CHECK(error.code == FINREPLIES_ERROR_INVALID_ARGUMENT && matches(&error, refusal));
  CHECK(untouched(&out));
  /* Replies 0, 1 and the refused 2 reached Lean; the call for 3 never reached the host. */
  CHECK(state.calls == 3);
  host_state fresh = {.bad_at = -1};
  finreplies_nat value = {0};
  CHECK(run_maybe(&fresh, &value, &error) == FINREPLIES_STATUS_OK && nat_value(&value) == 100 && fresh.calls == 4);
  finreplies_nat_clear(&value);
  return 0;
}

static int thread_result = -1;
static void *other_thread(void *unused) { (void)unused; thread_result = refuse_and_recover(); return NULL; }

int main(int argc, char **argv) {
  if (argc != 2) return 2;
  refusal = strcmp(argv[1], "stripped") == 0 ? "Lean rejected a host callback result outside its Fin bound" : "callback result is not below its Fin 5 bound";
  finreplies_error error = {0};
  /* Positive control: four replies below the bound select 10 + 20 + 30 + 40. */
  host_state valid = {.bad_at = -1};
  finreplies_nat value = {0};
  CHECK(finreplies_maybe(&(HOST_MAYBE){.call = maybe_host, .context = &valid}, &value, &error) == FINREPLIES_STATUS_OK);
  CHECK(nat_value(&value) == 100 && valid.calls == 4);
  finreplies_nat_clear(&value);
  /* Refusal, untouched output, suppression of the next host call and fresh-call recovery. */
  if (refuse_and_recover()) return 1;
  /* A three-limb reply far above the bound is refused the same way. */
  host_state wide = {.bad_at = 0, .wide = 1};
  finreplies_nat out = {sentinel_limbs, 1, NULL, NULL};
  CHECK(run_maybe(&wide, &out, &error) == FINREPLIES_STATUS_INVALID_ARGUMENT && untouched(&out) && wide.calls == 1);
  /* After a refused first reply the second host callback is never invoked. */
  unsigned second_calls = 0;
  host_state first = {.bad_at = 1, .bad_value = 6};
  CHECK(finreplies_twice(&(HOST_TWICE_FIRST){.call = maybe_host, .context = &first}, &(HOST_TWICE_SECOND){.call = second_host, .context = &second_calls}, &out, &error) == FINREPLIES_STATUS_INVALID_ARGUMENT);
  CHECK(matches(&error, refusal) && untouched(&out) && first.calls == 1 && second_calls == 0);
  host_state good = {.bad_at = -1};
  CHECK(finreplies_twice(&(HOST_TWICE_FIRST){.call = maybe_host, .context = &good}, &(HOST_TWICE_SECOND){.call = second_host, .context = &second_calls}, &value, &error) == FINREPLIES_STATUS_OK);
  CHECK(nat_value(&value) == 20 + 4 && second_calls == 1);
  finreplies_nat_clear(&value);
  /* A refusal inside a reentrant call stays in the nested frame; the outer call succeeds. */
  host_state outer = {.bad_at = -1, .reenter = 1};
  CHECK(run_maybe(&outer, &value, &error) == FINREPLIES_STATUS_OK && nat_value(&value) == 100);
  CHECK(outer.nested == FINREPLIES_STATUS_INVALID_ARGUMENT);
  finreplies_nat_clear(&value);
  /* Each thread's refusal and recovery is its own. */
  pthread_t thread;
  CHECK(pthread_create(&thread, NULL, other_thread, NULL) == 0 && pthread_join(thread, NULL) == 0 && thread_result == 0);
  CHECK(refuse_and_recover() == 0);
  /* A forked child never reaches the host; its status is reported for the record. */
  fflush(NULL);
  pid_t child = fork();
  if (child == 0) {
    host_state forked = {.bad_at = -1};
    finreplies_nat ignored = {0};
    finreplies_error child_error = {0};
    finreplies_status status = run_maybe(&forked, &ignored, &child_error);
    printf("fork-status %d %u\n", (int)status, forked.calls);
    fflush(stdout);
    _exit(status != FINREPLIES_STATUS_OK && forked.calls == 0 ? 0 : 1);
  }
  int code = 0;
  CHECK(child > 0 && waitpid(child, &code, 0) == child && WIFEXITED(code) && WEXITSTATUS(code) == 0);
  printf("fin-reply-ok %s %u\n", argv[1], checks);
  return 0;
}
