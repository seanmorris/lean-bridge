/* Source-only nested checked-record stand-in for testing the WIT caller, never a Component Model run.
 * It implements the independently fixed constructor table of nested-checked-record-fixture.mjs. */
#include "nestedcheckedrecords_wasmtime.h"
/* Some helpers serve only the full API selection. */
#pragma GCC diagnostic ignored "-Wunused-function"
#include "wit-values.h"
#include <stdio.h>

#ifndef NESTED_PARAMETER_PREFIX
#define NESTED_PARAMETER_PREFIX "arg"
#endif
#define HOST_REFUSAL "Unknown export, invalid WIT input or 16 MiB conversion limit"

struct nestedcheckedrecords_wasmtime { unsigned calls; };
static bool fault(const char *label) {
  const char *selected = getenv("NESTED_WIT_FAULT"); return selected && !strcmp(selected, label);
}
static bool named(const wasm_name_t *actual, const char *expected) {
  return actual->size == strlen(expected) && !memcmp(actual->data, expected, actual->size);
}
/* Canonical little-endian limbs; the empty list is zero. */
static bool natural(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  return fault("accept-noncanonical") || !v->of.list.size || v->of.list.data[v->of.list.size - 1].of.u32 != 0;
}
static value plus(const value *v, uint32_t addend) {
  size_t size = v->of.list.size; uint32_t limbs[8] = {0}; uint64_t carry = addend;
  if (size > 7) abort();
  for (size_t i = 0; i < size; ++i) { uint64_t sum = (uint64_t)v->of.list.data[i].of.u32 + carry; limbs[i] = (uint32_t)sum; carry = sum >> 32; }
  if (carry) limbs[size++] = (uint32_t)carry;
  return nat(limbs, size);
}
static wasmtime_error_t *host(void) {
  return wasmtime_error_new(fault("wrong-host-diagnostic") ? "Unknown export or invalid WIT input" : HOST_REFUSAL);
}
#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
static bool zero(const value *v) { return v->of.list.size == 0; }
/* Small naturals fit two limbs; larger ones compare as above every small bound. */
static bool small_value(const value *v, uint64_t *out) {
  if (v->of.list.size > 2) return false;
  uint64_t n = 0;
  for (size_t i = v->of.list.size; i-- > 0;) n = (n << 32) | v->of.list.data[i].of.u32;
  *out = n; return true;
}
static value from_u64(uint64_t n) {
  uint32_t limbs[2] = {(uint32_t)n, (uint32_t)(n >> 32)};
  return nat(limbs, n >> 32 ? 2 : n ? 1 : 0);
}
static bool shaped_packet(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_RECORD || v->of.record.size != 2) return false;
  if (!named(&v->of.record.data[0].name, "digit") || !named(&v->of.record.data[1].name, "word")) return false;
  return natural(&v->of.record.data[0].val) && natural(&v->of.record.data[1].val);
}
typedef enum { MK, NORMALIZE } choice_t;
typedef struct { choice_t packet, word; } site_t;
static const site_t MK_MK = {MK, MK}, NORM_NORM = {NORMALIZE, NORMALIZE}, MK_NORM = {MK, NORMALIZE}, NORM_MK = {NORMALIZE, MK};
static char cause[256];
/* Check one packet at a path: Fin 10 digit, then the word constructor, then the packet constructor.
 * Return the accepted word (as Lean would store it), or false with an exact cause. */
static bool accept(const value *v, const char *path, site_t site, uint64_t *word_out) {
  const value *digit = &v->of.record.data[0].val, *word = &v->of.record.data[1].val;
  uint64_t d = 0, w = 0; bool small_digit = small_value(digit, &d), small_word = small_value(word, &w);
  bool digit_ok = small_digit && d < 10;
  const char *suffix = fault("diagnostic-suffix") ? "." : "";
  if (!fault("missing-fin") && !fault("fin-after-constructor") && !digit_ok) {
    snprintf(cause, sizeof cause, "%s.digit is not below its Fin 10 bound%s", path, suffix); return false;
  }
  choice_t word_choice = fault("missing-normalization") ? MK : site.word;
  if (word_choice == MK && zero(word)) {
    snprintf(cause, sizeof cause, "%s.word was rejected by NestedCheckedRecords.mkWord%s", path, suffix); return false;
  }
  if (word_choice == NORMALIZE) { if (!small_word) abort(); w += 1; small_word = true; }
  if (fault("fin-after-constructor") && !digit_ok) {
    snprintf(cause, sizeof cause, "%s.digit is not below its Fin 10 bound%s", path, suffix); return false;
  }
  choice_t packet_choice = fault("conflated-constructor") ? MK : site.packet;
  if (packet_choice == MK && small_word && d > w) {
    snprintf(cause, sizeof cause, "%s was rejected by NestedCheckedRecords.mkPacket%s", path, suffix); return false;
  }
  if (packet_choice == NORMALIZE) w = d + 1;
  *word_out = w; return true;
}
static wasmtime_error_t *native(void) { return wasmtime_error_new(cause); }
#endif
static void mutate(const value *input) {
  value *changed = (value *)input;
  if (changed->kind == WASMTIME_COMPONENT_RECORD && changed->of.record.size) changed->of.record.data[0].name.data[0] ^= 1;
  else if (changed->kind == WASMTIME_COMPONENT_LIST && changed->of.list.size) changed->of.list.data[0] = small(0);
}
static value produced(uint32_t digit, value word) {
  value out = packet(digit, word);
  if (fault("changed-field-name")) out.of.record.data[1].name.data[0] = 'W';
  return out;
}

wasmtime_error_t *nestedcheckedrecords_wasmtime_open(nestedcheckedrecords_wasmtime **out) {
  *out = calloc(1, sizeof **out); return *out ? NULL : wasmtime_error_new("allocation failed");
}
wasmtime_error_t *nestedcheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker) { (void)linker; return NULL; }
void nestedcheckedrecords_wasmtime_close(nestedcheckedrecords_wasmtime *session) { free(session); }

static wasmtime_error_t *produce(const char *name, const value *input, value *out) {
  if (!(input->kind == WASMTIME_COMPONENT_LIST && natural(input)) && !fault("accept-wrong-kind")) return host();
  if (input->kind != WASMTIME_COMPONENT_LIST) { *out = none(); return NULL; }
  uint32_t step = fault("produce-offset") ? 2 : 1;
  if (!strcmp(name, "produce-option")) { *out = some(produced(0, plus(input, step))); return NULL; }
  value items[] = {produced(0, plus(input, step)), produced(0, plus(input, step + 1))};
  *out = packets(fault("produce-array-length") ? 1 : 2, items);
  if (fault("produce-array-length")) clear(&items[1]);
  return NULL;
}

#ifndef NESTED_CHECKED_RECORD_RESULT_ONLY
static bool packet_list(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) if (!shaped_packet(&v->of.list.data[i])) return false;
  return true;
}
/* Sum accepted words across a sequence; the first failing element stops the call. */
static bool sum_sequence(const value *v, site_t site, uint64_t *total) {
  *total = 0;
  for (size_t i = 0; i < v->of.list.size; ++i) {
    char path[64]; uint64_t w;
    snprintf(path, sizeof path, fault("wrong-path") ? NESTED_PARAMETER_PREFIX "0.%zu" : NESTED_PARAMETER_PREFIX "0[%zu]", i);
    if (!accept(&v->of.list.data[i], path, site, &w)) return false;
    *total += w;
  }
  return true;
}
static wasmtime_error_t *inputs(const char *name, const value *args, size_t count, value *out) {
  const value *a = &args[0]; uint64_t w = 0, x = 0; const char *p0 = NESTED_PARAMETER_PREFIX "0";
  if (!strcmp(name, "first") || !strcmp(name, "second")) {
    if (count != 1 || !shaped_packet(a)) return host();
    site_t site = !strcmp(name, "first") ? MK_MK : NORM_NORM;
    if (!accept(a, p0, site, &w)) { if (fault("mutate-rejected-input")) mutate(a); return native(); }
    if (fault("mutate-accepted-input")) mutate(a);
    *out = from_u64(w); return NULL;
  }
  if (!strcmp(name, "pair")) {
    if (count != 2 || !shaped_packet(&args[0]) || !shaped_packet(&args[1])) return host();
    if (!accept(&args[0], p0, MK_MK, &w) || !accept(&args[1], NESTED_PARAMETER_PREFIX "1", NORM_NORM, &x)) return native();
    *out = from_u64(w + x); return NULL;
  }
  if (count != 1) return host();
  if (!strcmp(name, "in-array") || !strcmp(name, "in-list") || !strcmp(name, "echo-array")) {
    if (!packet_list(a)) return host();
    site_t site = !strcmp(name, "in-list") && !fault("list-as-array") ? NORM_NORM : MK_MK;
    if (!sum_sequence(a, site, &w)) return native();
    if (!strcmp(name, "echo-array")) {
      *out = clone(a);
      if (fault("echo-normalizes") && out->of.list.size) { clear(&out->of.list.data[0].of.record.data[1].val); out->of.list.data[0].of.record.data[1].val = small(1); }
      return NULL;
    }
    *out = from_u64(w); return NULL;
  }
  if (!strcmp(name, "in-option")) {
    if (a->kind != WASMTIME_COMPONENT_OPTION || (a->of.option && !shaped_packet(a->of.option))) return host();
    if (a->of.option && !accept(a->of.option, NESTED_PARAMETER_PREFIX "0?", MK_NORM, &w)) return native();
    *out = from_u64(w); return NULL;
  }
  if (!strcmp(name, "in-product")) {
    if (a->kind != WASMTIME_COMPONENT_TUPLE || a->of.tuple.size != 2 || !shaped_packet(&a->of.tuple.data[0]) || !shaped_packet(&a->of.tuple.data[1])) return host();
    if (!accept(&a->of.tuple.data[0], NESTED_PARAMETER_PREFIX "0.0", MK_MK, &w) || !accept(&a->of.tuple.data[1], NESTED_PARAMETER_PREFIX "0.1", NORM_NORM, &x)) return native();
    *out = from_u64(w + x); return NULL;
  }
  if (!strcmp(name, "in-except")) {
    if (a->kind != WASMTIME_COMPONENT_RESULT || !a->of.result.val || !shaped_packet(a->of.result.val)) return host();
    bool ok = a->of.result.is_ok != fault("except-swapped");
    if (!accept(a->of.result.val, ok ? NESTED_PARAMETER_PREFIX "0.ok" : NESTED_PARAMETER_PREFIX "0.error", ok ? NORM_MK : MK_NORM, &w)) return native();
    *out = from_u64(w); return NULL;
  }
  if (!strcmp(name, "in-holder")) {
    if (a->kind != WASMTIME_COMPONENT_RECORD || a->of.record.size != 2 || !named(&a->of.record.data[0].name, "packet")
        || !named(&a->of.record.data[1].name, "tag") || !shaped_packet(&a->of.record.data[0].val) || !natural(&a->of.record.data[1].val)) return host();
    if (!accept(&a->of.record.data[0].val, NESTED_PARAMETER_PREFIX "0.packet", NORM_MK, &w)) return native();
    if (!small_value(&a->of.record.data[1].val, &x)) abort();
    *out = from_u64(w + (fault("holder-tag") ? 0 : x)); return NULL;
  }
  if (!strcmp(name, "in-choice")) {
    if (a->kind != WASMTIME_COMPONENT_VARIANT) return host();
    if (named(&a->of.variant.discriminant, "empty") && !a->of.variant.val) { *out = from_u64(fault("wrong-choice") ? 1 : 0); return NULL; }
    const value *fields = a->of.variant.val;
    if (!named(&a->of.variant.discriminant, "packet") || !fields || fields->kind != WASMTIME_COMPONENT_RECORD || fields->of.record.size != 1
        || !named(&fields->of.record.data[0].name, "value") || !shaped_packet(&fields->of.record.data[0].val)) return host();
    if (!accept(&fields->of.record.data[0].val, NESTED_PARAMETER_PREFIX "0.packet.value", MK_NORM, &w)) return native();
    *out = from_u64(w); return NULL;
  }
  return host();
}
#endif

wasmtime_error_t *nestedcheckedrecords_wasmtime_call(nestedcheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  ++session->calls;
  if (!strcmp(name, "produce-option") || !strcmp(name, "produce-array")) {
    if (count != 1) return host();
    wasmtime_error_t *error = produce(name, &args[0], out);
    if (!error && fault("input-mutation")) mutate(&args[0]);
    return error;
  }
#ifdef NESTED_CHECKED_RECORD_RESULT_ONLY
  return host();
#else
  return inputs(name, args, count, out);
#endif
}
