#define _GNU_SOURCE
#include "finrecords_wasmtime.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;
static unsigned checks;
static finrecords_wasmtime *session;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); exit(1); } ++checks; } while (0)
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
/* Nat crosses as little-endian u32 limbs without trailing zeros; zero is the empty list. */
static value limbs(const uint32_t *items, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, count);
  for (size_t i = 0; i < count; ++i) result.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = items[i]};
  return result;
}
static value nat(uint32_t number) { return number ? limbs(&number, 1) : limbs(NULL, 0); }
static bool is_nat(const value *v, uint32_t number) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  if (!number) return v->of.list.size == 0;
  return v->of.list.size == 1 && v->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && v->of.list.data[0].of.u32 == number;
}
static bool named(const wasm_name_t *name, const char *expected) {
  return name->size == strlen(expected) && (!name->size || !memcmp(name->data, expected, name->size));
}
static value text(const char *bytes) { value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, strlen(bytes), bytes); return v; }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION}; }
static value some(value child) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&child)}; }
static value branch(bool ok, value child) { return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {ok, wasmtime_component_val_new(&child)}}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE};
  wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value record(const char **names, value *fields, size_t count) {
  value result = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&result.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&result.of.record.data[i].name, strlen(names[i]), names[i]); result.of.record.data[i].val = fields[i];
  }
  return result;
}
static value tagged(const char *name, value *payload) {
  value result = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&result.of.variant.discriminant, strlen(name), name);
  result.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL; return result;
}
/* Records carry named fields in declaration order; variant cases carry a record of their fields. */
static value tile_of(value digit, value count) { return record((const char *[]){"digit", "count"}, (value[]){digit, count}, 2); }
static value tile(uint32_t digit, uint32_t count) { return tile_of(nat(digit), nat(count)); }
static value nest(uint32_t digit, uint32_t count, uint32_t tag) {
  return record((const char *[]){"inner", "tag"}, (value[]){tile(digit, count), nat(tag)}, 2);
}
static value late(uint32_t digit) {
  value items = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&items.of.list, 2);
  items.of.list.data[0] = nat(1); items.of.list.data[1] = nat(2);
  return record((const char *[]){"label", "items", "digit"}, (value[]){text("ab"), items, nat(digit)}, 3);
}
static value slot(value maybe) { return record((const char *[]){"maybe", "count"}, (value[]){maybe, nat(8)}, 2); }
static value one_field(const char *name, const char *field, value item) {
  value payload = record((const char *[]){field}, &item, 1); return tagged(name, &payload);
}
static value circle(uint32_t radius) { return one_field("circle", "radius", nat(radius)); }
static value label(const char *bytes) { return one_field("label", "text", text(bytes)); }
static value row(void) {
  value result = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&result.of.list, 3);
  result.of.list.data[0] = tile(0, 1); result.of.list.data[1] = tile(4, 2); result.of.list.data[2] = tile(1, 0);
  return result;
}
/* Deep value equality over the shapes this world uses. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
  case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
  case WASMTIME_COMPONENT_STRING: return a->of.string.size == b->of.string.size
    && (!a->of.string.size || !memcmp(a->of.string.data, b->of.string.data, a->of.string.size));
  case WASMTIME_COMPONENT_LIST:
    if (a->of.list.size != b->of.list.size) return false;
    for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
    return true;
  case WASMTIME_COMPONENT_RECORD:
    if (a->of.record.size != b->of.record.size) return false;
    for (size_t i = 0; i < a->of.record.size; ++i) {
      const wasm_name_t *name = &a->of.record.data[i].name, *other = &b->of.record.data[i].name;
      if (name->size != other->size || (name->size && memcmp(name->data, other->data, name->size))) return false;
      if (!same(&a->of.record.data[i].val, &b->of.record.data[i].val)) return false;
    }
    return true;
  case WASMTIME_COMPONENT_VARIANT: {
    const wasm_name_t *name = &a->of.variant.discriminant, *other = &b->of.variant.discriminant;
    if (name->size != other->size || (name->size && memcmp(name->data, other->data, name->size))) return false;
    if (!a->of.variant.val || !b->of.variant.val) return !a->of.variant.val && !b->of.variant.val;
    return same(a->of.variant.val, b->of.variant.val);
  }
  case WASMTIME_COMPONENT_TUPLE:
    if (a->of.tuple.size != b->of.tuple.size) return false;
    for (size_t i = 0; i < a->of.tuple.size; ++i) if (!same(&a->of.tuple.data[i], &b->of.tuple.data[i])) return false;
    return true;
  case WASMTIME_COMPONENT_RESULT:
    if (a->of.result.is_ok != b->of.result.is_ok) return false;
    if (!a->of.result.val || !b->of.result.val) return !a->of.result.val && !b->of.result.val;
    return same(a->of.result.val, b->of.result.val);
  case WASMTIME_COMPONENT_OPTION:
    if (!a->of.option || !b->of.option) return !a->of.option && !b->of.option;
    return same(a->of.option, b->of.option);
  default: return false;
  }
}
/* Arguments are borrowed: run leaves them with the caller, call releases them afterwards. */
static value run(const char *name, const value *args) {
  value result = {0};
  wasmtime_error_t *error = finrecords_wasmtime_call(session, name, args, 1, &result);
  if (error) {
    wasm_name_t message; wasmtime_error_message(error, &message);
    fprintf(stderr, "%s: %.*s\n", name, (int)message.size, message.data); exit(1);
  }
  return result;
}
static value call(const char *name, value *args) { value result = run(name, args); clear(args); return result; }
/* A rejected call names the parameter and the leaf's bound and leaves the result slot unchanged.
   The input is snapshotted before the call and compared with the caller's value immediately
   after the rejection, before anything is released or changed back. */
static bool rejected_kept(const char *name, value *input, const char *expected) {
  value before; wasmtime_component_val_clone(input, &before);
  value output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_error_t *error = finrecords_wasmtime_call(session, name, input, 1, &output);
  bool kept = same(input, &before);
  clear(&before);
  if (!error) return false;
  wasm_name_t message; wasmtime_error_message(error, &message);
  bool reported = message.size >= strlen(expected) && memmem(message.data, message.size, expected, strlen(expected)) != NULL;
  wasm_byte_vec_delete(&message); wasmtime_error_delete(error);
  return reported && kept && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
static bool rejected(const char *name, value *input, const char *expected) {
  bool result = rejected_kept(name, input, expected); clear(input); return result;
}
static value *field(value *v, size_t index) { return &v->of.record.data[index].val; }

int main(void) {
  CHECK(finrecords_wasmtime_open(&session) == NULL);
  value arg, out;
  const uint32_t huge[4] = {0, 0, 0, 16}, huge_plus_three[4] = {3, 0, 0, 16}; /* 2^100 */
  const uint32_t beyond[3] = {0, 0, 64}; /* 2^70 */
  /* Tile: the digit is Fin 5; any count is valid. */
  for (uint32_t d = 0; d < 5; ++d) { arg = tile(d, 10); out = call("tile-sum", &arg); CHECK(is_nat(&out, d + 10)); clear(&out); }
  arg = tile_of(nat(3), limbs(huge, 4)); out = call("tile-sum", &arg);
  value expected = limbs(huge_plus_three, 4); CHECK(same(&out, &expected)); clear(&expected); clear(&out);
  arg = tile_of(nat(5), limbs(huge, 4)); CHECK(rejected("tile-sum", &arg, "arg0 is not below its Fin 5 bound"));
  arg = tile_of(limbs(beyond, 3), limbs(huge, 4)); CHECK(rejected("tile-sum", &arg, "arg0 is not below its Fin 5 bound"));
  /* Nest: the inner record's own bound and the outer bound are both checked. */
  arg = nest(4, 6, 2); out = call("nest-sum", &arg); CHECK(is_nat(&out, 210)); clear(&out);
  arg = nest(5, 6, 2); CHECK(rejected("nest-sum", &arg, "arg0 is not below its Fin 5 bound"));
  arg = nest(4, 6, 3); CHECK(rejected("nest-sum", &arg, "arg0 is not below its Fin 3 bound"));
  arg = nest(4, 6, 2); out = call("nest-sum", &arg); CHECK(is_nat(&out, 210)); clear(&out); /* Recovery. */
  /* Late: heap fields precede the bound; a rejection leaves them as the caller built them. */
  arg = late(4); out = call("late-sum", &arg); CHECK(is_nat(&out, 4005)); clear(&out);
  arg = late(5); CHECK(rejected("late-sum", &arg, "arg0 is not below its Fin 5 bound"));
  arg = late(4); out = call("late-sum", &arg); CHECK(is_nat(&out, 4005)); clear(&out);
  /* Slot: Option (Fin 0) is valid only when absent. */
  arg = slot(none()); out = call("slot-count", &arg); CHECK(is_nat(&out, 8)); clear(&out);
  arg = slot(some(nat(0))); CHECK(rejected("slot-count", &arg, "arg0 is not below its Fin 0 bound"));
  /* Shape: only the active case is checked. */
  arg = circle(9); out = call("shape-size", &arg); CHECK(is_nat(&out, 9)); clear(&out);
  arg = circle(10); CHECK(rejected("shape-size", &arg, "arg0 is not below its Fin 10 bound"));
  arg = label("abc"); out = call("shape-size", &arg); CHECK(is_nat(&out, 1003)); clear(&out);
  arg = tagged("empty", NULL); out = call("shape-size", &arg); CHECK(is_nat(&out, 7)); clear(&out);
  /* Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid. */
  arg = tagged("closed", NULL); out = call("gate-open", &arg); CHECK(is_nat(&out, 1)); clear(&out);
  arg = one_field("never", "value", nat(0)); CHECK(rejected("gate-open", &arg, "arg0 is not below its Fin 0 bound"));
  /* Array Tile and List Tile: every element's fields; the empty sequence is valid. */
  const char *sequences[2] = {"tiles", "tile-list"};
  for (int which = 0; which < 2; ++which) {
    arg = (value){.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&arg.of.list, 0);
    out = call(sequences[which], &arg); CHECK(is_nat(&out, 0)); clear(&out);
    value tiles = row();
    out = run(sequences[which], &tiles); CHECK(is_nat(&out, 8)); clear(&out);
    for (int k = 0; k < 3; ++k) {
      value *digit = field(&tiles.of.list.data[k], 0), kept = *digit;
      *digit = nat(5);
      CHECK(rejected_kept(sequences[which], &tiles, "arg0 is not below its Fin 5 bound") && is_nat(digit, 5));
      clear(digit); *digit = kept;
    }
    out = run(sequences[which], &tiles); CHECK(is_nat(&out, 8)); clear(&out); /* Recovery. */
    clear(&tiles);
  }
  /* Tile × Shape: both components; the inactive circle of a label is never read. */
  arg = pair(tile(4, 6), circle(9)); out = call("tile-pair", &arg); CHECK(is_nat(&out, 19)); clear(&out);
  arg = pair(tile(5, 6), circle(9)); CHECK(rejected("tile-pair", &arg, "arg0 is not below its Fin 5 bound"));
  arg = pair(tile(4, 6), circle(10)); CHECK(rejected("tile-pair", &arg, "arg0 is not below its Fin 10 bound"));
  arg = pair(tile(4, 6), circle(9)); out = call("tile-pair", &arg); CHECK(is_nat(&out, 19)); clear(&out); /* Recovery. */
  arg = pair(tile(1, 1), label("ab")); out = call("tile-pair", &arg); CHECK(is_nat(&out, 1004)); clear(&out);
  /* Except Shape Tile crosses as result<tile, shape>: only the active branch is checked. */
  arg = branch(true, tile(3, 4)); out = call("tile-except", &arg); CHECK(is_nat(&out, 7)); clear(&out);
  arg = branch(true, tile(5, 4)); CHECK(rejected("tile-except", &arg, "arg0 is not below its Fin 5 bound"));
  arg = branch(false, circle(9)); out = call("tile-except", &arg); CHECK(is_nat(&out, 509)); clear(&out);
  arg = branch(false, circle(10)); CHECK(rejected("tile-except", &arg, "arg0 is not below its Fin 10 bound"));
  arg = branch(false, label("x")); out = call("tile-except", &arg); CHECK(is_nat(&out, 1501)); clear(&out);
  arg = branch(true, tile(3, 4)); out = call("tile-except", &arg); CHECK(is_nat(&out, 7)); clear(&out); /* Recovery. */
  /* Option Shape: absent, a valid present circle, then an invalid one. */
  arg = none(); out = call("maybe-shape", &arg); CHECK(is_nat(&out, 99)); clear(&out);
  arg = some(circle(3)); out = call("maybe-shape", &arg); CHECK(is_nat(&out, 3)); clear(&out);
  arg = some(circle(10)); CHECK(rejected("maybe-shape", &arg, "arg0 is not below its Fin 10 bound"));
  /* Results carrying bounds are produced by Lean and arrive below them. */
  arg = tile(4, 9); out = call("bump", &arg);
  expected = tile(0, 10); CHECK(same(&out, &expected)); clear(&expected); clear(&out);
  arg = tile(5, 9); CHECK(rejected("bump", &arg, "arg0 is not below its Fin 5 bound"));
  arg = nat(4); out = call("make-shape", &arg);
  CHECK(out.kind == WASMTIME_COMPONENT_VARIANT && named(&out.of.variant.discriminant, "circle"));
  expected = circle(4); CHECK(same(&out, &expected)); clear(&expected); clear(&out);
  arg = nat(23); out = call("make-shape", &arg);
  CHECK(out.kind == WASMTIME_COMPONENT_VARIANT && named(&out.of.variant.discriminant, "label"));
  expected = label("23"); CHECK(same(&out, &expected)); clear(&expected); clear(&out);
  for (uint32_t i = 0; i < 1000; ++i) {
    arg = tile(i % 5, i); out = call("tile-sum", &arg);
    if (!is_nat(&out, i % 5 + i)) { fprintf(stderr, "round %u failed\n", i); return 1; }
    clear(&out);
    arg = tile(5 + i, i);
    if (!rejected("tile-sum", &arg, "arg0 is not below its Fin 5 bound")) { fprintf(stderr, "rejection round %u failed\n", i); return 1; }
  }
  checks += 2000;
  finrecords_wasmtime_close(session);
  printf("fin-record-ok:%u\n", checks);
  return 0;
}
