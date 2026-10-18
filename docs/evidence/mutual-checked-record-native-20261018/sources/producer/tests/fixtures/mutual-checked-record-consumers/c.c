/* Independent installed C11 caller for a mutually recursive checked record and variant. */
#include <mutualcheckedrecords.h>
#include <stdio.h>
#include <string.h>

#ifndef MUTUAL_CHECKED_PARAMETER
#define MUTUAL_CHECKED_PARAMETER "arg0"
#endif

static unsigned checks;
#define CHECK(test) do { \
  if (!(test)) { fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)
#define OK(call) ((call) == MUTUALCHECKEDRECORDS_STATUS_OK)

static int rejected(mutualcheckedrecords_status status,
                    const mutualcheckedrecords_error *error,
                    const char *expected) {
  const int matches = status == MUTUALCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
    && error->code == MUTUALCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
    && error->message_length == strlen(expected)
    && memcmp(error->message, expected, error->message_length) == 0;
  if (!matches) fprintf(stderr, "expected: %s\nactual: %.*s (status=%u, code=%u)\n",
    expected, (int)error->message_length, error->message ? error->message : "",
    (unsigned)status, (unsigned)error->code);
  return matches;
}

static void envelope_set(mutualcheckedrecords_envelope_t *value,
                         unsigned long payload, unsigned long mode) {
  mpz_set_ui(value->value, payload);
  mpz_set_ui(value->mode, mode);
}

int main(void) {
  mutualcheckedrecords_error error = {0};
  mutualcheckedrecords_envelope_t root, child, echoed, produced;
  mutualcheckedrecords_step_t step;
  mutualcheckedrecords_envelope_next_t next, child_next;
  mpz_t out, input;
  mutualcheckedrecords_envelope_t_init(&root);
  mutualcheckedrecords_envelope_t_init(&child);
  mutualcheckedrecords_envelope_t_init(&echoed);
  mutualcheckedrecords_envelope_t_init(&produced);
  mutualcheckedrecords_step_t_init(&step);
  mutualcheckedrecords_envelope_next_t_init(&next);
  mutualcheckedrecords_envelope_next_t_init(&child_next);
  mpz_inits(out, input, NULL);

  envelope_set(&root, 40, 2);
  envelope_set(&child, 80, 1);
  child.next = &child_next;
  CHECK(OK(mutualcheckedrecords_step_t_select(
    &step, MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE)));
  step.cases.more.packet = &child;
  next.has_value = 1;
  next.value = &step;
  root.next = &next;

  mutualcheckedrecords_status status = mutualcheckedrecords_first(&root, out, &error);
  if (!OK(status)) fprintf(stderr, "first failed: %.*s\n",
    (int)error.message_length, error.message ? error.message : "");
  CHECK(OK(status) && mpz_cmp_ui(out, 41) == 0);
  CHECK(OK(mutualcheckedrecords_second(&root, out, &error))
    && mpz_cmp_ui(out, 42) == 0);
  CHECK(OK(mutualcheckedrecords_echo(&root, &echoed, &error)));
  CHECK(mpz_cmp_ui(echoed.value, 41) == 0 && echoed.next
    && echoed.next->has_value
    && echoed.next->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE
    && mpz_cmp_ui(echoed.next->value->cases.more.packet->value, 81) == 0);

  mpz_set_ui(input, 5);
  CHECK(OK(mutualcheckedrecords_produce(input, &produced, &error)));
  CHECK(mpz_cmp_ui(produced.value, 6) == 0 && produced.next
    && produced.next->has_value
    && produced.next->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE
    && mpz_cmp_ui(produced.next->value->cases.more.packet->value, 7) == 0);

  CHECK(OK(mutualcheckedrecords_step_t_select(
    &step, MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP)));
  CHECK(OK(mutualcheckedrecords_first(&root, out, &error))
    && mpz_cmp_ui(out, 41) == 0);

  mpz_set_ui(out, 999);
  mpz_set_ui(root.value, 100);
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    MUTUAL_CHECKED_PARAMETER ".value was rejected by MutualCheckedRecords.plusOne"));
  CHECK(mpz_cmp_ui(out, 999) == 0);

  mpz_set_ui(root.value, 40);
  CHECK(OK(mutualcheckedrecords_step_t_select(
    &step, MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE)));
  step.cases.more.packet = &child;
  mpz_set_ui(child.value, 100);
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    MUTUAL_CHECKED_PARAMETER ".next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"));
  CHECK(mpz_cmp_ui(root.value, 40) == 0 && mpz_cmp_ui(child.value, 100) == 0);

  mpz_set_ui(child.value, 80);
  mpz_set_ui(root.mode, 3);
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    MUTUAL_CHECKED_PARAMETER ".mode is not below its Fin 3 bound"));
  mpz_set_ui(root.mode, 2);
  mpz_set_ui(root.value, 0);
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    MUTUAL_CHECKED_PARAMETER " was rejected by MutualCheckedRecords.mkEnvelope"));

  envelope_set(&root, 40, 2);
  CHECK(OK(mutualcheckedrecords_step_t_select(
    &step, MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE)));
  step.cases.more.packet = &root;
  mpz_set_ui(out, 999);
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    "Invalid copied value"));
  CHECK(mpz_cmp_ui(out, 999) == 0 && mpz_cmp_ui(root.value, 40) == 0);
  step.cases.more.packet = &child;

  next.has_value = 2;
  CHECK(rejected(mutualcheckedrecords_first(&root, out, &error), &error,
    "Invalid copied value"));
  CHECK(mpz_cmp_ui(out, 999) == 0 && mpz_cmp_ui(root.value, 40) == 0);
  next.has_value = 1;

  enum { DEPTH_COUNT = 48 };
  mutualcheckedrecords_envelope_t depth_envelopes[DEPTH_COUNT];
  mutualcheckedrecords_step_t depth_steps[DEPTH_COUNT - 1];
  mutualcheckedrecords_envelope_next_t depth_next[DEPTH_COUNT];
  for (unsigned i = 0; i < DEPTH_COUNT; ++i) {
    mutualcheckedrecords_envelope_t_init(&depth_envelopes[i]);
    mutualcheckedrecords_envelope_next_t_init(&depth_next[i]);
    envelope_set(&depth_envelopes[i], 40, 2);
    depth_envelopes[i].next = &depth_next[i];
    if (i + 1 < DEPTH_COUNT) {
      mutualcheckedrecords_step_t_init(&depth_steps[i]);
      CHECK(OK(mutualcheckedrecords_step_t_select(
        &depth_steps[i], MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE)));
      depth_steps[i].cases.more.packet = &depth_envelopes[i + 1];
      depth_next[i].has_value = 1;
      depth_next[i].value = &depth_steps[i];
    }
  }
  CHECK(rejected(mutualcheckedrecords_first(&depth_envelopes[0], out, &error),
    &error, "Copied value limit exceeded"));
  CHECK(mpz_cmp_ui(out, 999) == 0);
  for (unsigned i = DEPTH_COUNT; i-- > 0;) {
    if (i + 1 < DEPTH_COUNT) mutualcheckedrecords_step_t_clear(&depth_steps[i]);
    mutualcheckedrecords_envelope_next_t_clear(&depth_next[i]);
    mutualcheckedrecords_envelope_t_clear(&depth_envelopes[i]);
  }

  CHECK(OK(mutualcheckedrecords_first(&root, out, &error))
    && mpz_cmp_ui(out, 41) == 0);

  mpz_clears(out, input, NULL);
  mutualcheckedrecords_envelope_next_t_clear(&child_next);
  mutualcheckedrecords_envelope_next_t_clear(&next);
  mutualcheckedrecords_step_t_clear(&step);
  mutualcheckedrecords_envelope_t_clear(&produced);
  mutualcheckedrecords_envelope_t_clear(&echoed);
  mutualcheckedrecords_envelope_t_clear(&child);
  mutualcheckedrecords_envelope_t_clear(&root);
  printf("mutual-checked-record-ok:%u\n", checks);
  return 0;
}
