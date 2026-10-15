#ifndef NOMINAL_PRIMITIVE_SUBTYPE_WIT_VALUES_H
#define NOMINAL_PRIMITIVE_SUBTYPE_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;

/* Independent comparison of every nineteen-base payload; floats compare by bit pattern. */
static bool same_name(const wasm_name_t *a, const wasm_name_t *b) {
  return a->size == b->size && (!a->size || memcmp(a->data, b->data, a->size) == 0);
}
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_BOOL: return a->of.boolean == b->of.boolean;
    case WASMTIME_COMPONENT_S8: return a->of.s8 == b->of.s8;
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_S16: return a->of.s16 == b->of.s16;
    case WASMTIME_COMPONENT_U16: return a->of.u16 == b->of.u16;
    case WASMTIME_COMPONENT_S32: return a->of.s32 == b->of.s32;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_S64: return a->of.s64 == b->of.s64;
    case WASMTIME_COMPONENT_U64: return a->of.u64 == b->of.u64;
    case WASMTIME_COMPONENT_F32: return memcmp(&a->of.f32, &b->of.f32, sizeof(float)) == 0;
    case WASMTIME_COMPONENT_F64: return memcmp(&a->of.f64, &b->of.f64, sizeof(double)) == 0;
    case WASMTIME_COMPONENT_CHAR: return a->of.character == b->of.character;
    case WASMTIME_COMPONENT_STRING: return same_name(&a->of.string, &b->of.string);
    case WASMTIME_COMPONENT_ENUM: return same_name(&a->of.enumeration, &b->of.enumeration);
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
        if (!same_name(&x->name, &y->name) || !same(&x->val, &y->val)) return false;
      }
      return true;
    case WASMTIME_COMPONENT_VARIANT:
      if (!same_name(&a->of.variant.discriminant, &b->of.variant.discriminant)) return false;
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
/* 2^100 plus an offset below 2^32, canonical little-endian limbs. */
static value huge(uint32_t offset) { const uint32_t limbs[] = {offset, 0, 0, 16}; return nat(limbs, 4); }
static value name(const char *bytes, size_t size, int kind) {
  value v = {.kind = kind};
  if (kind == WASMTIME_COMPONENT_STRING) wasm_name_new(&v.of.string, size, bytes); else wasm_name_new(&v.of.enumeration, size, bytes);
  return v;
}
static value text(const char *bytes, size_t size) { return name(bytes, size, WASMTIME_COMPONENT_STRING); }
static value unit(void) { return name("unit", 4, WASMTIME_COMPONENT_ENUM); }
static value boolean(bool b) { return (value){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = b}; }
static value u8(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }
static value u16(uint16_t n) { return (value){.kind = WASMTIME_COMPONENT_U16, .of.u16 = n}; }
static value u32(uint32_t n) { return (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = n}; }
static value u64(uint64_t n) { return (value){.kind = WASMTIME_COMPONENT_U64, .of.u64 = n}; }
static value s8(int8_t n) { return (value){.kind = WASMTIME_COMPONENT_S8, .of.s8 = n}; }
static value s16(int16_t n) { return (value){.kind = WASMTIME_COMPONENT_S16, .of.s16 = n}; }
static value s32(int32_t n) { return (value){.kind = WASMTIME_COMPONENT_S32, .of.s32 = n}; }
static value s64(int64_t n) { return (value){.kind = WASMTIME_COMPONENT_S64, .of.s64 = n}; }
static value f32(float n) { return (value){.kind = WASMTIME_COMPONENT_F32, .of.f32 = n}; }
static value f64(double n) { return (value){.kind = WASMTIME_COMPONENT_F64, .of.f64 = n}; }
static value character(uint32_t n) { return (value){.kind = WASMTIME_COMPONENT_CHAR, .of.character = n}; }
static value bytes(const uint8_t *data, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i) v.of.list.data[i] = u8(data[i]);
  return v;
}
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&payload)}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value branch(bool ok, value payload) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = ok, .val = wasmtime_component_val_new(&payload)}};
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
static value one_field(const char *label, value payload) {
  const char *names[] = {label}; return named_fields(1, names, &payload);
}
static value two_fields(const char *first, value left, const char *second, value right) {
  const char *names[] = {first, second}; value fields[] = {left, right}; return named_fields(2, names, fields);
}
/* Lean Int on the wire: sign plus canonical magnitude limbs. */
static value integer(bool negative, value limbs) { return two_fields("negative", boolean(negative), "limbs", limbs); }
static value boxes(value left, value right) { return two_fields("left", left, "right", right); }
static value event(const char *label, value *payload) {
  value out = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&out.of.variant.discriminant, strlen(label), label);
  out.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL;
  return out;
}
static value event_empty(void) { return event("empty", NULL); }
static value event_box(value wrapped) { value payload = one_field("value", wrapped); return event("box", &payload); }
static value event_choices(value values) { value payload = one_field("values", values); return event("choices", &payload); }
static value group(value wrapped) {
  value out = list(2); out.of.list.data[0] = none(); out.of.list.data[1] = some(wrapped); return out;
}

/* Accept a complete cause, not a substring of some unrelated Wasmtime failure. */
static bool exact_cause(const char *text_bytes, size_t size, const char *expected) {
  if (memchr(text_bytes, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(text_bytes, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(text_bytes, start, sizeof(start) - 1)) return false;
  /* Wasmtime's formatted error chain terminates in one newline. A bare cause
   * still requires byte-for-byte equality, and extra trailing data rejects. */
  if (text_bytes[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(text_bytes + at, marker, sizeof(marker) - 1) || memcmp(text_bytes + end, expected, length)) return false;
  /* A cause marker embedded in the backtrace would make the chain ambiguous. */
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(text_bytes + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}

/* Every nineteen-base field as independent host data; packets are built from these. */
typedef struct {
  bool bool_value;
  uint8_t uint8_value; uint16_t uint16_value; uint32_t uint32_value; uint64_t uint64_value;
  int8_t int8_value; int16_t int16_value; int32_t int32_value; int64_t int64_value;
  const uint32_t *nat_limbs; size_t nat_size;
  bool int_negative; const uint32_t *int_limbs; size_t int_size;
  float float32_value; double float64_value;
  const char *text_data; size_t text_size;
  const uint8_t *bytes_data; size_t bytes_size;
  uint32_t char_value; uint64_t usize_value; int64_t isize_value; uint32_t digit;
} fields;
static const uint32_t forty_two[] = {42}, forty_four[] = {44}, forty[] = {40}, forty_three[] = {43}, hundred[] = {100};
static const uint32_t two_to_100[] = {0, 0, 0, 16}, two_to_100_plus_2[] = {2, 0, 0, 16}, two_to_100_minus_2[] = {0xfffffffe, 0xffffffff, 0xffffffff, 15};
static const uint8_t original_bytes[] = {0, 128, 255}, normalized_bytes[] = {0, 128, 255, 255};
static const uint8_t produced_bytes[] = {0, 1, 2, 3, 4, 5, 128, 254, 255}, appended_bytes[] = {255};
static const char produced_text[] = "long \xce\xbb text", unicode_text[] = "a\0\xce\xbb\xf0\x9f\x98\x80", unicode_normalized[] = "a\0\xce\xbb\xf0\x9f\x98\x80!";
static fields base(void) {
  fields f = {0};
  f.bool_value = true;
  f.uint8_value = 42; f.uint16_value = 42; f.uint32_value = 42; f.uint64_value = 42;
  f.int8_value = -42; f.int16_value = -42; f.int32_value = -42; f.int64_value = -42;
  f.nat_limbs = forty_two; f.nat_size = 1; f.int_negative = true; f.int_limbs = forty_two; f.int_size = 1;
  f.float32_value = 1.5f; f.float64_value = 1.5;
  f.text_data = "a"; f.text_size = 1; f.bytes_data = original_bytes; f.bytes_size = sizeof(original_bytes);
  f.char_value = 97; f.usize_value = 42; f.isize_value = -42; f.digit = 2;
  return f;
}
/* Valid for every Subtype predicate while outside the stricter A input policies. */
static fields produced_fields(void) {
  fields f = base();
  f.uint8_value = 200; f.uint16_value = 200; f.uint32_value = 200; f.uint64_value = 200;
  f.int8_value = 120; f.int16_value = 120; f.int32_value = 120; f.int64_value = 120;
  f.nat_limbs = two_to_100; f.nat_size = 4; f.int_negative = true; f.int_limbs = two_to_100; f.int_size = 4;
  f.float32_value = 12.5f; f.float64_value = 12.5;
  f.text_data = produced_text; f.text_size = sizeof(produced_text) - 1; f.bytes_data = produced_bytes; f.bytes_size = sizeof(produced_bytes);
  f.char_value = 955; f.usize_value = 200; f.isize_value = 200;
  return f;
}
/* The B selections applied to the base packet with a false bool. */
static fields normalized_fields(void) {
  fields f = base();
  f.uint8_value = 44; f.uint16_value = 44; f.uint32_value = 44; f.uint64_value = 44;
  f.int8_value = -40; f.int16_value = -40; f.int32_value = -40; f.int64_value = -40;
  f.nat_limbs = forty_four; f.int_limbs = forty;
  f.float32_value = -1.5f; f.float64_value = -1.5;
  f.text_data = "a!"; f.text_size = 2; f.bytes_data = normalized_bytes; f.bytes_size = sizeof(normalized_bytes);
  f.char_value = 98; f.usize_value = 44; f.isize_value = -40;
  return f;
}
static value packet(const fields *f) {
  const char *names[] = {"unit-value", "bool-value", "uint8-value", "uint16-value", "uint32-value", "uint64-value",
    "int8-value", "int16-value", "int32-value", "int64-value", "nat-value", "int-value", "float32-value", "float64-value",
    "text-value", "bytes-value", "char-value", "usize-value", "isize-value", "digit"};
  value values[] = {unit(), boolean(f->bool_value), u8(f->uint8_value), u16(f->uint16_value), u32(f->uint32_value), u64(f->uint64_value),
    s8(f->int8_value), s16(f->int16_value), s32(f->int32_value), s64(f->int64_value), nat(f->nat_limbs, f->nat_size),
    integer(f->int_negative, nat(f->int_limbs, f->int_size)), f32(f->float32_value), f64(f->float64_value),
    text(f->text_data, f->text_size), bytes(f->bytes_data, f->bytes_size), character(f->char_value),
    u64(f->usize_value), s64(f->isize_value), small(f->digit)};
  return named_fields(20, names, values);
}
enum { UNIT_FIELD, BOOL_FIELD, UINT8_FIELD, UINT16_FIELD, UINT32_FIELD, UINT64_FIELD, INT8_FIELD, INT16_FIELD, INT32_FIELD, INT64_FIELD,
  NAT_FIELD, INT_FIELD, FLOAT32_FIELD, FLOAT64_FIELD, TEXT_FIELD, BYTES_FIELD, CHAR_FIELD, USIZE_FIELD, ISIZE_FIELD, DIGIT_FIELD };
static value *field(value *record, unsigned index) { return &record->of.record.data[index].val; }

/* Every field participates in comparison, including float signs. */
static unsigned nominal_snapshot_controls(void) {
  fields f = base(); f.float32_value = 0.0f; f.float64_value = 0.0;
  value a = packet(&f), saved = clone(&a);
  if (!same(&a, &saved)) abort();
  unsigned controls = 0;
#define DIFFERENT(change) do { change; if (same(&a, &saved)) abort(); ++controls; clear(&a); a = clone(&saved); } while (0)
  DIFFERENT(field(&a, UNIT_FIELD)->of.enumeration.data[0] ^= 1);
  DIFFERENT(field(&a, BOOL_FIELD)->of.boolean = false);
  DIFFERENT(++field(&a, UINT8_FIELD)->of.u8); DIFFERENT(++field(&a, UINT16_FIELD)->of.u16);
  DIFFERENT(++field(&a, UINT32_FIELD)->of.u32); DIFFERENT(++field(&a, UINT64_FIELD)->of.u64);
  DIFFERENT(++field(&a, INT8_FIELD)->of.s8); DIFFERENT(++field(&a, INT16_FIELD)->of.s16);
  DIFFERENT(++field(&a, INT32_FIELD)->of.s32); DIFFERENT(++field(&a, INT64_FIELD)->of.s64);
  DIFFERENT(++field(&a, NAT_FIELD)->of.list.data[0].of.u32);
  DIFFERENT(field(&a, INT_FIELD)->of.record.data[0].val.of.boolean = false);
  DIFFERENT(field(&a, FLOAT32_FIELD)->of.f32 = -0.0f); DIFFERENT(field(&a, FLOAT64_FIELD)->of.f64 = -0.0);
  DIFFERENT(--field(&a, TEXT_FIELD)->of.string.size); DIFFERENT(--field(&a, BYTES_FIELD)->of.list.size);
  DIFFERENT(++field(&a, CHAR_FIELD)->of.character); DIFFERENT(++field(&a, USIZE_FIELD)->of.u64);
  DIFFERENT(++field(&a, ISIZE_FIELD)->of.s64); DIFFERENT(++field(&a, DIGIT_FIELD)->of.list.data[0].of.u32);
  DIFFERENT(a.of.record.data[0].name.data[0] ^= 1);
  DIFFERENT(--a.of.record.size);
#undef DIFFERENT
  if (!same(&a, &saved)) abort();
  clear(&a); clear(&saved);
  return controls;
}
#endif
