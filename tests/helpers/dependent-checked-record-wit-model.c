/* Stand-in host for the immutable dependent checked-record WIT caller. It
 * implements the generated session API over the Wasmtime C value types only,
 * with exact multi-limb natural arithmetic and no compiled component, so the
 * caller's exact totals and fault sensitivity can be measured without
 * producing a package. Never evidence of installed acceptance. */
#include "dependentrecords_wasmtime.h"
#include <stdlib.h>
#include <string.h>

#ifndef DEPENDENT_PARAMETER_PREFIX
#define DEPENDENT_PARAMETER_PREFIX "arg"
#endif
#ifndef DEPENDENT_FAULT
#define DEPENDENT_FAULT ""
#endif
#define LIMBS 8

struct dependentrecords_wasmtime { int open; };

typedef struct { uint32_t limbs[LIMBS]; size_t size; } natural;

static bool fault(const char *name) { return strcmp(DEPENDENT_FAULT, name) == 0; }
static bool named(const wasm_name_t *name, const char *text) {
  return name->size == strlen(text) && memcmp(name->data, text, name->size) == 0;
}
/* Canonical little-endian u32 limbs: no zero limb at the top, zero is empty. */
static bool is_nat(const wasmtime_component_val_t *v, natural *out) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size > LIMBS) return false;
  for (size_t i = 0; i < v->of.list.size; ++i)
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  if (v->of.list.size && v->of.list.data[v->of.list.size - 1].of.u32 == 0) return false;
  out->size = v->of.list.size;
  for (size_t i = 0; i < out->size; ++i) out->limbs[i] = v->of.list.data[i].of.u32;
  return true;
}
static bool is_dependent(const wasmtime_component_val_t *v, natural *bound, natural *below) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2
    && named(&v->of.record.data[0].name, "bound") && is_nat(&v->of.record.data[0].val, bound)
    && named(&v->of.record.data[1].name, "below") && is_nat(&v->of.record.data[1].val, below);
}
static int compare(const natural *a, const natural *b) {
  if (a->size != b->size) return a->size < b->size ? -1 : 1;
  for (size_t i = a->size; i-- > 0;)
    if (a->limbs[i] != b->limbs[i]) return a->limbs[i] < b->limbs[i] ? -1 : 1;
  return 0;
}
static natural add(const natural *a, const natural *b) {
  natural sum = {{0}, 0}; uint64_t carry = 0;
  size_t size = a->size > b->size ? a->size : b->size;
  for (size_t i = 0; i < size || carry; ++i) {
    uint64_t total = carry + (i < a->size ? a->limbs[i] : 0) + (i < b->size ? b->limbs[i] : 0);
    sum.limbs[i] = (uint32_t)total; carry = total >> 32; sum.size = i + 1;
  }
  return sum;
}
static natural from_small(uint32_t n) { natural v = {{n}, n ? 1 : 0}; return v; }
static wasmtime_component_val_t nat_value(const natural *n) {
  wasmtime_component_val_t v = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&v.of.list, n->size);
  for (size_t i = 0; i < n->size; ++i)
    v.of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = n->limbs[i]};
  return v;
}
static wasmtime_component_val_t dependent_value(const natural *bound, const natural *below) {
  wasmtime_component_val_t out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 2);
  wasm_name_new(&out.of.record.data[0].name, 5, "bound"); out.of.record.data[0].val = nat_value(bound);
  wasm_name_new(&out.of.record.data[1].name, 5, "below"); out.of.record.data[1].val = nat_value(below);
  return out;
}
/* The checked constructor: Lean refuses the payload unless below < bound. */
static wasmtime_error_t *checked(const natural *bound, const natural *below) {
  if (compare(below, bound) < 0 || fault("accept-invalid")) return NULL;
  return wasmtime_error_new(fault("wrong-message")
    ? "wrong0 was rejected by DependentRecords.mkDependent"
    : DEPENDENT_PARAMETER_PREFIX "0 was rejected by DependentRecords.mkDependent");
}

wasmtime_error_t *dependentrecords_wasmtime_open(dependentrecords_wasmtime **out) {
  *out = calloc(1, sizeof(**out)); (*out)->open = 1; return NULL;
}
wasmtime_error_t *dependentrecords_wasmtime_link(wasmtime_component_linker_t *linker) {
  (void)linker; return wasmtime_error_new("stand-in host has no linker");
}
void dependentrecords_wasmtime_close(dependentrecords_wasmtime *session) { free(session); }

wasmtime_error_t *dependentrecords_wasmtime_call(dependentrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  static const char invalid[] = "Unknown export, invalid WIT input or 16 MiB conversion limit";
  if (!session || !session->open || !name || !out) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  natural bound, below, seed;
  bool inputs_exported = true;
#ifdef DEPENDENT_RESULT_ONLY
  inputs_exported = fault("inputs-exported");
#endif
  if (inputs_exported && strcmp(name, "dependent-total") == 0 && count == 1 && is_dependent(&args[0], &bound, &below)) {
    wasmtime_error_t *error = checked(&bound, &below);
    if (error) return error;
    natural total = add(&bound, &below); *out = nat_value(&total); return NULL;
  }
  if (inputs_exported && strcmp(name, "dependent-roundtrip") == 0 && count == 1 && is_dependent(&args[0], &bound, &below)) {
    wasmtime_error_t *error = checked(&bound, &below);
    if (error) return error;
    if (fault("wrong-roundtrip")) { natural one = from_small(1), wrong = add(&bound, &one); *out = dependent_value(&wrong, &below); return NULL; }
    *out = dependent_value(&bound, &below); return NULL;
  }
  if (!fault("missing-producer") && strcmp(name, "dependent-result") == 0 && count == 1 && is_nat(&args[0], &seed)) {
    natural step = from_small(fault("wrong-produced") ? 2 : 1), produced = add(&seed, &step);
    *out = dependent_value(&produced, &seed); return NULL;
  }
  return wasmtime_error_new(invalid);
}
