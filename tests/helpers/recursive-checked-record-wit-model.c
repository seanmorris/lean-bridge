/* Oracle for the recursive WIT caller: genuine generated public headers, stand-in helpers.
 * No Lean library, Wasmtime engine or installed package executes. RECURSIVE_CHECKED_RECORD_FAULT
 * selects one injected defect; the caller must reject every one. */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef RECURSIVE_CHECKED_RECORD_MUTUAL
#include "mutualcheckedrecords_wasmtime.h"
#define P(name) mutualcheckedrecords_##name
#define LEAN "MutualCheckedRecords"
#define MAKE "mkEnvelope"
#define NORMALIZE "normalizeEnvelope"
#define LINK ".next?.more.packet"
#define BOUND_NAME "mode"
#define MUTUAL 1
#define LEVELS 3
typedef mutualcheckedrecords_envelope_t record;
typedef mutualcheckedrecords_envelope_next_t link_t;
typedef mutualcheckedrecords_step_t step_t;
#define DIGIT mode
#define TAIL next
#else
#include "recursivecheckedrecords_wasmtime.h"
#define P(name) recursivecheckedrecords_##name
#define LEAN "RecursiveCheckedRecords"
#define MAKE "mkPacket"
#define NORMALIZE "normalizePacket"
#define LINK ".tail?"
#define BOUND_NAME "digit"
#define MUTUAL 0
#define LEVELS 2
typedef recursivecheckedrecords_packet_t record;
typedef recursivecheckedrecords_packet_tail_t link_t;
#define DIGIT digit
#define TAIL tail
#endif
typedef P(scalar_nat_t) nat;
typedef P(groups_argument0_t) groups;
typedef P(groups_argument0_element_t) element;
#define HOST "Invalid native graph input, allocation failure or conversion limit"

struct wasmtime_error { char text[256]; };
struct P(wasmtime) { int open; };
static const char *fault(void) { const char *value = getenv("RECURSIVE_CHECKED_RECORD_FAULT"); return value ? value : ""; }
static bool is(const char *name) { return strcmp(fault(), name) == 0; }
static bool poisoned;

void wasmtime_error_message(const wasmtime_error_t *error, wasm_name_t *message) {
  message->size = strlen(error->text); message->data = malloc(message->size + 1);
  memcpy(message->data, error->text, message->size + 1);
}
void wasmtime_error_delete(wasmtime_error_t *error) { free(error); }
void wasm_name_delete(wasm_name_t *name) { free(name->data); name->data = NULL; name->size = 0; }
static wasmtime_error_t *bare(const char *text) {
  wasmtime_error_t *error = calloc(1, sizeof(*error)); snprintf(error->text, sizeof(error->text), "%s", text); return error;
}
/* Native rejections cross the component as an import error: Wasmtime formats a cause chain. */
static wasmtime_error_t *lean(const char *path, const char *rest) {
  poisoned = true;
  wasmtime_error_t *error = calloc(1, sizeof(*error));
  snprintf(error->text, sizeof(error->text), "error while executing at wasm backtrace:\n    0: 0x2a - <unknown>!first\n\nCaused by:\n    %s%s%s\n", path, rest, is("diagnostic-suffix") ? "." : "");
  return error;
}
wasmtime_error_t *P(wasmtime_open)(P(wasmtime) **out) { *out = calloc(1, sizeof(**out)); (*out)->open = 1; return NULL; }
void P(wasmtime_close)(P(wasmtime) *session) { free(session); }

static void *keep(size_t size) { void *value = calloc(1, size ? size : 1); if (!value) abort(); return value; }
static nat nat_of(uint64_t value) {
  uint32_t *limbs = keep(2 * sizeof(uint32_t)); limbs[0] = (uint32_t)value; limbs[1] = (uint32_t)(value >> 32);
  return (nat){.data = limbs, .length = limbs[1] ? 2 : limbs[0] ? 1 : 0};
}
static nat nat_plus(const nat *value, uint32_t plus) {
  uint32_t *limbs = keep((value->length + 1) * sizeof(uint32_t)); uint64_t carry = plus; size_t length = value->length;
  for (size_t i = 0; i < value->length; ++i) { uint64_t sum = (uint64_t)value->data[i] + carry; limbs[i] = (uint32_t)sum; carry = sum >> 32; }
  if (carry) limbs[length++] = (uint32_t)carry;
  return (nat){.data = limbs, .length = length};
}
/* Values above every checked limit compare as huge; limits here never exceed 99. */
static uint64_t small(const nat *value) { return value->length == 0 ? 0 : value->length == 1 ? value->data[0] : UINT64_MAX; }

/* Host validation mirrors the encoder: canonical limbs, flags, pointers, tags, cycles and depth. */
static bool valid_nat(const nat *value) {
  if (!value->length) return true;
  if (!value->data) return false;
  return value->data[value->length - 1] != 0 || is("accept-noncanonical");
}
static const record *active[512];
static bool valid_record(const record *value, unsigned depth, size_t on_path) {
  if (!value) return false;
  if (depth > 128 && !is("depth-unbounded")) return false;
  for (size_t i = 0; i < on_path; ++i) if (active[i] == value) return false;
  if (on_path >= 512) return false;
  active[on_path] = value;
  if (!valid_nat(&value->value) || !valid_nat(&value->DIGIT)) return false;
  const link_t *link = value->TAIL;
  if (!link) return false;
  if (link->has_value > 1) return false;
  if (!link->has_value) return true;
  if (!link->value) return false;
#if MUTUAL
  if (link->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP) return true;
  if (link->value->kind != MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE) return false;
  return valid_record(link->value->cases.more.packet, depth + LEVELS, on_path + 1);
#else
  return valid_record(link->value, depth + LEVELS, on_path + 1);
#endif
}
static const record *element_value(const element *item) {
#if MUTUAL
  return item->has_value ? &item->value : NULL;
#else
  return item->has_value ? item->value : NULL;
#endif
}
static const record *child(const record *value);
/* The fault mistakes any repeated record reachable from the groups for a cycle. */
static bool shared(const groups *value) {
  const record *seen[1024]; size_t count = 0;
  for (size_t i = 0; i < value->length; ++i)
    for (const record *item = element_value(&value->data[i]); item; item = child(item)) {
      for (size_t j = 0; j < count; ++j) if (seen[j] == item) return true;
      if (count < 1024) seen[count++] = item;
    }
  return false;
}
static bool valid_groups(const groups *value) {
  if (value->length && !value->data) return false;
  if (is("shared-as-cycle") && shared(value)) return false;
  for (size_t i = 0; i < value->length; ++i) {
    if (value->data[i].has_value > 1) return false;
    if (value->data[i].has_value && !valid_record(element_value(&value->data[i]), 1, 0)) return false;
  }
  return true;
}
static wasmtime_error_t *host(void) { return bare(is("wrong-host-message") ? "Native Lean graph call failed" : HOST); }

static const record *child(const record *value) {
  const link_t *link = value->TAIL;
  if (!link || !link->has_value) return NULL;
#if MUTUAL
  return link->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE ? link->value->cases.more.packet : NULL;
#else
  return link->value;
#endif
}
static bool stopped(const record *value) {
#if MUTUAL
  return value->TAIL && value->TAIL->has_value && value->TAIL->value->kind == MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP;
#else
  (void)value; return false;
#endif
}
static record *build(nat value, nat digit, const record *tail, bool stop) {
  record *out = keep(sizeof(*out)); out->value = value; out->DIGIT = digit;
  out->TAIL = keep(sizeof(link_t));
  if (tail || stop) {
    link_t *link = keep(sizeof(*link)); link->has_value = 1;
#if MUTUAL
    step_t *step = keep(sizeof(*step));
    step->kind = stop ? MUTUALCHECKEDRECORDS_STEP_T_KIND_STOP : MUTUALCHECKEDRECORDS_STEP_T_KIND_MORE; step->cases.more.packet = tail; link->value = step;
#else
    link->value = tail;
#endif
    out->TAIL = link;
  }
  return out;
}

static char rejection[256], rest[96];
/* Fin bounds first, then field constructors innermost-first, then each outer constructor. */
static bool fin(const record *value, const char *path) {
  if (small(&value->DIGIT) >= 3 && !is("missing-fin")) {
    snprintf(rejection, sizeof(rejection), "%s", path); snprintf(rest, sizeof(rest), "." BOUND_NAME " is not below its Fin 3 bound"); return false;
  }
  const record *next = child(value);
  if (!next || is("root-only")) return true;
  char longer[256]; snprintf(longer, sizeof(longer), "%s%s", path, is("wrong-path") ? "" : LINK);
  return fin(next, longer);
}
static record *construct(const record *value, const char *path, bool make, bool root) {
  if (is("conflated-constructor")) make = true;
  uint32_t plus = make ? 1 : 2; uint64_t limit = make ? 99 : 89;
  if (small(&value->value) > limit) {
    snprintf(rejection, sizeof(rejection), "%s.value", path); snprintf(rest, sizeof(rest), " was rejected by " LEAN ".%s", make ? "plusOne" : "plusTwo"); return NULL;
  }
  const record *next = child(value); record *tail = NULL;
  if (next) {
    if (is("root-only")) tail = (record *)next;
    else {
      char longer[256]; snprintf(longer, sizeof(longer), "%s%s", path, is("wrong-path") ? "" : LINK);
      if (!(tail = construct(next, longer, make, false))) return NULL;
    }
  }
  nat result = nat_plus(&value->value, is("missing-normalization") ? 0 : plus);
  if (make && small(&value->DIGIT) > small(&result)) {
    snprintf(rejection, sizeof(rejection), "%s", path); snprintf(rest, sizeof(rest), " was rejected by " LEAN "." MAKE); return NULL;
  }
  if (!make && !MUTUAL) result = is("second-normalizes-root-only") && !root ? value->value : nat_plus(&value->DIGIT, 1);
  if (stopped(value)) return build(result, value->DIGIT, NULL, !is("stop-as-none"));
  return build(result, value->DIGIT, is("echo-drops-tail") ? NULL : tail, false);
}
static wasmtime_error_t *accept(const record *input, bool make, record **out) {
  if (poisoned && is("poison-after-reject")) return lean("poisoned", "");
  if (!valid_record(input, 1, 0)) {
    if (is("cycle-as-lean")) return lean("Native Lean graph call failed", "");
    return host();
  }
  if (!fin(input, "arg0")) return lean(rejection, rest);
  record *result = construct(input, "arg0", make, true);
  if (!result) return lean(rejection, rest);
  poisoned = false; *out = result; return NULL;
}
static bool fresh_nat(const nat *out) { return !out->_bridge_owner && !out->_bridge_release; }
static bool fresh_record(const record *out) { return !out->_bridge_owner && !out->_bridge_release; }

wasmtime_error_t *P(wasmtime_value_first)(P(wasmtime) *session, const record *arg0, nat *out) {
  (void)session; record *result;
  if (!fresh_nat(out)) return bare("Graph output requires a fresh initialized slot");
  wasmtime_error_t *error = accept(arg0, true, &result);
  if (error) { if (is("partial-output")) *out = nat_of(1); return error; }
  *out = result->value; return NULL;
}
wasmtime_error_t *P(wasmtime_value_second)(P(wasmtime) *session, const record *arg0, nat *out) {
  (void)session; record *result;
  if (!fresh_nat(out)) return bare("Graph output requires a fresh initialized slot");
  wasmtime_error_t *error = accept(arg0, false, &result);
  if (error) return error;
  *out = result->value; return NULL;
}
wasmtime_error_t *P(wasmtime_value_echo)(P(wasmtime) *session, const record *arg0, record *out) {
  (void)session; record *result;
  if (!fresh_record(out) && !is("accept-used-slot")) return bare("Graph output requires a fresh initialized slot");
  wasmtime_error_t *error = accept(arg0, true, &result);
  if (error) return error;
  if (is("mutate-input") && arg0->value.length) ((uint32_t *)arg0->value.data)[0] ^= 1;
  *out = is("echo-unnormalized") ? *arg0 : *result; out->_bridge_owner = NULL; out->_bridge_release = NULL; return NULL;
}
static wasmtime_error_t *accept_groups(const groups *arg0, bool make, groups *result) {
  if (poisoned && is("poison-after-reject")) return lean("poisoned", "");
  if (!valid_groups(arg0)) return is("cycle-as-lean") ? lean("Native Lean graph call failed", "") : host();
  char path[64];
  for (size_t i = 0; i < arg0->length; ++i) if (element_value(&arg0->data[i])) {
    snprintf(path, sizeof(path), "arg0[%zu]?", i);
    if (!fin(element_value(&arg0->data[i]), path)) return lean(rejection, rest);
  }
  element *data = keep((arg0->length ? arg0->length : 1) * sizeof(*data));
  size_t length = 0;
  for (size_t i = 0; i < arg0->length; ++i) {
    const record *item = element_value(&arg0->data[i]);
    if (!item) { if (!is("groups-drop-none")) ++length; continue; }
    snprintf(path, sizeof(path), "arg0[%zu]?", i);
    record *built = construct(item, path, make, true);
    if (!built) return lean(rejection, rest);
    data[length].has_value = 1;
#if MUTUAL
    data[length].value = *built;
#else
    data[length].value = built;
#endif
    ++length;
  }
  poisoned = false; *result = (groups){.data = data, .length = length}; return NULL;
}
wasmtime_error_t *P(wasmtime_value_groups)(P(wasmtime) *session, const groups *arg0, nat *out) {
  (void)session; groups result = {0};
  if (!fresh_nat(out)) return bare("Graph output requires a fresh initialized slot");
  wasmtime_error_t *error = accept_groups(arg0, true, &result);
  if (error) return error;
  *out = nat_of(result.length); return NULL;
}
wasmtime_error_t *P(wasmtime_value_echo_groups)(P(wasmtime) *session, const groups *arg0, groups *out) {
  (void)session; groups result = {0};
  if (out->_bridge_owner || out->_bridge_release) return bare("Graph output requires a fresh initialized slot");
  bool drop = is("echo-groups-drops-none");
  wasmtime_error_t *error = accept_groups(arg0, false, &result);
  if (error) return error;
  if (drop) {
    size_t kept = 0; element *data = (element *)result.data;
    for (size_t i = 0; i < result.length; ++i) if (data[i].has_value) data[kept++] = data[i];
    result.length = kept;
  }
  *out = result; return NULL;
}
wasmtime_error_t *P(wasmtime_value_produce)(P(wasmtime) *session, const nat *arg0, record *out) {
  (void)session;
  if (!fresh_record(out)) return bare("Graph output requires a fresh initialized slot");
  if (!valid_nat(arg0)) return host();
  uint32_t offset = is("produce-offset") ? 0 : 1;
  nat first_digit = nat_of(is("produce-digits") ? 2 : 1), second_digit = nat_of(is("produce-digits") ? 1 : 2);
  if (is("produce-single")) { *out = *build(nat_plus(arg0, offset), first_digit, NULL, false); return NULL; }
  record *tail = build(nat_plus(arg0, offset + 1), second_digit, NULL, false);
  *out = *build(nat_plus(arg0, offset), first_digit, tail, false);
  return NULL;
}
