#include "nominalsubtypes_wasmtime.h"
/* The shared value helpers serve the nominal caller too; only their unused
   definitions are exempt, so warnings in this caller still fail. */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"
#ifndef NOMINAL_SUBTYPE_WIT_VALUES_H
#define NOMINAL_SUBTYPE_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;

/* Independent comparison of every active public payload, including NUL suffixes. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_STRING:
      return a->of.string.size == b->of.string.size &&
        (!a->of.string.size || memcmp(a->of.string.data, b->of.string.data, a->of.string.size) == 0);
    case WASMTIME_COMPONENT_LIST:
      if (a->of.list.size != b->of.list.size) return false;
      for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_TUPLE:
      if (a->of.tuple.size != b->of.tuple.size) return false;
      for (size_t i = 0; i < a->of.tuple.size; ++i) if (!same(&a->of.tuple.data[i], &b->of.tuple.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_OPTION:
      if (!a->of.option || !b->of.option) return a->of.option == b->of.option;
      return same(a->of.option, b->of.option);
    case WASMTIME_COMPONENT_RESULT:
      if (a->of.result.is_ok != b->of.result.is_ok) return false;
      if (!a->of.result.val || !b->of.result.val) return a->of.result.val == b->of.result.val;
      return same(a->of.result.val, b->of.result.val);
    case WASMTIME_COMPONENT_RECORD:
      if (a->of.record.size != b->of.record.size) return false;
      for (size_t i = 0; i < a->of.record.size; ++i) {
        const wasmtime_component_valrecord_entry_t *x = &a->of.record.data[i], *y = &b->of.record.data[i];
        if (x->name.size != y->name.size || (x->name.size && memcmp(x->name.data, y->name.data, x->name.size))) return false;
        if (!same(&x->val, &y->val)) return false;
      }
      return true;
    case WASMTIME_COMPONENT_VARIANT:
      if (a->of.variant.discriminant.size != b->of.variant.discriminant.size) return false;
      if (a->of.variant.discriminant.size && memcmp(a->of.variant.discriminant.data, b->of.variant.discriminant.data, a->of.variant.discriminant.size)) return false;
      if (!a->of.variant.val || !b->of.variant.val) return a->of.variant.val == b->of.variant.val;
      return same(a->of.variant.val, b->of.variant.val);
    default: return false;
  }
}
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value clone(const value *v) { value copied = {0}; wasmtime_component_val_clone(v, &copied); return copied; }
static value list(size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&v.of.list, size); return v;
}
static value nat(const uint32_t *limbs, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i) v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return v;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
static value huge(bool increment) { const uint32_t limbs[] = {increment ? 1 : 0, 0, 0, 16}; return nat(limbs, 4); }
static value wide(bool below) { const uint32_t limbs[] = {below ? 9 : 10, 0, 10}; return nat(limbs, 3); }
static value text(const char *bytes, size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, size, bytes); return v;
}
static value word(void) { static const char s[] = "h\xc3\xa9llo\0tail\xf0\x9f\x99\x82"; return text(s, sizeof(s) - 1); }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&payload)}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value branch(bool ok, value payload) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = ok, .val = wasmtime_component_val_new(&payload)}};
}
static value byte(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }

/* Accept a complete cause, not a substring of some unrelated Wasmtime failure. */
static bool exact_cause(const char *bytes, size_t size, const char *expected) {
  if (memchr(bytes, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(bytes, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(bytes, start, sizeof(start) - 1)) return false;
  /* Wasmtime's formatted error chain terminates in one newline. A bare cause
   * still requires byte-for-byte equality, and extra trailing data rejects. */
  if (bytes[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(bytes + at, marker, sizeof(marker) - 1) || memcmp(bytes + end, expected, length)) return false;
  /* A cause marker embedded in the backtrace would make the chain ambiguous. */
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(bytes + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}

static value named_fields(size_t count, const char **names, value *fields) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&out.of.record.data[i].name, strlen(names[i]), names[i]);
    out.of.record.data[i].val = fields[i];
  }
  return out;
}
static value one_field(const char *name, value payload) {
  const char *names[] = {name}; return named_fields(1, names, &payload);
}
static value two_fields(const char *first, value left, const char *second, value right) {
  const char *names[] = {first, second}; value fields[] = {left, right}; return named_fields(2, names, fields);
}
static value envelope(value payload, uint32_t digit) { return two_fields("payload", payload, "digit", small(digit)); }
static value boxes(value left, value right) { return two_fields("left", left, "right", right); }
static value event(const char *name, value *payload) {
  value out = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&out.of.variant.discriminant, strlen(name), name);
  out.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL;
  return out;
}
static value event_empty(void) { return event("empty", NULL); }
static value event_box(value wrapped) { value payload=one_field("value",wrapped); return event("box", &payload); }
static value event_choices(value values) { value payload=one_field("values",values); return event("choices", &payload); }
static value group(value wrapped) {
  value out=list(2); out.of.list.data[0]=none(); out.of.list.data[1]=some(wrapped); return out;
}
static unsigned nominal_snapshot_controls(void) {
  value wrapped=envelope(huge(false),2), a=event_box(clone(&wrapped)), b=boxes(group(clone(&wrapped)),group(clone(&wrapped)));
  value saved_a=clone(&a), saved_b=clone(&b);
  if (!same(&a,&saved_a) || !same(&b,&saved_b)) abort();
  unsigned controls=0;
#define DIFFERENT() do { if (same(&a,&saved_a) && same(&b,&saved_b)) abort(); ++controls; } while(0)
  wasmtime_component_valrecord_entry_t *field=&a.of.variant.val->of.record.data[0];
  field->name.data[0]^=1; DIFFERENT(); field->name.data[0]^=1;
  --field->name.size; DIFFERENT(); ++field->name.size;
  value *record=&field->val, *natural=&record->of.record.data[0].val;
  record->of.record.data[0].name.data[0]^=1; DIFFERENT(); record->of.record.data[0].name.data[0]^=1;
  ++natural->of.list.data[0].of.u32; DIFFERENT(); --natural->of.list.data[0].of.u32;
  ++natural->of.list.data[3].of.u32; DIFFERENT(); --natural->of.list.data[3].of.u32;
  --natural->of.list.size; DIFFERENT(); ++natural->of.list.size;
  ++record->of.record.data[1].val.of.list.data[0].of.u32; DIFFERENT(); --record->of.record.data[1].val.of.list.data[0].of.u32;
  --record->of.record.size; DIFFERENT(); ++record->of.record.size;
  a.of.variant.discriminant.data[0]^=1; DIFFERENT(); a.of.variant.discriminant.data[0]^=1;
  --a.of.variant.discriminant.size; DIFFERENT(); ++a.of.variant.discriminant.size;
  value *kept=a.of.variant.val; a.of.variant.val=NULL; DIFFERENT(); a.of.variant.val=kept;
  wasmtime_component_valrecord_entry_t first=b.of.record.data[0];
  b.of.record.data[0]=b.of.record.data[1]; b.of.record.data[1]=first; DIFFERENT();
  first=b.of.record.data[0]; b.of.record.data[0]=b.of.record.data[1]; b.of.record.data[1]=first;
  value *left=&b.of.record.data[0].val, *right=&b.of.record.data[1].val;
  --left->of.list.size; DIFFERENT(); ++left->of.list.size;
  value option=right->of.list.data[1]; right->of.list.data[1]=none(); DIFFERENT(); right->of.list.data[1]=option;
  if (!same(&a,&saved_a) || !same(&b,&saved_b)) abort();
#undef DIFFERENT
  clear(&wrapped); clear(&a); clear(&b); clear(&saved_a); clear(&saved_b);
  value values=list(3); values.of.list.data[0]=none(); values.of.list.data[1]=some(branch(true,huge(false))); values.of.list.data[2]=some(branch(false,small(40)));
  a=event_choices(values); saved_a=clone(&a);
  value *case_values=&a.of.variant.val->of.record.data[0].val;
  case_values->of.list.data[1].of.option->of.result.is_ok=false;
  if (same(&a,&saved_a)) abort();
  ++controls;
  case_values->of.list.data[1].of.option->of.result.is_ok=true;
  clear(&a); clear(&saved_a);
  return controls;
}
#endif

#pragma GCC diagnostic pop
#include <stdio.h>

static nominalsubtypes_wasmtime *session;
static unsigned checks, rejections;
#define CHECK(test) do { if (!(test)) { fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

static value generic(uint32_t member, uint32_t marker) {
  return two_fields("value", small(member), "marker", small(marker));
}
static value *field(value *record, const char *name) {
  if (record->kind != WASMTIME_COMPONENT_RECORD) return NULL;
  for (size_t i = 0; i < record->of.record.size; ++i)
    if (record->of.record.data[i].name.size == strlen(name) &&
        memcmp(record->of.record.data[i].name.data, name, strlen(name)) == 0)
      return &record->of.record.data[i].val;
  return NULL;
}
static bool same_generic(value *record, uint32_t member, uint32_t marker) {
  value *a = field(record, "value"), *b = field(record, "marker");
  return a && b && a->kind == WASMTIME_COMPONENT_LIST && b->kind == WASMTIME_COMPONENT_LIST
    && a->of.list.size == (member ? 1u : 0u) && b->of.list.size == (marker ? 1u : 0u)
    && (!member || (a->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && a->of.list.data[0].of.u32 == member))
    && (!marker || (b->of.list.data[0].kind == WASMTIME_COMPONENT_U32 && b->of.list.data[0].of.u32 == marker));
}
static int call_record(const char *name, value input, uint32_t member, uint32_t marker) {
  value before = clone(&input), output = {0};
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, name, &input, 1, &output);
  if (error) { wasmtime_error_delete(error); clear(&input); clear(&before); return 0; }
  CHECK(same_generic(&output, member, marker)); CHECK(same(&input, &before));
  clear(&input); clear(&before); clear(&output); return 1;
}
static int call_scalar(value input, uint32_t expected) {
  value before = clone(&input), output = {0}, wanted = small(expected);
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, "generic-use", &input, 1, &output);
  if (error) { wasmtime_error_delete(error); clear(&input); clear(&before); clear(&wanted); return 0; }
  CHECK(same(&output, &wanted)); CHECK(same(&input, &before));
  clear(&input); clear(&before); clear(&output); clear(&wanted); return 1;
}
static int refused(const char *name, value input, const char *constructor) {
  value before = clone(&input), output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  char expected[128]; snprintf(expected, sizeof(expected), "value0.value was rejected by NominalSubtypes.%s", constructor);
  wasmtime_error_t *error = nominalsubtypes_wasmtime_call(session, name, &input, 1, &output);
  if (!error) { clear(&input); clear(&before); clear(&output); return 0; }
  wasm_name_t message; wasmtime_error_message(error, &message);
  CHECK(exact_cause(message.data, message.size, expected));
  CHECK(same(&input, &before) && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991);
  ++rejections; wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&input); clear(&before); clear(&output); return 1;
}
int main(void) {
  CHECK(nominalsubtypes_wasmtime_open(&session) == NULL); --checks;
  if (!call_scalar(generic(40, 2), 43)) return 1;
  if (!call_record("echo-generic-first", generic(40, 2), 41, 2)) return 1;
  if (!call_record("echo-generic-second", generic(40, 2), 42, 2)) return 1;
  if (!call_scalar(generic(99, 7), 107)) return 1;
  if (!call_record("echo-generic-first", generic(99, 7), 100, 7)) return 1;
  if (!refused("generic-use", generic(100, 2), "plusOne")) return 1;
  if (!refused("echo-generic-first", generic(100, 2), "plusOne")) return 1;
  if (!refused("echo-generic-second", generic(90, 2), "plusTwo")) return 1;
  if (!call_record("echo-generic-second", generic(40, 2), 42, 2)) return 1;
  nominalsubtypes_wasmtime_close(session);
  printf("{\"checks\":%u,\"rejections\":%u}\n", checks, rejections);
  return 0;
}
