/* Source-only nineteen-base stand-in for testing the WIT caller, never a Component Model run. */
#include "nominalprimitivesubtypes_wasmtime.h"
#include "wit-values.h"
#include <math.h>

struct nominalprimitivesubtypes_wasmtime { unsigned calls; };
static bool fault(const char *label) {
  const char *selected = getenv("NOMINAL_WIT_FAULT"); return selected && !strcmp(selected, label);
}
static bool named(const wasm_name_t *actual, const char *expected) {
  return actual->size == strlen(expected) && !memcmp(actual->data, expected, actual->size);
}
static bool natural(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  return fault("accept-noncanonical-nat") || !v->of.list.size || v->of.list.data[v->of.list.size - 1].of.u32 != 0;
}
static bool flag(const value *v) {
  uint8_t raw; if (v->kind != WASMTIME_COMPONENT_BOOL) return false;
  memcpy(&raw, &v->of.boolean, 1); return raw <= 1 || fault("accept-bool-two");
}
static bool int_shape(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_RECORD || v->of.record.size != 2) return false;
  if (!named(&v->of.record.data[0].name, "negative") || !named(&v->of.record.data[1].name, "limbs")) return false;
  if (!flag(&v->of.record.data[0].val) || !natural(&v->of.record.data[1].val)) return false;
  return fault("accept-negative-zero-int") || !v->of.record.data[0].val.of.boolean || v->of.record.data[1].val.of.list.size;
}
static bool valid_utf8(const unsigned char *s, size_t n) {
  for (size_t i = 0; i < n;) {
    unsigned char c = s[i]; size_t width; uint32_t point;
    if (c < 0x80) { ++i; continue; }
    if (c >= 0xc2 && c <= 0xdf) { width = 2; point = c & 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { width = 3; point = c & 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { width = 4; point = c & 0x07; }
    else return false;
    if (i + width > n) return false;
    for (size_t j = 1; j < width; ++j) { if ((s[i + j] & 0xc0) != 0x80) return false; point = (point << 6) | (s[i + j] & 0x3f); }
    if ((width == 3 && point < 0x800) || (width == 4 && (point < 0x10000 || point > 0x10ffff)) || (point >= 0xd800 && point <= 0xdfff)) return false;
    i += width;
  }
  return true;
}
static bool packet_shape(const value *v) {
  static const int kinds[] = {WASMTIME_COMPONENT_ENUM, WASMTIME_COMPONENT_BOOL, WASMTIME_COMPONENT_U8, WASMTIME_COMPONENT_U16, WASMTIME_COMPONENT_U32,
    WASMTIME_COMPONENT_U64, WASMTIME_COMPONENT_S8, WASMTIME_COMPONENT_S16, WASMTIME_COMPONENT_S32, WASMTIME_COMPONENT_S64, WASMTIME_COMPONENT_LIST,
    WASMTIME_COMPONENT_RECORD, WASMTIME_COMPONENT_F32, WASMTIME_COMPONENT_F64, WASMTIME_COMPONENT_STRING, WASMTIME_COMPONENT_LIST,
    WASMTIME_COMPONENT_CHAR, WASMTIME_COMPONENT_U64, WASMTIME_COMPONENT_S64, WASMTIME_COMPONENT_LIST};
  static const char *labels[] = {"unit-value", "bool-value", "uint8-value", "uint16-value", "uint32-value", "uint64-value",
    "int8-value", "int16-value", "int32-value", "int64-value", "nat-value", "int-value", "float32-value", "float64-value",
    "text-value", "bytes-value", "char-value", "usize-value", "isize-value", "digit"};
  if (v->kind != WASMTIME_COMPONENT_RECORD || v->of.record.size != 20) return false;
  for (unsigned i = 0; i < 20; ++i) {
    const wasmtime_component_valrecord_entry_t *entry = &v->of.record.data[i];
    if (!named(&entry->name, labels[i]) || (int)entry->val.kind != kinds[i]) return fault("accept-wrong-kind");
  }
  if (!named(&v->of.record.data[UNIT_FIELD].val.of.enumeration, "unit") || !flag(&v->of.record.data[BOOL_FIELD].val)) return false;
  if (!natural(&v->of.record.data[NAT_FIELD].val) || !int_shape(&v->of.record.data[INT_FIELD].val) || !natural(&v->of.record.data[DIGIT_FIELD].val)) return false;
  const wasm_name_t *s = &v->of.record.data[TEXT_FIELD].val.of.string;
  if (!fault("accept-invalid-utf8") && !valid_utf8((const unsigned char *)s->data, s->size)) return false;
  const value *b = &v->of.record.data[BYTES_FIELD].val;
  for (size_t i = 0; i < b->of.list.size; ++i) if (b->of.list.data[i].kind != WASMTIME_COMPONENT_U8) return false;
  uint32_t c = v->of.record.data[CHAR_FIELD].val.of.character;
  return fault("accept-surrogate-char") || (c <= 0x10ffff && (c < 0xd800 || c > 0xdfff));
}
/* Weaker result predicates: even integers, finite floats, nonempty text and bytes, nonzero char. */
static bool even_limbs(const value *limbs) { return !limbs->of.list.size || limbs->of.list.data[0].of.u32 % 2 == 0; }
static bool produced_packet(const value *v) {
  if (fault("produce-lenient")) return true;
  const wasmtime_component_valrecord_entry_t *d = v->of.record.data;
  return d[BOOL_FIELD].val.of.boolean && d[UINT8_FIELD].val.of.u8 % 2 == 0 && d[UINT16_FIELD].val.of.u16 % 2 == 0
    && d[UINT32_FIELD].val.of.u32 % 2 == 0 && d[UINT64_FIELD].val.of.u64 % 2 == 0 && d[INT8_FIELD].val.of.s8 % 2 == 0
    && d[INT16_FIELD].val.of.s16 % 2 == 0 && d[INT32_FIELD].val.of.s32 % 2 == 0 && d[INT64_FIELD].val.of.s64 % 2 == 0
    && even_limbs(&d[NAT_FIELD].val) && even_limbs(&d[INT_FIELD].val.of.record.data[1].val)
    && isfinite(d[FLOAT32_FIELD].val.of.f32) && isfinite(d[FLOAT64_FIELD].val.of.f64)
    && d[TEXT_FIELD].val.of.string.size > 0 && d[BYTES_FIELD].val.of.list.size > 0 && d[CHAR_FIELD].val.of.character != 0
    && d[USIZE_FIELD].val.of.u64 % 2 == 0 && d[ISIZE_FIELD].val.of.s64 % 2 == 0;
}
static bool produced_digit(const value *v) {
  const value *digit = &v->of.record.data[DIGIT_FIELD].val;
  return fault("produce-digit") || digit->of.list.size == 0 || (digit->of.list.size == 1 && digit->of.list.data[0].of.u32 < 3);
}
static value absent_group(void) { value out = list(fault("missing-group") ? 0 : 1); if (out.of.list.size) out.of.list.data[0] = none(); return out; }
static value produced_group(const value *v, bool accepted) { return accepted ? group(clone(v)) : absent_group(); }
#ifndef NOMINAL_RESULT_ONLY
#include "nominal-primitive-subtype-wit-input-model.h"
#endif
wasmtime_error_t *nominalprimitivesubtypes_wasmtime_open(nominalprimitivesubtypes_wasmtime **out) {
  (void)huge; (void)pair; (void)s8; (void)s16; (void)s32; (void)u16; (void)u32; (void)text; (void)character; (void)bytes; (void)integer;
  (void)nominal_snapshot_controls; (void)exact_cause; (void)base; (void)produced_fields; (void)normalized_fields; (void)packet;
  if (!out) return wasmtime_error_new("no output");
  *out = calloc(1, sizeof(**out)); return *out ? NULL : wasmtime_error_new("allocation");
}
void nominalprimitivesubtypes_wasmtime_close(nominalprimitivesubtypes_wasmtime *state) { free(state); }
wasmtime_error_t *nominalprimitivesubtypes_wasmtime_call(nominalprimitivesubtypes_wasmtime *state, const char *label,
    const value *args, size_t count, value *out) {
  const char *invalid = "Unknown export, invalid WIT input or 16 MiB conversion limit";
  if (!state || !label || !out || (count && !args)) return wasmtime_error_new(invalid);
  if (!strcmp(label, "word-bits")) {
    if (count) return wasmtime_error_new(invalid);
    *out = u32(fault("word-bits") ? 32 : 64); ++state->calls; return NULL;
  }
#ifndef NOMINAL_RESULT_ONLY
  if (known_input(label)) return model_input(label, args, count, out);
#endif
  if (count != 1 || !packet_shape(&args[0]))
    return wasmtime_error_new(fault("wrong-host-diagnostic") ? "Unexpected input" : invalid);
  const value *input = &args[0]; value result = {0};
  const bool accepted = produced_packet(input) && produced_digit(input);
  if (!strcmp(label, "produce")) result = accepted ? some(clone(input)) : none();
  else if (!strcmp(label, "produce-group")) result = produced_group(input, accepted);
  else if (!strcmp(label, "produce-pair")) result = boxes(fault("pair-left-empty") ? absent_group() : produced_group(input, accepted), produced_group(input, accepted));
  else if (!strcmp(label, "produce-event")) result = accepted && !fault("missing-event-value") ? event_box(clone(input)) : event_empty();
  else if (!strcmp(label, "produce-choices")) {
    if (!accepted) result = event_choices(absent_group());
    else {
      value values = list(3); values.of.list.data[0] = none();
      values.of.list.data[1] = some(branch(!fault("wrong-choice-tag"), clone(input)));
      values.of.list.data[2] = some(branch(fault("wrong-choice-tag"), clone(input)));
      result = event_choices(values);
    }
  } else return wasmtime_error_new(invalid);
  if (fault("changed-field-name") && result.kind == WASMTIME_COMPONENT_OPTION && result.of.option)
    result.of.option->of.record.data[0].name.data[0] = 'X';
  if (fault("input-mutation")) ++((value *)input)->of.record.data[UINT8_FIELD].val.of.u8;
  ++state->calls; *out = result; return NULL;
}
