/* Source-only inherited checked-record stand-in for testing the WIT caller.
 * It never executes a Component Model artifact or supports an installed-package claim. */
#include "inheritedcheckedrecords_wasmtime.h"
/* Some helpers serve only the full API selection. */
#pragma GCC diagnostic ignored "-Wunused-function"
#include "wit-values.h"
#include <stdio.h>

#ifndef INHERITED_PARAMETER_PREFIX
#define INHERITED_PARAMETER_PREFIX "arg"
#endif
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

struct inheritedcheckedrecords_wasmtime { unsigned calls; };

static bool fault(const char *label) {
  const char *selected = getenv("INHERITED_WIT_FAULT");
  return selected && !strcmp(selected, label);
}

static bool named(const wasm_name_t *actual, const char *expected) {
  return actual->size == strlen(expected)
    && !memcmp(actual->data, expected, actual->size);
}

/* Canonical little-endian Nat limbs; the empty list is zero. */
static bool natural(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < v->of.list.size; ++i)
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  return fault("accept-noncanonical") || !v->of.list.size
    || v->of.list.data[v->of.list.size - 1].of.u32 != 0;
}

static value plus(const value *v, uint32_t addend) {
  const size_t capacity = v->of.list.size + 1;
  uint32_t *limbs = calloc(capacity, sizeof *limbs);
  if (!limbs) abort();
  uint64_t carry = addend;
  size_t size = v->of.list.size;
  for (size_t i = 0; i < size; ++i) {
    const uint64_t sum = (uint64_t)v->of.list.data[i].of.u32 + carry;
    limbs[i] = (uint32_t)sum;
    carry = sum >> 32;
  }
  if (carry) limbs[size++] = (uint32_t)carry;
  value out = nat(limbs, size);
  free(limbs);
  return out;
}

static value from_u64(uint64_t n) {
  const uint32_t limbs[] = {(uint32_t)n, (uint32_t)(n >> 32)};
  return nat(limbs, n >> 32 ? 2 : n ? 1 : 0);
}

static bool small_value(const value *v, uint64_t *out) {
  if (!natural(v) || v->of.list.size > 2) return false;
  uint64_t n = 0;
  for (size_t i = v->of.list.size; i-- > 0;)
    n = (n << 32) | v->of.list.data[i].of.u32;
  *out = n;
  return true;
}

static bool shaped_span(const value *v) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2
    && named(&v->of.record.data[0].name, "lo")
    && named(&v->of.record.data[1].name, "hi")
    && natural(&v->of.record.data[0].val)
    && natural(&v->of.record.data[1].val);
}

static bool shaped_ticket(const value *v) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2
    && named(&v->of.record.data[0].name, "to-span")
    && named(&v->of.record.data[1].name, "word")
    && shaped_span(&v->of.record.data[0].val)
    && natural(&v->of.record.data[1].val);
}

static bool shaped_stamped(const value *v) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2
    && named(&v->of.record.data[0].name, "to-ticket")
    && named(&v->of.record.data[1].name, "mark")
    && shaped_ticket(&v->of.record.data[0].val)
    && natural(&v->of.record.data[1].val);
}

static wasmtime_error_t *host(void) {
  return wasmtime_error_new(fault("wrong-host-diagnostic")
    ? "Unknown export or invalid WIT input" : HOST_REFUSAL);
}

static char cause[256];
static wasmtime_error_t *native(void) { return wasmtime_error_new(cause); }

static void mutate(const value *input) {
  value *changed = (value *)input;
  if (changed->kind == WASMTIME_COMPONENT_RECORD && changed->of.record.size)
    changed->of.record.data[0].name.data[0] ^= 1;
  else if (changed->kind == WASMTIME_COMPONENT_LIST && changed->of.list.size)
    changed->of.list.data[0] = list(0);
}

static value produced_ticket(const value *input) {
  value out = ticket(clone(input), clone(input)
    , plus(input, fault("produce-offset") ? 2 : 1));
  if (fault("changed-field-name")) out.of.record.data[1].name.data[0] = 'W';
  return out;
}

static value produced_stamped(const value *input) {
  return stamped(produced_ticket(input)
    , small(fault("produce-stamped-mark") ? 1 : 0));
}

static wasmtime_error_t *produce(
    const char *name, const value *input, value *out) {
  if (!natural(input)) {
    if (!fault("accept-wrong-kind")) return host();
    value zero = small(0);
    *out = !strcmp(name, "produce")
      ? produced_ticket(&zero) : produced_stamped(&zero);
    clear(&zero);
    return NULL;
  }
  *out = !strcmp(name, "produce")
    ? produced_ticket(input) : produced_stamped(input);
  if (fault("input-mutation")) mutate(input);
  return NULL;
}

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
typedef enum { MAKE, NORMALIZE } choice_t;
typedef struct { choice_t span, word, ticket; } site_t;
typedef struct { uint64_t lo, hi, word; } accepted_ticket_t;

static const site_t FIRST = {MAKE, MAKE, MAKE};
static const site_t NORMALIZED = {NORMALIZE, NORMALIZE, NORMALIZE};
static const site_t ALIASED = {NORMALIZE, NORMALIZE, MAKE};
static const site_t ECHO = {MAKE, NORMALIZE, NORMALIZE};

static choice_t selected(choice_t choice) {
  return fault("conflated-constructor") ? MAKE : choice;
}

static void rejection(const char *path, const char *field, const char *text) {
  const char *suffix = fault("diagnostic-suffix") ? "." : "";
  if (fault("wrong-path"))
    snprintf(cause, sizeof cause, "%s.wrong%s%s", path, text, suffix);
  else
    snprintf(cause, sizeof cause, "%s%s%s%s", path, field, text, suffix);
}

/* Apply the independently fixed constructors at one complete Ticket site. */
static bool accept_ticket(const value *v, const char *path, site_t site
    , accepted_ticket_t *out) {
  const value *span_value = &v->of.record.data[0].val;
  uint64_t lo, hi, word;
  if (!small_value(&span_value->of.record.data[0].val, &lo)
      || !small_value(&span_value->of.record.data[1].val, &hi)
      || !small_value(&v->of.record.data[1].val, &word)) abort();

  choice_t span_choice = selected(site.span);
  if (span_choice == NORMALIZE) {
    if (!fault("missing-normalization")) { hi += lo; lo = 0; }
  } else if (!fault("missing-span") && lo > hi) {
    rejection(path, ".toSpan"
      , " was rejected by InheritedCheckedRecords.mkSpan");
    return false;
  }

  choice_t word_choice = selected(site.word);
  if (word_choice == NORMALIZE) {
    if (!fault("missing-normalization")) ++word;
  } else if (!fault("missing-word") && word == 0) {
    rejection(path, ".word"
      , " was rejected by InheritedCheckedRecords.mkWord");
    return false;
  }

  choice_t ticket_choice = selected(site.ticket);
  if (ticket_choice == NORMALIZE) {
    if (!fault("missing-normalization")) word = hi + 1;
  } else if (!fault("missing-ticket") && hi > word) {
    rejection(path, ""
      , " was rejected by InheritedCheckedRecords.mkTicket");
    return false;
  }
  *out = (accepted_ticket_t){lo, hi, word};
  return true;
}

static value accepted_ticket(accepted_ticket_t item) {
  return ticket(from_u64(item.lo), from_u64(item.hi), from_u64(item.word));
}

static wasmtime_error_t *refused(const value *input) {
  if (fault("mutate-rejected-input")) mutate(input);
  return native();
}

static wasmtime_error_t *inputs(
    const char *name, const value *args, size_t count, value *out) {
  if (!strcmp(name, "pair")) {
    if (count != 2 || !shaped_ticket(&args[0]) || !shaped_ticket(&args[1]))
      return host();
    accepted_ticket_t left, right;
    if (!accept_ticket(&args[0], INHERITED_PARAMETER_PREFIX "0", FIRST, &left))
      return refused(&args[0]);
    if (!accept_ticket(&args[1], INHERITED_PARAMETER_PREFIX "1", NORMALIZED, &right))
      return refused(&args[1]);
    *out = from_u64(left.word + right.word);
    if (fault("mutate-accepted-input")) mutate(&args[0]);
    return NULL;
  }
  if (count != 1) return host();
  const value *input = &args[0];
  if (!strcmp(name, "nested")) {
    if (!shaped_stamped(input)) return host();
    accepted_ticket_t ticket_value;
    if (!accept_ticket(&input->of.record.data[0].val
        , INHERITED_PARAMETER_PREFIX "0", FIRST, &ticket_value))
      return refused(input);
    uint64_t mark;
    if (!small_value(&input->of.record.data[1].val, &mark)) abort();
    if (!fault("missing-fin") && mark >= 8) {
      rejection(INHERITED_PARAMETER_PREFIX "0", ".mark"
        , " is not below its Fin 8 bound");
      return refused(input);
    }
    if (!fault("missing-stamped") && mark > ticket_value.word) {
      rejection(INHERITED_PARAMETER_PREFIX "0", ""
        , " was rejected by InheritedCheckedRecords.mkStamped");
      return refused(input);
    }
    *out = from_u64(ticket_value.word + mark);
    if (fault("mutate-accepted-input")) mutate(input);
    return NULL;
  }

  site_t site;
  if (!strcmp(name, "first")) site = FIRST;
  else if (!strcmp(name, "normalized")) site = NORMALIZED;
  else if (!strcmp(name, "aliased")) site = ALIASED;
  else if (!strcmp(name, "echo")) site = ECHO;
  else return host();
  if (!shaped_ticket(input)) return host();
  accepted_ticket_t ticket_value;
  if (!accept_ticket(input, INHERITED_PARAMETER_PREFIX "0", site, &ticket_value))
    return refused(input);
  if (!strcmp(name, "echo"))
    *out = fault("echo-raw") ? clone(input) : accepted_ticket(ticket_value);
  else if (!strcmp(name, "aliased")) *out = from_u64(ticket_value.word);
  else *out = from_u64(ticket_value.lo + ticket_value.hi + ticket_value.word);
  if (fault("mutate-accepted-input")) mutate(input);
  return NULL;
}
#endif

wasmtime_error_t *inheritedcheckedrecords_wasmtime_open(
    inheritedcheckedrecords_wasmtime **out) {
  *out = calloc(1, sizeof **out);
  return *out ? NULL : wasmtime_error_new("allocation failed");
}

wasmtime_error_t *inheritedcheckedrecords_wasmtime_link(
    wasmtime_component_linker_t *linker) {
  (void)linker;
  return NULL;
}

void inheritedcheckedrecords_wasmtime_close(
    inheritedcheckedrecords_wasmtime *session) {
  free(session);
}

wasmtime_error_t *inheritedcheckedrecords_wasmtime_call(
    inheritedcheckedrecords_wasmtime *session, const char *name
    , const wasmtime_component_val_t *args, size_t count
    , wasmtime_component_val_t *out) {
  ++session->calls;
  if (!strcmp(name, "produce") || !strcmp(name, "produce-stamped")) {
    if (count != 1) return host();
    return produce(name, &args[0], out);
  }
#ifdef INHERITED_CHECKED_RECORD_RESULT_ONLY
  return host();
#else
  return inputs(name, args, count, out);
#endif
}
