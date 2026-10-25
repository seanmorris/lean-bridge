#include "nominalprimitivesubtypes_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>


static inline nominalprimitivesubtypes_status lb_invalid(nominalprimitivesubtypes_error *error, const char *message) {
  if (error) *error = (nominalprimitivesubtypes_error){NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT;
}
static inline nominalprimitivesubtypes_status lb_failure(nominalprimitivesubtypes_error *error, const char *message) {
  if (error) *error = (nominalprimitivesubtypes_error){NOMINALPRIMITIVESUBTYPES_ERROR_UNEXPECTED, message, strlen(message)};
  return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
}
static inline nominalprimitivesubtypes_status lb_ready(nominalprimitivesubtypes_error *error) {
  return lean_bridge_native_component_ready("nominalprimitivesubtypes@1.0.0")
    ? NOMINALPRIMITIVESUBTYPES_STATUS_OK : lb_failure(error, "Lean runtime is not ready or has been retired");
}
static inline int lb_charge(size_t *budget, size_t length, size_t width) {
  if (length > *budget / width) return 0;
  *budget -= length * width; return 1;
}
static inline int lb_utf8(const uint8_t *bytes, size_t length) {
  size_t i = 0;
  while (i < length) {
    uint32_t point = bytes[i++]; size_t extra; uint32_t minimum;
    if (point < 0x80) continue;
    if (point >= 0xc2 && point <= 0xdf) { point &= 0x1f; extra = 1; minimum = 0x80; }
    else if (point >= 0xe0 && point <= 0xef) { point &= 0x0f; extra = 2; minimum = 0x800; }
    else if (point >= 0xf0 && point <= 0xf4) { point &= 7; extra = 3; minimum = 0x10000; }
    else return 0;
    if (extra > length - i) return 0;
    while (extra--) { uint8_t next = bytes[i++]; if ((next & 0xc0) != 0x80) return 0; point = (point << 6) | (next & 0x3f); }
    if (point < minimum || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return 0;
  }
  return 1;
}
static inline lean_object *lb_bytes_in(const uint8_t *data, size_t length) {
  lean_object *value = lean_alloc_sarray(1, length, length);
  if (length) memcpy(lean_sarray_cptr(value), data, length);
  return value;
}
static inline lean_object *lb_nat_in(const uint32_t *data, size_t length) {
  lean_object *value = lean_box(0);
  while (length) {
    lean_object *shifted = lean_nat_shiftl(value, lean_box(32)); lean_dec(value);
    lean_object *limb = lean_uint32_to_nat(data[--length]);
    value = lean_nat_add(shifted, limb); lean_dec(shifted); lean_dec(limb);
  }
  return value;
}
static inline lean_object *lb_int_in(const uint32_t *data, size_t length, bool negative) {
  lean_object *value = lean_nat_to_int(lb_nat_in(data, length));
  if (negative) { lean_object *negated = lean_int_neg(value); lean_dec(value); value = negated; }
  return value;
}
/* Borrow value; release every temporary on success, budget failure, and OOM. */
static inline int lb_nat_out(lean_object *value, uint32_t **out, size_t *length, size_t budget) {
  uint32_t *data = NULL; size_t used = 0, capacity = 0, limit = budget / sizeof(uint32_t);
  lean_inc(value);
  while (!lean_nat_eq(value, lean_box(0))) {
    if (used == limit) { free(data); lean_dec(value); return 0; }
    if (used == capacity) {
      capacity = capacity ? capacity * 2 : 4;
      if (capacity > limit) capacity = limit;
      uint32_t *grown = realloc(data, capacity * sizeof(uint32_t));
      if (!grown) { free(data); lean_dec(value); return -1; }
      data = grown;
    }
    data[used++] = lean_uint32_of_nat(value);
    lean_object *next = lean_nat_shiftr(value, lean_box(32)); lean_dec(value); value = next;
  }
  lean_dec(value); *out = data; *length = used; return 1;
}

static inline int lb_copy_0_check(const uint8_t *value, size_t *budget) {
  (void)value; (void)budget;
  if (*value != 0) return 0;
  return 1;
}
static inline lean_object * lb_copy_0_in(const uint8_t *value) {
  (void)value;
  return lean_box(0);
}
static inline int lb_copy_0_out(lean_object * value, uint8_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = 0;
  return 1;
}

static inline int lb_copy_1_check(const bool *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint8_t lb_copy_1_in(const bool *value) {
  (void)value;
  return (uint8_t)*value;
}
static inline int lb_copy_1_out(uint8_t value, bool *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (bool)value;
  return 1;
}

static inline int lb_copy_2_check(const uint8_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint8_t lb_copy_2_in(const uint8_t *value) {
  (void)value;
  return (uint8_t)*value;
}
static inline int lb_copy_2_out(uint8_t value, uint8_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint8_t)value;
  return 1;
}

static inline int lb_copy_3_check(const uint16_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint16_t lb_copy_3_in(const uint16_t *value) {
  (void)value;
  return (uint16_t)*value;
}
static inline int lb_copy_3_out(uint16_t value, uint16_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint16_t)value;
  return 1;
}

static inline int lb_copy_4_check(const uint32_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint32_t lb_copy_4_in(const uint32_t *value) {
  (void)value;
  return (uint32_t)*value;
}
static inline int lb_copy_4_out(uint32_t value, uint32_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint32_t)value;
  return 1;
}

static inline int lb_copy_5_check(const uint64_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint64_t lb_copy_5_in(const uint64_t *value) {
  (void)value;
  return (uint64_t)*value;
}
static inline int lb_copy_5_out(uint64_t value, uint64_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint64_t)value;
  return 1;
}

static inline int lb_copy_6_check(const int8_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint8_t lb_copy_6_in(const int8_t *value) {
  (void)value;
  return (uint8_t)*value;
}
static inline int lb_copy_6_out(uint8_t value, int8_t *out, size_t *budget) {
  (void)value; (void)budget;
  memcpy(out, &value, sizeof(value));
  return 1;
}

static inline int lb_copy_7_check(const int16_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint16_t lb_copy_7_in(const int16_t *value) {
  (void)value;
  return (uint16_t)*value;
}
static inline int lb_copy_7_out(uint16_t value, int16_t *out, size_t *budget) {
  (void)value; (void)budget;
  memcpy(out, &value, sizeof(value));
  return 1;
}

static inline int lb_copy_8_check(const int32_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint32_t lb_copy_8_in(const int32_t *value) {
  (void)value;
  return (uint32_t)*value;
}
static inline int lb_copy_8_out(uint32_t value, int32_t *out, size_t *budget) {
  (void)value; (void)budget;
  memcpy(out, &value, sizeof(value));
  return 1;
}

static inline int lb_copy_9_check(const int64_t *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint64_t lb_copy_9_in(const int64_t *value) {
  (void)value;
  return (uint64_t)*value;
}
static inline int lb_copy_9_out(uint64_t value, int64_t *out, size_t *budget) {
  (void)value; (void)budget;
  memcpy(out, &value, sizeof(value));
  return 1;
}

static inline int lb_copy_10_check(const nominalprimitivesubtypes_nat *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_10_in(const nominalprimitivesubtypes_nat *value) {
  (void)value;
  return lb_nat_in(value->data, value->length);
}
static inline int lb_copy_10_out(lean_object * value, nominalprimitivesubtypes_nat *out, size_t *budget) {
  (void)value; (void)budget;
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(value, &data, &length, *budget);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (nominalprimitivesubtypes_nat){data, length, data, free};
  return 1;
}

static inline int lb_copy_11_check(const nominalprimitivesubtypes_int *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_11_in(const nominalprimitivesubtypes_int *value) {
  (void)value;
  return lb_int_in(value->data, value->length, value->negative);
}
static inline int lb_copy_11_out(lean_object * value, nominalprimitivesubtypes_int *out, size_t *budget) {
  (void)value; (void)budget;
  bool negative = lean_int_lt(value, lean_box(0));
  lean_object *magnitude = lean_nat_abs(value);
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(magnitude, &data, &length, *budget);
  lean_dec(magnitude);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (nominalprimitivesubtypes_int){data, length, data, free, negative};
  return 1;
}

static inline int lb_copy_12_check(const float *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline float lb_copy_12_in(const float *value) {
  (void)value;
  return (float)*value;
}
static inline int lb_copy_12_out(float value, float *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (float)value;
  return 1;
}

static inline int lb_copy_13_check(const double *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline double lb_copy_13_in(const double *value) {
  (void)value;
  return (double)*value;
}
static inline int lb_copy_13_out(double value, double *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (double)value;
  return 1;
}

static inline int lb_copy_14_check(const nominalprimitivesubtypes_string *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, 1)) return 0;
  if (!lb_utf8((const uint8_t *)value->data, value->length)) return 0;
  return 1;
}
static inline lean_object * lb_copy_14_in(const nominalprimitivesubtypes_string *value) {
  (void)value;
  return lean_mk_string_from_bytes(value->length ? value->data : "", value->length);
}
static inline int lb_copy_14_out(lean_object * value, nominalprimitivesubtypes_string *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_string_size(value) - 1;
  if (!lb_charge(budget, length, 1)) return 0;
  void *data = length ? malloc(length) : NULL;
  if (length && !data) return -1;
  if (length) memcpy(data, lean_string_cstr(value), length);
  *out = (nominalprimitivesubtypes_string){data, length, data, free};
  return 1;
}

static inline int lb_copy_15_check(const nominalprimitivesubtypes_bytes *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, 1)) return 0;
  return 1;
}
static inline lean_object * lb_copy_15_in(const nominalprimitivesubtypes_bytes *value) {
  (void)value;
  return lb_bytes_in(value->data, value->length);
}
static inline int lb_copy_15_out(lean_object * value, nominalprimitivesubtypes_bytes *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_sarray_size(value);
  if (!lb_charge(budget, length, 1)) return 0;
  void *data = length ? malloc(length) : NULL;
  if (length && !data) return -1;
  if (length) memcpy(data, lean_sarray_cptr(value), length);
  *out = (nominalprimitivesubtypes_bytes){data, length, data, free};
  return 1;
}

static inline int lb_copy_16_check(const uint32_t *value, size_t *budget) {
  (void)value; (void)budget;
  if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return 0;
  return 1;
}
static inline uint32_t lb_copy_16_in(const uint32_t *value) {
  (void)value;
  return (uint32_t)*value;
}
static inline int lb_copy_16_out(uint32_t value, uint32_t *out, size_t *budget) {
  (void)value; (void)budget;
  if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return -2;
  *out = value;
  return 1;
}

static inline int lb_copy_17_check(const uint64_t *value, size_t *budget) {
  (void)value; (void)budget;
  if (*value > UINT32_MAX) return 0;
  return 1;
}
static inline size_t lb_copy_17_in(const uint64_t *value) {
  (void)value;
  return (size_t)*value;
}
static inline int lb_copy_17_out(size_t value, uint64_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint64_t)value;
  return 1;
}

static inline int lb_copy_18_check(const int64_t *value, size_t *budget) {
  (void)value; (void)budget;
  if (*value < INT32_MIN || *value > INT32_MAX) return 0;
  return 1;
}
static inline size_t lb_copy_18_in(const int64_t *value) {
  (void)value;
  return (size_t)*value;
}
static inline int lb_copy_18_out(size_t value, int64_t *out, size_t *budget) {
  (void)value; (void)budget;
  int32_t signed_value; memcpy(&signed_value, &value, sizeof(value));
  *out = signed_value;
  return 1;
}

static inline int lb_copy_19_check(const nominalprimitivesubtypes_packet *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_packet))) return 0;
  if (1 && !lb_copy_0_check(&value->unit_value, budget)) return 0;
  if (1 && !lb_copy_1_check(&value->bool_value, budget)) return 0;
  if (1 && !lb_copy_2_check(&value->uint8_value, budget)) return 0;
  if (1 && !lb_copy_3_check(&value->uint16_value, budget)) return 0;
  if (1 && !lb_copy_4_check(&value->uint32_value, budget)) return 0;
  if (1 && !lb_copy_5_check(&value->uint64_value, budget)) return 0;
  if (1 && !lb_copy_6_check(&value->int8_value, budget)) return 0;
  if (1 && !lb_copy_7_check(&value->int16_value, budget)) return 0;
  if (1 && !lb_copy_8_check(&value->int32_value, budget)) return 0;
  if (1 && !lb_copy_9_check(&value->int64_value, budget)) return 0;
  if (1 && !lb_copy_10_check(&value->nat_value, budget)) return 0;
  if (1 && !lb_copy_11_check(&value->int_value, budget)) return 0;
  if (1 && !lb_copy_12_check(&value->float32_value, budget)) return 0;
  if (1 && !lb_copy_13_check(&value->float64_value, budget)) return 0;
  if (1 && !lb_copy_14_check(&value->text_value, budget)) return 0;
  if (1 && !lb_copy_15_check(&value->bytes_value, budget)) return 0;
  if (1 && !lb_copy_16_check(&value->char_value, budget)) return 0;
  if (1 && !lb_copy_17_check(&value->usize_value, budget)) return 0;
  if (1 && !lb_copy_18_check(&value->isize_value, budget)) return 0;
  if (1 && !lb_copy_10_check(&value->digit, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_19_in(const nominalprimitivesubtypes_packet *value) {
  (void)value;
  return lb_t980449f277836feadaee_make(lb_copy_0_in(&value->unit_value), lb_copy_1_in(&value->bool_value), lb_copy_2_in(&value->uint8_value), lb_copy_3_in(&value->uint16_value), lb_copy_4_in(&value->uint32_value), lb_copy_5_in(&value->uint64_value), lb_copy_6_in(&value->int8_value), lb_copy_7_in(&value->int16_value), lb_copy_8_in(&value->int32_value), lb_copy_9_in(&value->int64_value), lb_copy_10_in(&value->nat_value), lb_copy_11_in(&value->int_value), lb_copy_12_in(&value->float32_value), lb_copy_13_in(&value->float64_value), lb_copy_14_in(&value->text_value), lb_copy_15_in(&value->bytes_value), lb_copy_16_in(&value->char_value), lb_copy_17_in(&value->usize_value), lb_copy_18_in(&value->isize_value), lb_copy_10_in(&value->digit));
}
static inline int lb_copy_19_out(lean_object * value, nominalprimitivesubtypes_packet *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_packet))) return 0;
  *out = (nominalprimitivesubtypes_packet){0};
  lean_inc(value);
  lean_object * field0 = lb_t980449f277836feadaee_get0(value);
  int status0 = lb_copy_0_out(field0, &out->unit_value, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_packet_clear(out); return status0; }
  lean_inc(value);
  uint8_t field1 = lb_t980449f277836feadaee_get1(value);
  int status1 = lb_copy_1_out(field1, &out->bool_value, budget);
  if (status1 != 1) { nominalprimitivesubtypes_packet_clear(out); return status1; }
  lean_inc(value);
  uint8_t field2 = lb_t980449f277836feadaee_get2(value);
  int status2 = lb_copy_2_out(field2, &out->uint8_value, budget);
  if (status2 != 1) { nominalprimitivesubtypes_packet_clear(out); return status2; }
  lean_inc(value);
  uint16_t field3 = lb_t980449f277836feadaee_get3(value);
  int status3 = lb_copy_3_out(field3, &out->uint16_value, budget);
  if (status3 != 1) { nominalprimitivesubtypes_packet_clear(out); return status3; }
  lean_inc(value);
  uint32_t field4 = lb_t980449f277836feadaee_get4(value);
  int status4 = lb_copy_4_out(field4, &out->uint32_value, budget);
  if (status4 != 1) { nominalprimitivesubtypes_packet_clear(out); return status4; }
  lean_inc(value);
  uint64_t field5 = lb_t980449f277836feadaee_get5(value);
  int status5 = lb_copy_5_out(field5, &out->uint64_value, budget);
  if (status5 != 1) { nominalprimitivesubtypes_packet_clear(out); return status5; }
  lean_inc(value);
  uint8_t field6 = lb_t980449f277836feadaee_get6(value);
  int status6 = lb_copy_6_out(field6, &out->int8_value, budget);
  if (status6 != 1) { nominalprimitivesubtypes_packet_clear(out); return status6; }
  lean_inc(value);
  uint16_t field7 = lb_t980449f277836feadaee_get7(value);
  int status7 = lb_copy_7_out(field7, &out->int16_value, budget);
  if (status7 != 1) { nominalprimitivesubtypes_packet_clear(out); return status7; }
  lean_inc(value);
  uint32_t field8 = lb_t980449f277836feadaee_get8(value);
  int status8 = lb_copy_8_out(field8, &out->int32_value, budget);
  if (status8 != 1) { nominalprimitivesubtypes_packet_clear(out); return status8; }
  lean_inc(value);
  uint64_t field9 = lb_t980449f277836feadaee_get9(value);
  int status9 = lb_copy_9_out(field9, &out->int64_value, budget);
  if (status9 != 1) { nominalprimitivesubtypes_packet_clear(out); return status9; }
  lean_inc(value);
  lean_object * field10 = lb_t980449f277836feadaee_get10(value);
  int status10 = lb_copy_10_out(field10, &out->nat_value, budget);
  lean_dec(field10);
  if (status10 != 1) { nominalprimitivesubtypes_packet_clear(out); return status10; }
  lean_inc(value);
  lean_object * field11 = lb_t980449f277836feadaee_get11(value);
  int status11 = lb_copy_11_out(field11, &out->int_value, budget);
  lean_dec(field11);
  if (status11 != 1) { nominalprimitivesubtypes_packet_clear(out); return status11; }
  lean_inc(value);
  float field12 = lb_t980449f277836feadaee_get12(value);
  int status12 = lb_copy_12_out(field12, &out->float32_value, budget);
  if (status12 != 1) { nominalprimitivesubtypes_packet_clear(out); return status12; }
  lean_inc(value);
  double field13 = lb_t980449f277836feadaee_get13(value);
  int status13 = lb_copy_13_out(field13, &out->float64_value, budget);
  if (status13 != 1) { nominalprimitivesubtypes_packet_clear(out); return status13; }
  lean_inc(value);
  lean_object * field14 = lb_t980449f277836feadaee_get14(value);
  int status14 = lb_copy_14_out(field14, &out->text_value, budget);
  lean_dec(field14);
  if (status14 != 1) { nominalprimitivesubtypes_packet_clear(out); return status14; }
  lean_inc(value);
  lean_object * field15 = lb_t980449f277836feadaee_get15(value);
  int status15 = lb_copy_15_out(field15, &out->bytes_value, budget);
  lean_dec(field15);
  if (status15 != 1) { nominalprimitivesubtypes_packet_clear(out); return status15; }
  lean_inc(value);
  uint32_t field16 = lb_t980449f277836feadaee_get16(value);
  int status16 = lb_copy_16_out(field16, &out->char_value, budget);
  if (status16 != 1) { nominalprimitivesubtypes_packet_clear(out); return status16; }
  lean_inc(value);
  size_t field17 = lb_t980449f277836feadaee_get17(value);
  int status17 = lb_copy_17_out(field17, &out->usize_value, budget);
  if (status17 != 1) { nominalprimitivesubtypes_packet_clear(out); return status17; }
  lean_inc(value);
  size_t field18 = lb_t980449f277836feadaee_get18(value);
  int status18 = lb_copy_18_out(field18, &out->isize_value, budget);
  if (status18 != 1) { nominalprimitivesubtypes_packet_clear(out); return status18; }
  lean_inc(value);
  lean_object * field19 = lb_t980449f277836feadaee_get19(value);
  int status19 = lb_copy_10_out(field19, &out->digit, budget);
  lean_dec(field19);
  if (status19 != 1) { nominalprimitivesubtypes_packet_clear(out); return status19; }
  return 1;
}

static inline int lb_copy_20_check(const nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value))) return 0;
  if (value->has_value > 1) return 0;
  if (value->has_value && !lb_copy_19_check(&value->value, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_20_in(const nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value) {
  (void)value;
  return value->has_value ? lb_td552bec1d6b17ed5222c_some(lb_copy_19_in(&value->value)) : lb_td552bec1d6b17ed5222c_none(lean_box(0));
}
static inline int lb_copy_20_out(lean_object * value, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value))) return 0;
  *out = (nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value){0};
  lean_inc(value);
  out->has_value = lb_td552bec1d6b17ed5222c_has(value);
  if (out->has_value) {
  lean_inc(value);
  lean_object * field0 = lb_td552bec1d6b17ed5222c_get0(value);
  int status0 = lb_copy_19_out(field0, &out->value, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(out); return status0; }
  }
  return 1;
}

typedef struct { size_t length; nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value data[]; } lb_copy_21_owner;
static void lb_copy_21_release(void *raw) {
  lb_copy_21_owner *owner = raw;
  for (size_t i = 0; i < owner->length; ++i) nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(&owner->data[i]);
  free(owner);
}
static inline int lb_copy_21_check(const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, ((sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value) > sizeof(void *)) ? sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value) : sizeof(void *)))) return 0;
  for (size_t i = 0; i < value->length; ++i) if (!lb_copy_20_check(&value->data[i], budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_21_in(const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value) {
  (void)value;
  lean_object *result = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, lb_copy_20_in(&value->data[i]));
  return result;
}
static inline int lb_copy_21_out(lean_object * value, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_array_size(value);
  if (!lb_charge(budget, length, ((sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value) > sizeof(void *)) ? sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value) : sizeof(void *))) || !lb_charge(budget, 1, sizeof(lb_copy_21_owner))) { return 0; }
  if (!length) { *out = (nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span){0}; return 1; }
  lb_copy_21_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value));
  if (!owner) { return -1; }
  owner->length = length;
  for (size_t i = 0; i < length; ++i) {
    int status = lb_copy_20_out(lean_array_get_core(value, i), &owner->data[i], budget);
    if (status != 1) { lb_copy_21_release(owner); return status; }
  }
  *out = (nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span){owner->data, length, owner, lb_copy_21_release};
  return 1;
}

static inline int lb_copy_22_check(const nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  if (1 && !lb_copy_19_check(&value->fst, budget)) return 0;
  if (1 && !lb_copy_19_check(&value->snd, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_22_in(const nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  (void)value;
  return lb_t493235f6d5e0c330066f_make(lb_copy_19_in(&value->fst), lb_copy_19_in(&value->snd));
}
static inline int lb_copy_22_out(lean_object * value, nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  *out = (nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value){0};
  lean_inc(value);
  lean_object * field0 = lb_t493235f6d5e0c330066f_get0(value);
  int status0 = lb_copy_19_out(field0, &out->fst, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(out); return status0; }
  lean_inc(value);
  lean_object * field1 = lb_t493235f6d5e0c330066f_get1(value);
  int status1 = lb_copy_19_out(field1, &out->snd, budget);
  lean_dec(field1);
  if (status1 != 1) { nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(out); return status1; }
  return 1;
}

static inline int lb_copy_23_check(const nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  if (value->is_ok > 1) return 0;
  if (value->is_ok && !lb_copy_19_check(&value->ok, budget)) return 0;
  if (!value->is_ok && !lb_copy_19_check(&value->error, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_23_in(const nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  (void)value;
  return value->is_ok ? lb_td367e4fc052df6d1c32d_ok(lb_copy_19_in(&value->ok)) : lb_td367e4fc052df6d1c32d_error(lb_copy_19_in(&value->error));
}
static inline int lb_copy_23_out(lean_object * value, nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  *out = (nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value){0};
  lean_inc(value);
  out->is_ok = lb_td367e4fc052df6d1c32d_has(value);
  if (out->is_ok) {
  lean_inc(value);
  lean_object * field0 = lb_td367e4fc052df6d1c32d_get0(value);
  int status0 = lb_copy_19_out(field0, &out->ok, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(out); return status0; }
  }
  if (!out->is_ok) {
  lean_inc(value);
  lean_object * field1 = lb_td367e4fc052df6d1c32d_get1(value);
  int status1 = lb_copy_19_out(field1, &out->error, budget);
  lean_dec(field1);
  if (status1 != 1) { nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(out); return status1; }
  }
  return 1;
}

static inline int lb_copy_24_check(const nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  if (value->has_value > 1) return 0;
  if (value->has_value && !lb_copy_23_check(&value->value, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_24_in(const nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value) {
  (void)value;
  return value->has_value ? lb_t5a1383905e3435e418a9_some(lb_copy_23_in(&value->value)) : lb_t5a1383905e3435e418a9_none(lean_box(0));
}
static inline int lb_copy_24_out(lean_object * value, nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return 0;
  *out = (nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value){0};
  lean_inc(value);
  out->has_value = lb_t5a1383905e3435e418a9_has(value);
  if (out->has_value) {
  lean_inc(value);
  lean_object * field0 = lb_t5a1383905e3435e418a9_get0(value);
  int status0 = lb_copy_23_out(field0, &out->value, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(out); return status0; }
  }
  return 1;
}

typedef struct { size_t length; nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value data[]; } lb_copy_25_owner;
static void lb_copy_25_release(void *raw) {
  lb_copy_25_owner *owner = raw;
  for (size_t i = 0; i < owner->length; ++i) nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(&owner->data[i]);
  free(owner);
}
static inline int lb_copy_25_check(const nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, ((sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value) > sizeof(void *)) ? sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value) : sizeof(void *)))) return 0;
  for (size_t i = 0; i < value->length; ++i) if (!lb_copy_24_check(&value->data[i], budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_25_in(const nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value) {
  (void)value;
  lean_object *result = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, lb_copy_24_in(&value->data[i]));
  return result;
}
static inline int lb_copy_25_out(lean_object * value, nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_array_size(value);
  if (!lb_charge(budget, length, ((sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value) > sizeof(void *)) ? sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value) : sizeof(void *))) || !lb_charge(budget, 1, sizeof(lb_copy_25_owner))) { return 0; }
  if (!length) { *out = (nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span){0}; return 1; }
  lb_copy_25_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value));
  if (!owner) { return -1; }
  owner->length = length;
  for (size_t i = 0; i < length; ++i) {
    int status = lb_copy_24_out(lean_array_get_core(value, i), &owner->data[i], budget);
    if (status != 1) { lb_copy_25_release(owner); return status; }
  }
  *out = (nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span){owner->data, length, owner, lb_copy_25_release};
  return 1;
}

static inline int lb_copy_26_check(const nominalprimitivesubtypes_event *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_event))) return 0;
  switch (value->kind) {
  case 0:
    break;
  case 1:
    if (!lb_copy_19_check(&value->cases.box.value, budget)) return 0;
    break;
  case 2:
    if (!lb_copy_25_check(&value->cases.choices.values, budget)) return 0;
    break;
  default: return 0;
  }
  return 1;
}
static inline lean_object * lb_copy_26_in(const nominalprimitivesubtypes_event *value) {
  (void)value;
  switch (value->kind) {
  case 0:
    return lb_t466ade0f8f5195fb9b51_make0(lean_box(0));
  case 1:
    return lb_t466ade0f8f5195fb9b51_make1(lb_copy_19_in(&value->cases.box.value));
  case 2:
    return lb_t466ade0f8f5195fb9b51_make2(lb_copy_25_in(&value->cases.choices.values));
  default: abort();
  }
}
static inline int lb_copy_26_out(lean_object * value, nominalprimitivesubtypes_event *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_event))) return 0;
  lean_inc(value);
  uint32_t kind = lb_t466ade0f8f5195fb9b51_tag(value);
  if (kind >= 3) return -3;
  *out = (nominalprimitivesubtypes_event){0};
  out->kind = kind;
  switch (kind) {
  case 0: {
    break;
  }
  case 1: {
    lean_inc(value);
    lean_object * field0 = lb_t466ade0f8f5195fb9b51_get1_0(value);
    int status0 = lb_copy_19_out(field0, &out->cases.box.value, budget);
    lean_dec(field0);
    if (status0 != 1) { nominalprimitivesubtypes_event_clear(out); return status0; }
    break;
  }
  case 2: {
    lean_inc(value);
    lean_object * field0 = lb_t466ade0f8f5195fb9b51_get2_0(value);
    int status0 = lb_copy_25_out(field0, &out->cases.choices.values, budget);
    lean_dec(field0);
    if (status0 != 1) { nominalprimitivesubtypes_event_clear(out); return status0; }
    break;
  }
  default: return -3;
  }
  return 1;
}

static inline int lb_copy_27_check(const nominalprimitivesubtypes_pair *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_pair))) return 0;
  if (1 && !lb_copy_21_check(&value->left, budget)) return 0;
  if (1 && !lb_copy_21_check(&value->right, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_27_in(const nominalprimitivesubtypes_pair *value) {
  (void)value;
  return lb_tbb4f1df77db4bc2e5592_make(lb_copy_21_in(&value->left), lb_copy_21_in(&value->right));
}
static inline int lb_copy_27_out(lean_object * value, nominalprimitivesubtypes_pair *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_pair))) return 0;
  *out = (nominalprimitivesubtypes_pair){0};
  lean_inc(value);
  lean_object * field0 = lb_tbb4f1df77db4bc2e5592_get0(value);
  int status0 = lb_copy_21_out(field0, &out->left, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_pair_clear(out); return status0; }
  lean_inc(value);
  lean_object * field1 = lb_tbb4f1df77db4bc2e5592_get1(value);
  int status1 = lb_copy_21_out(field1, &out->right, budget);
  lean_dec(field1);
  if (status1 != 1) { nominalprimitivesubtypes_pair_clear(out); return status1; }
  return 1;
}

static inline int lb_copy_28_check(const nominalprimitivesubtypes_raw_packet *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_raw_packet))) return 0;
  if (1 && !lb_copy_0_check(&value->unit_value, budget)) return 0;
  if (1 && !lb_copy_1_check(&value->bool_value, budget)) return 0;
  if (1 && !lb_copy_2_check(&value->uint8_value, budget)) return 0;
  if (1 && !lb_copy_3_check(&value->uint16_value, budget)) return 0;
  if (1 && !lb_copy_4_check(&value->uint32_value, budget)) return 0;
  if (1 && !lb_copy_5_check(&value->uint64_value, budget)) return 0;
  if (1 && !lb_copy_6_check(&value->int8_value, budget)) return 0;
  if (1 && !lb_copy_7_check(&value->int16_value, budget)) return 0;
  if (1 && !lb_copy_8_check(&value->int32_value, budget)) return 0;
  if (1 && !lb_copy_9_check(&value->int64_value, budget)) return 0;
  if (1 && !lb_copy_10_check(&value->nat_value, budget)) return 0;
  if (1 && !lb_copy_11_check(&value->int_value, budget)) return 0;
  if (1 && !lb_copy_12_check(&value->float32_value, budget)) return 0;
  if (1 && !lb_copy_13_check(&value->float64_value, budget)) return 0;
  if (1 && !lb_copy_14_check(&value->text_value, budget)) return 0;
  if (1 && !lb_copy_15_check(&value->bytes_value, budget)) return 0;
  if (1 && !lb_copy_16_check(&value->char_value, budget)) return 0;
  if (1 && !lb_copy_17_check(&value->usize_value, budget)) return 0;
  if (1 && !lb_copy_18_check(&value->isize_value, budget)) return 0;
  if (1 && !lb_copy_10_check(&value->digit, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_28_in(const nominalprimitivesubtypes_raw_packet *value) {
  (void)value;
  return lb_t6ed79f4a8a3bc4358259_make(lb_copy_0_in(&value->unit_value), lb_copy_1_in(&value->bool_value), lb_copy_2_in(&value->uint8_value), lb_copy_3_in(&value->uint16_value), lb_copy_4_in(&value->uint32_value), lb_copy_5_in(&value->uint64_value), lb_copy_6_in(&value->int8_value), lb_copy_7_in(&value->int16_value), lb_copy_8_in(&value->int32_value), lb_copy_9_in(&value->int64_value), lb_copy_10_in(&value->nat_value), lb_copy_11_in(&value->int_value), lb_copy_12_in(&value->float32_value), lb_copy_13_in(&value->float64_value), lb_copy_14_in(&value->text_value), lb_copy_15_in(&value->bytes_value), lb_copy_16_in(&value->char_value), lb_copy_17_in(&value->usize_value), lb_copy_18_in(&value->isize_value), lb_copy_10_in(&value->digit));
}
static inline int lb_copy_28_out(lean_object * value, nominalprimitivesubtypes_raw_packet *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(nominalprimitivesubtypes_raw_packet))) return 0;
  *out = (nominalprimitivesubtypes_raw_packet){0};
  lean_inc(value);
  lean_object * field0 = lb_t6ed79f4a8a3bc4358259_get0(value);
  int status0 = lb_copy_0_out(field0, &out->unit_value, budget);
  lean_dec(field0);
  if (status0 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status0; }
  lean_inc(value);
  uint8_t field1 = lb_t6ed79f4a8a3bc4358259_get1(value);
  int status1 = lb_copy_1_out(field1, &out->bool_value, budget);
  if (status1 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status1; }
  lean_inc(value);
  uint8_t field2 = lb_t6ed79f4a8a3bc4358259_get2(value);
  int status2 = lb_copy_2_out(field2, &out->uint8_value, budget);
  if (status2 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status2; }
  lean_inc(value);
  uint16_t field3 = lb_t6ed79f4a8a3bc4358259_get3(value);
  int status3 = lb_copy_3_out(field3, &out->uint16_value, budget);
  if (status3 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status3; }
  lean_inc(value);
  uint32_t field4 = lb_t6ed79f4a8a3bc4358259_get4(value);
  int status4 = lb_copy_4_out(field4, &out->uint32_value, budget);
  if (status4 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status4; }
  lean_inc(value);
  uint64_t field5 = lb_t6ed79f4a8a3bc4358259_get5(value);
  int status5 = lb_copy_5_out(field5, &out->uint64_value, budget);
  if (status5 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status5; }
  lean_inc(value);
  uint8_t field6 = lb_t6ed79f4a8a3bc4358259_get6(value);
  int status6 = lb_copy_6_out(field6, &out->int8_value, budget);
  if (status6 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status6; }
  lean_inc(value);
  uint16_t field7 = lb_t6ed79f4a8a3bc4358259_get7(value);
  int status7 = lb_copy_7_out(field7, &out->int16_value, budget);
  if (status7 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status7; }
  lean_inc(value);
  uint32_t field8 = lb_t6ed79f4a8a3bc4358259_get8(value);
  int status8 = lb_copy_8_out(field8, &out->int32_value, budget);
  if (status8 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status8; }
  lean_inc(value);
  uint64_t field9 = lb_t6ed79f4a8a3bc4358259_get9(value);
  int status9 = lb_copy_9_out(field9, &out->int64_value, budget);
  if (status9 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status9; }
  lean_inc(value);
  lean_object * field10 = lb_t6ed79f4a8a3bc4358259_get10(value);
  int status10 = lb_copy_10_out(field10, &out->nat_value, budget);
  lean_dec(field10);
  if (status10 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status10; }
  lean_inc(value);
  lean_object * field11 = lb_t6ed79f4a8a3bc4358259_get11(value);
  int status11 = lb_copy_11_out(field11, &out->int_value, budget);
  lean_dec(field11);
  if (status11 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status11; }
  lean_inc(value);
  float field12 = lb_t6ed79f4a8a3bc4358259_get12(value);
  int status12 = lb_copy_12_out(field12, &out->float32_value, budget);
  if (status12 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status12; }
  lean_inc(value);
  double field13 = lb_t6ed79f4a8a3bc4358259_get13(value);
  int status13 = lb_copy_13_out(field13, &out->float64_value, budget);
  if (status13 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status13; }
  lean_inc(value);
  lean_object * field14 = lb_t6ed79f4a8a3bc4358259_get14(value);
  int status14 = lb_copy_14_out(field14, &out->text_value, budget);
  lean_dec(field14);
  if (status14 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status14; }
  lean_inc(value);
  lean_object * field15 = lb_t6ed79f4a8a3bc4358259_get15(value);
  int status15 = lb_copy_15_out(field15, &out->bytes_value, budget);
  lean_dec(field15);
  if (status15 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status15; }
  lean_inc(value);
  uint32_t field16 = lb_t6ed79f4a8a3bc4358259_get16(value);
  int status16 = lb_copy_16_out(field16, &out->char_value, budget);
  if (status16 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status16; }
  lean_inc(value);
  size_t field17 = lb_t6ed79f4a8a3bc4358259_get17(value);
  int status17 = lb_copy_17_out(field17, &out->usize_value, budget);
  if (status17 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status17; }
  lean_inc(value);
  size_t field18 = lb_t6ed79f4a8a3bc4358259_get18(value);
  int status18 = lb_copy_18_out(field18, &out->isize_value, budget);
  if (status18 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status18; }
  lean_inc(value);
  lean_object * field19 = lb_t6ed79f4a8a3bc4358259_get19(value);
  int status19 = lb_copy_10_out(field19, &out->digit, budget);
  lean_dec(field19);
  if (status19 != 1) { nominalprimitivesubtypes_raw_packet_clear(out); return status19; }
  return 1;
}

static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}
static const uint32_t lb_fin_aliases_0_0[1] = {0x3u};
static const uint32_t lb_fin_aliases_1_0[1] = {0x3u};
static const uint32_t lb_fin_combine_0_0[1] = {0x3u};
static const uint32_t lb_fin_combine_1_0[1] = {0x3u};
static const uint32_t lb_fin_echo_a_0_0[1] = {0x3u};
static const uint32_t lb_fin_echo_b_0_0[1] = {0x3u};
static const uint32_t lb_fin_echo_event_a_0_0[1] = {0x3u};
static const uint32_t lb_fin_echo_event_a_0_1[1] = {0x3u};
static const uint32_t lb_fin_echo_event_a_0_2[1] = {0x3u};
static const uint32_t lb_fin_echo_event_b_0_0[1] = {0x3u};
static const uint32_t lb_fin_echo_event_b_0_1[1] = {0x3u};
static const uint32_t lb_fin_echo_event_b_0_2[1] = {0x3u};
static const uint32_t lb_fin_echo_pair_0_0[1] = {0x3u};
static const uint32_t lb_fin_echo_pair_0_1[1] = {0x3u};
static const uint32_t lb_fin_refuse_unit_0_0[1] = {0x3u};

static nominalprimitivesubtypes_status lb_call_aliases(void *context, const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value0, const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value1, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_21_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_copy_21_check(value1, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  for (size_t k2 = 0; k2 < value0->length; ++k2) {
    if ((&value0->data[k2])->has_value) {
      if (!lb_fin_below((&(&(&value0->data[k2])->value)->digit)->data, (&(&(&value0->data[k2])->value)->digit)->length, lb_fin_aliases_0_0, 1)) {
        static _Thread_local char lb_fin_aliases_0_0_message[sizeof("value0[%zu]?.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fin_aliases_0_0_message, sizeof(lb_fin_aliases_0_0_message), "value0[%zu]?.digit is not below its Fin 3 bound", k2);
        return lb_invalid(error, lb_fin_aliases_0_0_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < value1->length; ++k2) {
    if ((&value1->data[k2])->has_value) {
      if (!lb_fin_below((&(&(&value1->data[k2])->value)->digit)->data, (&(&(&value1->data[k2])->value)->digit)->length, lb_fin_aliases_1_0, 1)) {
        static _Thread_local char lb_fin_aliases_1_0_message[sizeof("value1[%zu]?.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fin_aliases_1_0_message, sizeof(lb_fin_aliases_1_0_message), "value1[%zu]?.digit is not below its Fin 3 bound", k2);
        return lb_invalid(error, lb_fin_aliases_1_0_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < value0->length; ++k2) {
    if ((&value0->data[k2])->has_value) {
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0(lb_copy_0_in((&(&(&value0->data[k2])->value)->unit_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0_message[sizeof("value0[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0_message), "value0[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_0_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1(lb_copy_1_in((&(&(&value0->data[k2])->value)->bool_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1_message[sizeof("value0[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1_message), "value0[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_1_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2(lb_copy_2_in((&(&(&value0->data[k2])->value)->uint8_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2_message[sizeof("value0[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2_message), "value0[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_2_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3(lb_copy_3_in((&(&(&value0->data[k2])->value)->uint16_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3_message[sizeof("value0[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3_message), "value0[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_3_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4(lb_copy_4_in((&(&(&value0->data[k2])->value)->uint32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4_message[sizeof("value0[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4_message), "value0[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_4_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5(lb_copy_5_in((&(&(&value0->data[k2])->value)->uint64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5_message[sizeof("value0[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5_message), "value0[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_5_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6(lb_copy_6_in((&(&(&value0->data[k2])->value)->int8_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6_message[sizeof("value0[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6_message), "value0[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_6_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7(lb_copy_7_in((&(&(&value0->data[k2])->value)->int16_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7_message[sizeof("value0[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7_message), "value0[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_7_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8(lb_copy_8_in((&(&(&value0->data[k2])->value)->int32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8_message[sizeof("value0[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8_message), "value0[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_8_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9(lb_copy_9_in((&(&(&value0->data[k2])->value)->int64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9_message[sizeof("value0[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9_message), "value0[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_9_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10(lb_copy_10_in((&(&(&value0->data[k2])->value)->nat_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10_message[sizeof("value0[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10_message), "value0[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_10_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11(lb_copy_11_in((&(&(&value0->data[k2])->value)->int_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11_message[sizeof("value0[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11_message), "value0[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_11_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12(lb_copy_12_in((&(&(&value0->data[k2])->value)->float32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12_message[sizeof("value0[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12_message), "value0[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_12_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13(lb_copy_13_in((&(&(&value0->data[k2])->value)->float64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13_message[sizeof("value0[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13_message), "value0[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_13_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14(lb_copy_14_in((&(&(&value0->data[k2])->value)->text_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14_message[sizeof("value0[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14_message), "value0[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_14_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15(lb_copy_15_in((&(&(&value0->data[k2])->value)->bytes_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15_message[sizeof("value0[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15_message), "value0[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_15_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16(lb_copy_16_in((&(&(&value0->data[k2])->value)->char_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16_message[sizeof("value0[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16_message), "value0[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_16_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17(lb_copy_17_in((&(&(&value0->data[k2])->value)->usize_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17_message[sizeof("value0[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17_message), "value0[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_17_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18(lb_copy_18_in((&(&(&value0->data[k2])->value)->isize_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18_message[sizeof("value0[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18_message), "value0[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_0_0_0_18_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < value1->length; ++k2) {
    if ((&value1->data[k2])->has_value) {
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0(lb_copy_0_in((&(&(&value1->data[k2])->value)->unit_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0_message[sizeof("value1[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0_message), "value1[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_0_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1(lb_copy_1_in((&(&(&value1->data[k2])->value)->bool_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1_message[sizeof("value1[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1_message), "value1[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_1_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2(lb_copy_2_in((&(&(&value1->data[k2])->value)->uint8_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2_message[sizeof("value1[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2_message), "value1[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_2_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3(lb_copy_3_in((&(&(&value1->data[k2])->value)->uint16_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3_message[sizeof("value1[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3_message), "value1[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_3_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4(lb_copy_4_in((&(&(&value1->data[k2])->value)->uint32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4_message[sizeof("value1[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4_message), "value1[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_4_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5(lb_copy_5_in((&(&(&value1->data[k2])->value)->uint64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5_message[sizeof("value1[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5_message), "value1[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_5_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6(lb_copy_6_in((&(&(&value1->data[k2])->value)->int8_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6_message[sizeof("value1[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6_message), "value1[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_6_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7(lb_copy_7_in((&(&(&value1->data[k2])->value)->int16_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7_message[sizeof("value1[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7_message), "value1[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_7_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8(lb_copy_8_in((&(&(&value1->data[k2])->value)->int32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8_message[sizeof("value1[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8_message), "value1[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_8_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9(lb_copy_9_in((&(&(&value1->data[k2])->value)->int64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9_message[sizeof("value1[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9_message), "value1[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_9_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10(lb_copy_10_in((&(&(&value1->data[k2])->value)->nat_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10_message[sizeof("value1[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10_message), "value1[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_10_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11(lb_copy_11_in((&(&(&value1->data[k2])->value)->int_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11_message[sizeof("value1[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11_message), "value1[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_11_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12(lb_copy_12_in((&(&(&value1->data[k2])->value)->float32_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12_message[sizeof("value1[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12_message), "value1[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_12_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13(lb_copy_13_in((&(&(&value1->data[k2])->value)->float64_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13_message[sizeof("value1[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13_message), "value1[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_13_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14(lb_copy_14_in((&(&(&value1->data[k2])->value)->text_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14_message[sizeof("value1[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14_message), "value1[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_14_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15(lb_copy_15_in((&(&(&value1->data[k2])->value)->bytes_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15_message[sizeof("value1[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15_message), "value1[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_15_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16(lb_copy_16_in((&(&(&value1->data[k2])->value)->char_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16_message[sizeof("value1[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16_message), "value1[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_16_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17(lb_copy_17_in((&(&(&value1->data[k2])->value)->usize_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17_message[sizeof("value1[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17_message), "value1[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_17_message);
      }
      if (!lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18(lb_copy_18_in((&(&(&value1->data[k2])->value)->isize_value)))) {
        static _Thread_local char lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18_message[sizeof("value1[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18_message, sizeof(lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18_message), "value1[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", k2);
        return lb_invalid(error, lb_ad1aedc6e1a2dda5a7c9a643_refinement_1_0_0_18_message);
      }
    }
  }
  lean_object *checked = lb_ad1aedc6e1a2dda5a7c9a643(lb_copy_21_in(value0), lb_copy_21_in(value1));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span result = {0};
  int status = lb_copy_21_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_combine(void *context, const nominalprimitivesubtypes_packet *value0, const nominalprimitivesubtypes_packet *value1, nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_19_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_copy_19_check(value1, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fin_below((&value0->digit)->data, (&value0->digit)->length, lb_fin_combine_0_0, 1)) return lb_invalid(error, "value0.digit is not below its Fin 3 bound");
  if (!lb_fin_below((&value1->digit)->data, (&value1->digit)->length, lb_fin_combine_1_0, 1)) return lb_invalid(error, "value1.digit is not below its Fin 3 bound");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_0(lb_copy_0_in((&value0->unit_value)))) return lb_invalid(error, "value0.unitValue was rejected by NominalPrimitiveSubtypes.unitA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_1(lb_copy_1_in((&value0->bool_value)))) return lb_invalid(error, "value0.boolValue was rejected by NominalPrimitiveSubtypes.boolA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_2(lb_copy_2_in((&value0->uint8_value)))) return lb_invalid(error, "value0.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_3(lb_copy_3_in((&value0->uint16_value)))) return lb_invalid(error, "value0.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_4(lb_copy_4_in((&value0->uint32_value)))) return lb_invalid(error, "value0.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_5(lb_copy_5_in((&value0->uint64_value)))) return lb_invalid(error, "value0.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_6(lb_copy_6_in((&value0->int8_value)))) return lb_invalid(error, "value0.int8Value was rejected by NominalPrimitiveSubtypes.int8A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_7(lb_copy_7_in((&value0->int16_value)))) return lb_invalid(error, "value0.int16Value was rejected by NominalPrimitiveSubtypes.int16A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_8(lb_copy_8_in((&value0->int32_value)))) return lb_invalid(error, "value0.int32Value was rejected by NominalPrimitiveSubtypes.int32A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_9(lb_copy_9_in((&value0->int64_value)))) return lb_invalid(error, "value0.int64Value was rejected by NominalPrimitiveSubtypes.int64A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_10(lb_copy_10_in((&value0->nat_value)))) return lb_invalid(error, "value0.natValue was rejected by NominalPrimitiveSubtypes.natA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_11(lb_copy_11_in((&value0->int_value)))) return lb_invalid(error, "value0.intValue was rejected by NominalPrimitiveSubtypes.intA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_12(lb_copy_12_in((&value0->float32_value)))) return lb_invalid(error, "value0.float32Value was rejected by NominalPrimitiveSubtypes.float32A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_13(lb_copy_13_in((&value0->float64_value)))) return lb_invalid(error, "value0.float64Value was rejected by NominalPrimitiveSubtypes.float64A");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_14(lb_copy_14_in((&value0->text_value)))) return lb_invalid(error, "value0.textValue was rejected by NominalPrimitiveSubtypes.textA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_15(lb_copy_15_in((&value0->bytes_value)))) return lb_invalid(error, "value0.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_16(lb_copy_16_in((&value0->char_value)))) return lb_invalid(error, "value0.charValue was rejected by NominalPrimitiveSubtypes.charA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_17(lb_copy_17_in((&value0->usize_value)))) return lb_invalid(error, "value0.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_0_18(lb_copy_18_in((&value0->isize_value)))) return lb_invalid(error, "value0.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_0(lb_copy_0_in((&value1->unit_value)))) return lb_invalid(error, "value1.unitValue was rejected by NominalPrimitiveSubtypes.unitB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_1(lb_copy_1_in((&value1->bool_value)))) return lb_invalid(error, "value1.boolValue was rejected by NominalPrimitiveSubtypes.boolB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_2(lb_copy_2_in((&value1->uint8_value)))) return lb_invalid(error, "value1.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_3(lb_copy_3_in((&value1->uint16_value)))) return lb_invalid(error, "value1.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_4(lb_copy_4_in((&value1->uint32_value)))) return lb_invalid(error, "value1.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_5(lb_copy_5_in((&value1->uint64_value)))) return lb_invalid(error, "value1.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_6(lb_copy_6_in((&value1->int8_value)))) return lb_invalid(error, "value1.int8Value was rejected by NominalPrimitiveSubtypes.int8B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_7(lb_copy_7_in((&value1->int16_value)))) return lb_invalid(error, "value1.int16Value was rejected by NominalPrimitiveSubtypes.int16B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_8(lb_copy_8_in((&value1->int32_value)))) return lb_invalid(error, "value1.int32Value was rejected by NominalPrimitiveSubtypes.int32B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_9(lb_copy_9_in((&value1->int64_value)))) return lb_invalid(error, "value1.int64Value was rejected by NominalPrimitiveSubtypes.int64B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_10(lb_copy_10_in((&value1->nat_value)))) return lb_invalid(error, "value1.natValue was rejected by NominalPrimitiveSubtypes.natB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_11(lb_copy_11_in((&value1->int_value)))) return lb_invalid(error, "value1.intValue was rejected by NominalPrimitiveSubtypes.intB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_12(lb_copy_12_in((&value1->float32_value)))) return lb_invalid(error, "value1.float32Value was rejected by NominalPrimitiveSubtypes.float32B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_13(lb_copy_13_in((&value1->float64_value)))) return lb_invalid(error, "value1.float64Value was rejected by NominalPrimitiveSubtypes.float64B");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_14(lb_copy_14_in((&value1->text_value)))) return lb_invalid(error, "value1.textValue was rejected by NominalPrimitiveSubtypes.textB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_15(lb_copy_15_in((&value1->bytes_value)))) return lb_invalid(error, "value1.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_16(lb_copy_16_in((&value1->char_value)))) return lb_invalid(error, "value1.charValue was rejected by NominalPrimitiveSubtypes.charB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_17(lb_copy_17_in((&value1->usize_value)))) return lb_invalid(error, "value1.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB");
  if (!lb_f830d4f947d8993755fe2eda_refinement_1_18(lb_copy_18_in((&value1->isize_value)))) return lb_invalid(error, "value1.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB");
  lean_object *checked = lb_f830d4f947d8993755fe2eda(lb_copy_19_in(value0), lb_copy_19_in(value1));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value result = {0};
  int status = lb_copy_22_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_echo_a(void *context, const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_19_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fin_below((&value0->digit)->data, (&value0->digit)->length, lb_fin_echo_a_0_0, 1)) return lb_invalid(error, "value0.digit is not below its Fin 3 bound");
  if (!lb_f444432e2b24d280246a5934_refinement_0_0(lb_copy_0_in((&value0->unit_value)))) return lb_invalid(error, "value0.unitValue was rejected by NominalPrimitiveSubtypes.unitA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_1(lb_copy_1_in((&value0->bool_value)))) return lb_invalid(error, "value0.boolValue was rejected by NominalPrimitiveSubtypes.boolA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_2(lb_copy_2_in((&value0->uint8_value)))) return lb_invalid(error, "value0.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_3(lb_copy_3_in((&value0->uint16_value)))) return lb_invalid(error, "value0.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_4(lb_copy_4_in((&value0->uint32_value)))) return lb_invalid(error, "value0.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_5(lb_copy_5_in((&value0->uint64_value)))) return lb_invalid(error, "value0.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_6(lb_copy_6_in((&value0->int8_value)))) return lb_invalid(error, "value0.int8Value was rejected by NominalPrimitiveSubtypes.int8A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_7(lb_copy_7_in((&value0->int16_value)))) return lb_invalid(error, "value0.int16Value was rejected by NominalPrimitiveSubtypes.int16A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_8(lb_copy_8_in((&value0->int32_value)))) return lb_invalid(error, "value0.int32Value was rejected by NominalPrimitiveSubtypes.int32A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_9(lb_copy_9_in((&value0->int64_value)))) return lb_invalid(error, "value0.int64Value was rejected by NominalPrimitiveSubtypes.int64A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_10(lb_copy_10_in((&value0->nat_value)))) return lb_invalid(error, "value0.natValue was rejected by NominalPrimitiveSubtypes.natA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_11(lb_copy_11_in((&value0->int_value)))) return lb_invalid(error, "value0.intValue was rejected by NominalPrimitiveSubtypes.intA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_12(lb_copy_12_in((&value0->float32_value)))) return lb_invalid(error, "value0.float32Value was rejected by NominalPrimitiveSubtypes.float32A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_13(lb_copy_13_in((&value0->float64_value)))) return lb_invalid(error, "value0.float64Value was rejected by NominalPrimitiveSubtypes.float64A");
  if (!lb_f444432e2b24d280246a5934_refinement_0_14(lb_copy_14_in((&value0->text_value)))) return lb_invalid(error, "value0.textValue was rejected by NominalPrimitiveSubtypes.textA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_15(lb_copy_15_in((&value0->bytes_value)))) return lb_invalid(error, "value0.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_16(lb_copy_16_in((&value0->char_value)))) return lb_invalid(error, "value0.charValue was rejected by NominalPrimitiveSubtypes.charA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_17(lb_copy_17_in((&value0->usize_value)))) return lb_invalid(error, "value0.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA");
  if (!lb_f444432e2b24d280246a5934_refinement_0_18(lb_copy_18_in((&value0->isize_value)))) return lb_invalid(error, "value0.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA");
  lean_object *checked = lb_f444432e2b24d280246a5934(lb_copy_19_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_packet result = {0};
  int status = lb_copy_19_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_packet_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_echo_b(void *context, const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_19_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fin_below((&value0->digit)->data, (&value0->digit)->length, lb_fin_echo_b_0_0, 1)) return lb_invalid(error, "value0.digit is not below its Fin 3 bound");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_0(lb_copy_0_in((&value0->unit_value)))) return lb_invalid(error, "value0.unitValue was rejected by NominalPrimitiveSubtypes.unitB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_1(lb_copy_1_in((&value0->bool_value)))) return lb_invalid(error, "value0.boolValue was rejected by NominalPrimitiveSubtypes.boolB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_2(lb_copy_2_in((&value0->uint8_value)))) return lb_invalid(error, "value0.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_3(lb_copy_3_in((&value0->uint16_value)))) return lb_invalid(error, "value0.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_4(lb_copy_4_in((&value0->uint32_value)))) return lb_invalid(error, "value0.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_5(lb_copy_5_in((&value0->uint64_value)))) return lb_invalid(error, "value0.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_6(lb_copy_6_in((&value0->int8_value)))) return lb_invalid(error, "value0.int8Value was rejected by NominalPrimitiveSubtypes.int8B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_7(lb_copy_7_in((&value0->int16_value)))) return lb_invalid(error, "value0.int16Value was rejected by NominalPrimitiveSubtypes.int16B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_8(lb_copy_8_in((&value0->int32_value)))) return lb_invalid(error, "value0.int32Value was rejected by NominalPrimitiveSubtypes.int32B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_9(lb_copy_9_in((&value0->int64_value)))) return lb_invalid(error, "value0.int64Value was rejected by NominalPrimitiveSubtypes.int64B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_10(lb_copy_10_in((&value0->nat_value)))) return lb_invalid(error, "value0.natValue was rejected by NominalPrimitiveSubtypes.natB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_11(lb_copy_11_in((&value0->int_value)))) return lb_invalid(error, "value0.intValue was rejected by NominalPrimitiveSubtypes.intB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_12(lb_copy_12_in((&value0->float32_value)))) return lb_invalid(error, "value0.float32Value was rejected by NominalPrimitiveSubtypes.float32B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_13(lb_copy_13_in((&value0->float64_value)))) return lb_invalid(error, "value0.float64Value was rejected by NominalPrimitiveSubtypes.float64B");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_14(lb_copy_14_in((&value0->text_value)))) return lb_invalid(error, "value0.textValue was rejected by NominalPrimitiveSubtypes.textB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_15(lb_copy_15_in((&value0->bytes_value)))) return lb_invalid(error, "value0.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_16(lb_copy_16_in((&value0->char_value)))) return lb_invalid(error, "value0.charValue was rejected by NominalPrimitiveSubtypes.charB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_17(lb_copy_17_in((&value0->usize_value)))) return lb_invalid(error, "value0.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB");
  if (!lb_fcd46ebe42d8a5f37879812b_refinement_0_18(lb_copy_18_in((&value0->isize_value)))) return lb_invalid(error, "value0.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB");
  lean_object *checked = lb_fcd46ebe42d8a5f37879812b(lb_copy_19_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_packet result = {0};
  int status = lb_copy_19_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_packet_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_echo_event_a(void *context, const nominalprimitivesubtypes_event *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_26_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (value0->kind == 1u) {
    if (!lb_fin_below((&(&value0->cases.box.value)->digit)->data, (&(&value0->cases.box.value)->digit)->length, lb_fin_echo_event_a_0_0, 1)) return lb_invalid(error, "value0.box.value.digit is not below its Fin 3 bound");
  }
  if (value0->kind == 2u) {
    for (size_t k4 = 0; k4 < (&value0->cases.choices.values)->length; ++k4) {
      if ((&(&value0->cases.choices.values)->data[k4])->has_value) {
        if ((&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_fin_below((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->digit)->data, (&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->digit)->length, lb_fin_echo_event_a_0_1, 1)) {
            static _Thread_local char lb_fin_echo_event_a_0_1_message[sizeof("value0.choices.values[%zu]?.ok.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_fin_echo_event_a_0_1_message, sizeof(lb_fin_echo_event_a_0_1_message), "value0.choices.values[%zu]?.ok.digit is not below its Fin 3 bound", k4);
            return lb_invalid(error, lb_fin_echo_event_a_0_1_message);
          }
        }
        if (!(&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_fin_below((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->digit)->data, (&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->digit)->length, lb_fin_echo_event_a_0_2, 1)) {
            static _Thread_local char lb_fin_echo_event_a_0_2_message[sizeof("value0.choices.values[%zu]?.error.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_fin_echo_event_a_0_2_message, sizeof(lb_fin_echo_event_a_0_2_message), "value0.choices.values[%zu]?.error.digit is not below its Fin 3 bound", k4);
            return lb_invalid(error, lb_fin_echo_event_a_0_2_message);
          }
        }
      }
    }
  }
  if (value0->kind == 1u) {
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_0(lb_copy_0_in((&(&value0->cases.box.value)->unit_value)))) return lb_invalid(error, "value0.box.value.unitValue was rejected by NominalPrimitiveSubtypes.unitA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_1(lb_copy_1_in((&(&value0->cases.box.value)->bool_value)))) return lb_invalid(error, "value0.box.value.boolValue was rejected by NominalPrimitiveSubtypes.boolA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_2(lb_copy_2_in((&(&value0->cases.box.value)->uint8_value)))) return lb_invalid(error, "value0.box.value.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_3(lb_copy_3_in((&(&value0->cases.box.value)->uint16_value)))) return lb_invalid(error, "value0.box.value.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_4(lb_copy_4_in((&(&value0->cases.box.value)->uint32_value)))) return lb_invalid(error, "value0.box.value.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_5(lb_copy_5_in((&(&value0->cases.box.value)->uint64_value)))) return lb_invalid(error, "value0.box.value.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_6(lb_copy_6_in((&(&value0->cases.box.value)->int8_value)))) return lb_invalid(error, "value0.box.value.int8Value was rejected by NominalPrimitiveSubtypes.int8A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_7(lb_copy_7_in((&(&value0->cases.box.value)->int16_value)))) return lb_invalid(error, "value0.box.value.int16Value was rejected by NominalPrimitiveSubtypes.int16A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_8(lb_copy_8_in((&(&value0->cases.box.value)->int32_value)))) return lb_invalid(error, "value0.box.value.int32Value was rejected by NominalPrimitiveSubtypes.int32A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_9(lb_copy_9_in((&(&value0->cases.box.value)->int64_value)))) return lb_invalid(error, "value0.box.value.int64Value was rejected by NominalPrimitiveSubtypes.int64A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_10(lb_copy_10_in((&(&value0->cases.box.value)->nat_value)))) return lb_invalid(error, "value0.box.value.natValue was rejected by NominalPrimitiveSubtypes.natA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_11(lb_copy_11_in((&(&value0->cases.box.value)->int_value)))) return lb_invalid(error, "value0.box.value.intValue was rejected by NominalPrimitiveSubtypes.intA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_12(lb_copy_12_in((&(&value0->cases.box.value)->float32_value)))) return lb_invalid(error, "value0.box.value.float32Value was rejected by NominalPrimitiveSubtypes.float32A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_13(lb_copy_13_in((&(&value0->cases.box.value)->float64_value)))) return lb_invalid(error, "value0.box.value.float64Value was rejected by NominalPrimitiveSubtypes.float64A");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_14(lb_copy_14_in((&(&value0->cases.box.value)->text_value)))) return lb_invalid(error, "value0.box.value.textValue was rejected by NominalPrimitiveSubtypes.textA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_15(lb_copy_15_in((&(&value0->cases.box.value)->bytes_value)))) return lb_invalid(error, "value0.box.value.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_16(lb_copy_16_in((&(&value0->cases.box.value)->char_value)))) return lb_invalid(error, "value0.box.value.charValue was rejected by NominalPrimitiveSubtypes.charA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_17(lb_copy_17_in((&(&value0->cases.box.value)->usize_value)))) return lb_invalid(error, "value0.box.value.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA");
    if (!lb_7418bd537393e68a59611679_refinement_0_1_0_18(lb_copy_18_in((&(&value0->cases.box.value)->isize_value)))) return lb_invalid(error, "value0.box.value.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA");
  }
  if (value0->kind == 2u) {
    for (size_t k4 = 0; k4 < (&value0->cases.choices.values)->length; ++k4) {
      if ((&(&value0->cases.choices.values)->data[k4])->has_value) {
        if ((&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0(lb_copy_0_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->unit_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0_message[sizeof("value0.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0_message), "value0.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_0_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1(lb_copy_1_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->bool_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1_message[sizeof("value0.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1_message), "value0.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_1_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2(lb_copy_2_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint8_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2_message[sizeof("value0.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2_message), "value0.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_2_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3(lb_copy_3_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint16_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3_message[sizeof("value0.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3_message), "value0.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_3_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4(lb_copy_4_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4_message[sizeof("value0.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4_message), "value0.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_4_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5(lb_copy_5_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5_message[sizeof("value0.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5_message), "value0.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_5_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6(lb_copy_6_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int8_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6_message[sizeof("value0.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6_message), "value0.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_6_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7(lb_copy_7_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int16_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7_message[sizeof("value0.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7_message), "value0.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_7_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8(lb_copy_8_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8_message[sizeof("value0.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8_message), "value0.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_8_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9(lb_copy_9_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9_message[sizeof("value0.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9_message), "value0.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_9_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10(lb_copy_10_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->nat_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10_message[sizeof("value0.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10_message), "value0.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_10_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11(lb_copy_11_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11_message[sizeof("value0.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11_message), "value0.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_11_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12(lb_copy_12_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->float32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12_message[sizeof("value0.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12_message), "value0.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_12_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13(lb_copy_13_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->float64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13_message[sizeof("value0.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13_message), "value0.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64A", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_13_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14(lb_copy_14_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->text_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14_message[sizeof("value0.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14_message), "value0.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_14_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15(lb_copy_15_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->bytes_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15_message[sizeof("value0.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15_message), "value0.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_15_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16(lb_copy_16_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->char_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16_message[sizeof("value0.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16_message), "value0.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_16_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17(lb_copy_17_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->usize_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17_message[sizeof("value0.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17_message), "value0.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_17_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18(lb_copy_18_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->isize_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18_message[sizeof("value0.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18_message), "value0.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_0_18_message);
          }
        }
        if (!(&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0(lb_copy_0_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->unit_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0_message[sizeof("value0.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0_message), "value0.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_0_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1(lb_copy_1_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->bool_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1_message[sizeof("value0.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1_message), "value0.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_1_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2(lb_copy_2_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint8_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2_message[sizeof("value0.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2_message), "value0.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_2_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3(lb_copy_3_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint16_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3_message[sizeof("value0.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3_message), "value0.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_3_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4(lb_copy_4_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4_message[sizeof("value0.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4_message), "value0.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_4_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5(lb_copy_5_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5_message[sizeof("value0.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5_message), "value0.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_5_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6(lb_copy_6_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int8_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6_message[sizeof("value0.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6_message), "value0.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_6_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7(lb_copy_7_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int16_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7_message[sizeof("value0.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7_message), "value0.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_7_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8(lb_copy_8_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8_message[sizeof("value0.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8_message), "value0.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_8_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9(lb_copy_9_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9_message[sizeof("value0.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9_message), "value0.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_9_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10(lb_copy_10_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->nat_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10_message[sizeof("value0.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10_message), "value0.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_10_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11(lb_copy_11_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11_message[sizeof("value0.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11_message), "value0.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_11_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12(lb_copy_12_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->float32_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12_message[sizeof("value0.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12_message), "value0.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_12_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13(lb_copy_13_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->float64_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13_message[sizeof("value0.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13_message), "value0.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64B", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_13_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14(lb_copy_14_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->text_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14_message[sizeof("value0.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14_message), "value0.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_14_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15(lb_copy_15_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->bytes_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15_message[sizeof("value0.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15_message), "value0.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_15_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16(lb_copy_16_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->char_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16_message[sizeof("value0.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16_message), "value0.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_16_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17(lb_copy_17_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->usize_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17_message[sizeof("value0.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17_message), "value0.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_17_message);
          }
          if (!lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18(lb_copy_18_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->isize_value)))) {
            static _Thread_local char lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18_message[sizeof("value0.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18_message, sizeof(lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18_message), "value0.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", k4);
            return lb_invalid(error, lb_7418bd537393e68a59611679_refinement_0_2_0_0_0_1_18_message);
          }
        }
      }
    }
  }
  lean_object *checked = lb_7418bd537393e68a59611679(lb_copy_26_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_event result = {0};
  int status = lb_copy_26_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_event_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_echo_event_b(void *context, const nominalprimitivesubtypes_event *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_26_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (value0->kind == 1u) {
    if (!lb_fin_below((&(&value0->cases.box.value)->digit)->data, (&(&value0->cases.box.value)->digit)->length, lb_fin_echo_event_b_0_0, 1)) return lb_invalid(error, "value0.box.value.digit is not below its Fin 3 bound");
  }
  if (value0->kind == 2u) {
    for (size_t k4 = 0; k4 < (&value0->cases.choices.values)->length; ++k4) {
      if ((&(&value0->cases.choices.values)->data[k4])->has_value) {
        if ((&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_fin_below((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->digit)->data, (&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->digit)->length, lb_fin_echo_event_b_0_1, 1)) {
            static _Thread_local char lb_fin_echo_event_b_0_1_message[sizeof("value0.choices.values[%zu]?.ok.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_fin_echo_event_b_0_1_message, sizeof(lb_fin_echo_event_b_0_1_message), "value0.choices.values[%zu]?.ok.digit is not below its Fin 3 bound", k4);
            return lb_invalid(error, lb_fin_echo_event_b_0_1_message);
          }
        }
        if (!(&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_fin_below((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->digit)->data, (&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->digit)->length, lb_fin_echo_event_b_0_2, 1)) {
            static _Thread_local char lb_fin_echo_event_b_0_2_message[sizeof("value0.choices.values[%zu]?.error.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_fin_echo_event_b_0_2_message, sizeof(lb_fin_echo_event_b_0_2_message), "value0.choices.values[%zu]?.error.digit is not below its Fin 3 bound", k4);
            return lb_invalid(error, lb_fin_echo_event_b_0_2_message);
          }
        }
      }
    }
  }
  if (value0->kind == 1u) {
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_0(lb_copy_0_in((&(&value0->cases.box.value)->unit_value)))) return lb_invalid(error, "value0.box.value.unitValue was rejected by NominalPrimitiveSubtypes.unitB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_1(lb_copy_1_in((&(&value0->cases.box.value)->bool_value)))) return lb_invalid(error, "value0.box.value.boolValue was rejected by NominalPrimitiveSubtypes.boolB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_2(lb_copy_2_in((&(&value0->cases.box.value)->uint8_value)))) return lb_invalid(error, "value0.box.value.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_3(lb_copy_3_in((&(&value0->cases.box.value)->uint16_value)))) return lb_invalid(error, "value0.box.value.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_4(lb_copy_4_in((&(&value0->cases.box.value)->uint32_value)))) return lb_invalid(error, "value0.box.value.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_5(lb_copy_5_in((&(&value0->cases.box.value)->uint64_value)))) return lb_invalid(error, "value0.box.value.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_6(lb_copy_6_in((&(&value0->cases.box.value)->int8_value)))) return lb_invalid(error, "value0.box.value.int8Value was rejected by NominalPrimitiveSubtypes.int8B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_7(lb_copy_7_in((&(&value0->cases.box.value)->int16_value)))) return lb_invalid(error, "value0.box.value.int16Value was rejected by NominalPrimitiveSubtypes.int16B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_8(lb_copy_8_in((&(&value0->cases.box.value)->int32_value)))) return lb_invalid(error, "value0.box.value.int32Value was rejected by NominalPrimitiveSubtypes.int32B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_9(lb_copy_9_in((&(&value0->cases.box.value)->int64_value)))) return lb_invalid(error, "value0.box.value.int64Value was rejected by NominalPrimitiveSubtypes.int64B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_10(lb_copy_10_in((&(&value0->cases.box.value)->nat_value)))) return lb_invalid(error, "value0.box.value.natValue was rejected by NominalPrimitiveSubtypes.natB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_11(lb_copy_11_in((&(&value0->cases.box.value)->int_value)))) return lb_invalid(error, "value0.box.value.intValue was rejected by NominalPrimitiveSubtypes.intB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_12(lb_copy_12_in((&(&value0->cases.box.value)->float32_value)))) return lb_invalid(error, "value0.box.value.float32Value was rejected by NominalPrimitiveSubtypes.float32B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_13(lb_copy_13_in((&(&value0->cases.box.value)->float64_value)))) return lb_invalid(error, "value0.box.value.float64Value was rejected by NominalPrimitiveSubtypes.float64B");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_14(lb_copy_14_in((&(&value0->cases.box.value)->text_value)))) return lb_invalid(error, "value0.box.value.textValue was rejected by NominalPrimitiveSubtypes.textB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_15(lb_copy_15_in((&(&value0->cases.box.value)->bytes_value)))) return lb_invalid(error, "value0.box.value.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_16(lb_copy_16_in((&(&value0->cases.box.value)->char_value)))) return lb_invalid(error, "value0.box.value.charValue was rejected by NominalPrimitiveSubtypes.charB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_17(lb_copy_17_in((&(&value0->cases.box.value)->usize_value)))) return lb_invalid(error, "value0.box.value.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB");
    if (!lb_2ff268195b6929b7f5ecf871_refinement_0_1_0_18(lb_copy_18_in((&(&value0->cases.box.value)->isize_value)))) return lb_invalid(error, "value0.box.value.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB");
  }
  if (value0->kind == 2u) {
    for (size_t k4 = 0; k4 < (&value0->cases.choices.values)->length; ++k4) {
      if ((&(&value0->cases.choices.values)->data[k4])->has_value) {
        if ((&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0(lb_copy_0_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->unit_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0_message[sizeof("value0.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0_message), "value0.choices.values[%zu]?.ok.unitValue was rejected by NominalPrimitiveSubtypes.unitB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_0_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1(lb_copy_1_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->bool_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1_message[sizeof("value0.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1_message), "value0.choices.values[%zu]?.ok.boolValue was rejected by NominalPrimitiveSubtypes.boolB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_1_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2(lb_copy_2_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint8_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2_message[sizeof("value0.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2_message), "value0.choices.values[%zu]?.ok.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_2_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3(lb_copy_3_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint16_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3_message[sizeof("value0.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3_message), "value0.choices.values[%zu]?.ok.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_3_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4(lb_copy_4_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4_message[sizeof("value0.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4_message), "value0.choices.values[%zu]?.ok.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_4_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5(lb_copy_5_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->uint64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5_message[sizeof("value0.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5_message), "value0.choices.values[%zu]?.ok.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_5_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6(lb_copy_6_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int8_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6_message[sizeof("value0.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6_message), "value0.choices.values[%zu]?.ok.int8Value was rejected by NominalPrimitiveSubtypes.int8B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_6_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7(lb_copy_7_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int16_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7_message[sizeof("value0.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7_message), "value0.choices.values[%zu]?.ok.int16Value was rejected by NominalPrimitiveSubtypes.int16B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_7_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8(lb_copy_8_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8_message[sizeof("value0.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8_message), "value0.choices.values[%zu]?.ok.int32Value was rejected by NominalPrimitiveSubtypes.int32B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_8_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9(lb_copy_9_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9_message[sizeof("value0.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9_message), "value0.choices.values[%zu]?.ok.int64Value was rejected by NominalPrimitiveSubtypes.int64B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_9_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10(lb_copy_10_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->nat_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10_message[sizeof("value0.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10_message), "value0.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_10_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11(lb_copy_11_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->int_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11_message[sizeof("value0.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11_message), "value0.choices.values[%zu]?.ok.intValue was rejected by NominalPrimitiveSubtypes.intB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_11_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12(lb_copy_12_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->float32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12_message[sizeof("value0.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12_message), "value0.choices.values[%zu]?.ok.float32Value was rejected by NominalPrimitiveSubtypes.float32B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_12_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13(lb_copy_13_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->float64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13_message[sizeof("value0.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64B") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13_message), "value0.choices.values[%zu]?.ok.float64Value was rejected by NominalPrimitiveSubtypes.float64B", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_13_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14(lb_copy_14_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->text_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14_message[sizeof("value0.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14_message), "value0.choices.values[%zu]?.ok.textValue was rejected by NominalPrimitiveSubtypes.textB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_14_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15(lb_copy_15_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->bytes_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15_message[sizeof("value0.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15_message), "value0.choices.values[%zu]?.ok.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_15_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16(lb_copy_16_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->char_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16_message[sizeof("value0.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16_message), "value0.choices.values[%zu]?.ok.charValue was rejected by NominalPrimitiveSubtypes.charB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_16_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17(lb_copy_17_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->usize_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17_message[sizeof("value0.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17_message), "value0.choices.values[%zu]?.ok.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_17_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18(lb_copy_18_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->ok)->isize_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18_message[sizeof("value0.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18_message), "value0.choices.values[%zu]?.ok.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_0_18_message);
          }
        }
        if (!(&(&(&value0->cases.choices.values)->data[k4])->value)->is_ok) {
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0(lb_copy_0_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->unit_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0_message[sizeof("value0.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0_message), "value0.choices.values[%zu]?.error.unitValue was rejected by NominalPrimitiveSubtypes.unitA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_0_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1(lb_copy_1_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->bool_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1_message[sizeof("value0.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1_message), "value0.choices.values[%zu]?.error.boolValue was rejected by NominalPrimitiveSubtypes.boolA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_1_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2(lb_copy_2_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint8_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2_message[sizeof("value0.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2_message), "value0.choices.values[%zu]?.error.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_2_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3(lb_copy_3_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint16_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3_message[sizeof("value0.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3_message), "value0.choices.values[%zu]?.error.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_3_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4(lb_copy_4_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4_message[sizeof("value0.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4_message), "value0.choices.values[%zu]?.error.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_4_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5(lb_copy_5_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->uint64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5_message[sizeof("value0.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5_message), "value0.choices.values[%zu]?.error.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_5_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6(lb_copy_6_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int8_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6_message[sizeof("value0.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6_message), "value0.choices.values[%zu]?.error.int8Value was rejected by NominalPrimitiveSubtypes.int8A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_6_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7(lb_copy_7_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int16_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7_message[sizeof("value0.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7_message), "value0.choices.values[%zu]?.error.int16Value was rejected by NominalPrimitiveSubtypes.int16A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_7_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8(lb_copy_8_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8_message[sizeof("value0.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8_message), "value0.choices.values[%zu]?.error.int32Value was rejected by NominalPrimitiveSubtypes.int32A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_8_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9(lb_copy_9_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9_message[sizeof("value0.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9_message), "value0.choices.values[%zu]?.error.int64Value was rejected by NominalPrimitiveSubtypes.int64A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_9_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10(lb_copy_10_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->nat_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10_message[sizeof("value0.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10_message), "value0.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_10_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11(lb_copy_11_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->int_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11_message[sizeof("value0.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11_message), "value0.choices.values[%zu]?.error.intValue was rejected by NominalPrimitiveSubtypes.intA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_11_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12(lb_copy_12_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->float32_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12_message[sizeof("value0.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12_message), "value0.choices.values[%zu]?.error.float32Value was rejected by NominalPrimitiveSubtypes.float32A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_12_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13(lb_copy_13_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->float64_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13_message[sizeof("value0.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64A") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13_message), "value0.choices.values[%zu]?.error.float64Value was rejected by NominalPrimitiveSubtypes.float64A", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_13_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14(lb_copy_14_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->text_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14_message[sizeof("value0.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14_message), "value0.choices.values[%zu]?.error.textValue was rejected by NominalPrimitiveSubtypes.textA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_14_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15(lb_copy_15_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->bytes_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15_message[sizeof("value0.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15_message), "value0.choices.values[%zu]?.error.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_15_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16(lb_copy_16_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->char_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16_message[sizeof("value0.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16_message), "value0.choices.values[%zu]?.error.charValue was rejected by NominalPrimitiveSubtypes.charA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_16_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17(lb_copy_17_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->usize_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17_message[sizeof("value0.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17_message), "value0.choices.values[%zu]?.error.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_17_message);
          }
          if (!lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18(lb_copy_18_in((&(&(&(&(&value0->cases.choices.values)->data[k4])->value)->error)->isize_value)))) {
            static _Thread_local char lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18_message[sizeof("value0.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA") + 1 * 3 * sizeof(size_t)];
            (void)snprintf(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18_message, sizeof(lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18_message), "value0.choices.values[%zu]?.error.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", k4);
            return lb_invalid(error, lb_2ff268195b6929b7f5ecf871_refinement_0_2_0_0_0_1_18_message);
          }
        }
      }
    }
  }
  lean_object *checked = lb_2ff268195b6929b7f5ecf871(lb_copy_26_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_event result = {0};
  int status = lb_copy_26_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_event_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_echo_pair(void *context, const nominalprimitivesubtypes_pair *value0, nominalprimitivesubtypes_pair *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_27_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  for (size_t k2 = 0; k2 < (&value0->left)->length; ++k2) {
    if ((&(&value0->left)->data[k2])->has_value) {
      if (!lb_fin_below((&(&(&(&value0->left)->data[k2])->value)->digit)->data, (&(&(&(&value0->left)->data[k2])->value)->digit)->length, lb_fin_echo_pair_0_0, 1)) {
        static _Thread_local char lb_fin_echo_pair_0_0_message[sizeof("value0.left[%zu]?.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fin_echo_pair_0_0_message, sizeof(lb_fin_echo_pair_0_0_message), "value0.left[%zu]?.digit is not below its Fin 3 bound", k2);
        return lb_invalid(error, lb_fin_echo_pair_0_0_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < (&value0->right)->length; ++k2) {
    if ((&(&value0->right)->data[k2])->has_value) {
      if (!lb_fin_below((&(&(&(&value0->right)->data[k2])->value)->digit)->data, (&(&(&(&value0->right)->data[k2])->value)->digit)->length, lb_fin_echo_pair_0_1, 1)) {
        static _Thread_local char lb_fin_echo_pair_0_1_message[sizeof("value0.right[%zu]?.digit is not below its Fin 3 bound") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fin_echo_pair_0_1_message, sizeof(lb_fin_echo_pair_0_1_message), "value0.right[%zu]?.digit is not below its Fin 3 bound", k2);
        return lb_invalid(error, lb_fin_echo_pair_0_1_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < (&value0->left)->length; ++k2) {
    if ((&(&value0->left)->data[k2])->has_value) {
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0(lb_copy_0_in((&(&(&(&value0->left)->data[k2])->value)->unit_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0_message[sizeof("value0.left[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0_message), "value0.left[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_0_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1(lb_copy_1_in((&(&(&(&value0->left)->data[k2])->value)->bool_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1_message[sizeof("value0.left[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1_message), "value0.left[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_1_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2(lb_copy_2_in((&(&(&(&value0->left)->data[k2])->value)->uint8_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2_message[sizeof("value0.left[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2_message), "value0.left[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_2_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3(lb_copy_3_in((&(&(&(&value0->left)->data[k2])->value)->uint16_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3_message[sizeof("value0.left[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3_message), "value0.left[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_3_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4(lb_copy_4_in((&(&(&(&value0->left)->data[k2])->value)->uint32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4_message[sizeof("value0.left[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4_message), "value0.left[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_4_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5(lb_copy_5_in((&(&(&(&value0->left)->data[k2])->value)->uint64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5_message[sizeof("value0.left[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5_message), "value0.left[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_5_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6(lb_copy_6_in((&(&(&(&value0->left)->data[k2])->value)->int8_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6_message[sizeof("value0.left[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6_message), "value0.left[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_6_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7(lb_copy_7_in((&(&(&(&value0->left)->data[k2])->value)->int16_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7_message[sizeof("value0.left[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7_message), "value0.left[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_7_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8(lb_copy_8_in((&(&(&(&value0->left)->data[k2])->value)->int32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8_message[sizeof("value0.left[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8_message), "value0.left[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_8_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9(lb_copy_9_in((&(&(&(&value0->left)->data[k2])->value)->int64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9_message[sizeof("value0.left[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9_message), "value0.left[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_9_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10(lb_copy_10_in((&(&(&(&value0->left)->data[k2])->value)->nat_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10_message[sizeof("value0.left[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10_message), "value0.left[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_10_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11(lb_copy_11_in((&(&(&(&value0->left)->data[k2])->value)->int_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11_message[sizeof("value0.left[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11_message), "value0.left[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_11_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12(lb_copy_12_in((&(&(&(&value0->left)->data[k2])->value)->float32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12_message[sizeof("value0.left[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12_message), "value0.left[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_12_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13(lb_copy_13_in((&(&(&(&value0->left)->data[k2])->value)->float64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13_message[sizeof("value0.left[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13_message), "value0.left[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64A", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_13_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14(lb_copy_14_in((&(&(&(&value0->left)->data[k2])->value)->text_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14_message[sizeof("value0.left[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14_message), "value0.left[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_14_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15(lb_copy_15_in((&(&(&(&value0->left)->data[k2])->value)->bytes_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15_message[sizeof("value0.left[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15_message), "value0.left[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_15_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16(lb_copy_16_in((&(&(&(&value0->left)->data[k2])->value)->char_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16_message[sizeof("value0.left[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16_message), "value0.left[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_16_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17(lb_copy_17_in((&(&(&(&value0->left)->data[k2])->value)->usize_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17_message[sizeof("value0.left[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17_message), "value0.left[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_17_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18(lb_copy_18_in((&(&(&(&value0->left)->data[k2])->value)->isize_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18_message[sizeof("value0.left[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18_message), "value0.left[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_0_0_0_18_message);
      }
    }
  }
  for (size_t k2 = 0; k2 < (&value0->right)->length; ++k2) {
    if ((&(&value0->right)->data[k2])->has_value) {
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0(lb_copy_0_in((&(&(&(&value0->right)->data[k2])->value)->unit_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0_message[sizeof("value0.right[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0_message), "value0.right[%zu]?.unitValue was rejected by NominalPrimitiveSubtypes.unitB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_0_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1(lb_copy_1_in((&(&(&(&value0->right)->data[k2])->value)->bool_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1_message[sizeof("value0.right[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1_message), "value0.right[%zu]?.boolValue was rejected by NominalPrimitiveSubtypes.boolB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_1_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2(lb_copy_2_in((&(&(&(&value0->right)->data[k2])->value)->uint8_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2_message[sizeof("value0.right[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2_message), "value0.right[%zu]?.uint8Value was rejected by NominalPrimitiveSubtypes.uint8B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_2_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3(lb_copy_3_in((&(&(&(&value0->right)->data[k2])->value)->uint16_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3_message[sizeof("value0.right[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3_message), "value0.right[%zu]?.uint16Value was rejected by NominalPrimitiveSubtypes.uint16B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_3_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4(lb_copy_4_in((&(&(&(&value0->right)->data[k2])->value)->uint32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4_message[sizeof("value0.right[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4_message), "value0.right[%zu]?.uint32Value was rejected by NominalPrimitiveSubtypes.uint32B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_4_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5(lb_copy_5_in((&(&(&(&value0->right)->data[k2])->value)->uint64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5_message[sizeof("value0.right[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5_message), "value0.right[%zu]?.uint64Value was rejected by NominalPrimitiveSubtypes.uint64B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_5_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6(lb_copy_6_in((&(&(&(&value0->right)->data[k2])->value)->int8_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6_message[sizeof("value0.right[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6_message), "value0.right[%zu]?.int8Value was rejected by NominalPrimitiveSubtypes.int8B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_6_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7(lb_copy_7_in((&(&(&(&value0->right)->data[k2])->value)->int16_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7_message[sizeof("value0.right[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7_message), "value0.right[%zu]?.int16Value was rejected by NominalPrimitiveSubtypes.int16B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_7_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8(lb_copy_8_in((&(&(&(&value0->right)->data[k2])->value)->int32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8_message[sizeof("value0.right[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8_message), "value0.right[%zu]?.int32Value was rejected by NominalPrimitiveSubtypes.int32B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_8_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9(lb_copy_9_in((&(&(&(&value0->right)->data[k2])->value)->int64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9_message[sizeof("value0.right[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9_message), "value0.right[%zu]?.int64Value was rejected by NominalPrimitiveSubtypes.int64B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_9_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10(lb_copy_10_in((&(&(&(&value0->right)->data[k2])->value)->nat_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10_message[sizeof("value0.right[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10_message), "value0.right[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_10_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11(lb_copy_11_in((&(&(&(&value0->right)->data[k2])->value)->int_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11_message[sizeof("value0.right[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11_message), "value0.right[%zu]?.intValue was rejected by NominalPrimitiveSubtypes.intB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_11_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12(lb_copy_12_in((&(&(&(&value0->right)->data[k2])->value)->float32_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12_message[sizeof("value0.right[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12_message), "value0.right[%zu]?.float32Value was rejected by NominalPrimitiveSubtypes.float32B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_12_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13(lb_copy_13_in((&(&(&(&value0->right)->data[k2])->value)->float64_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13_message[sizeof("value0.right[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13_message), "value0.right[%zu]?.float64Value was rejected by NominalPrimitiveSubtypes.float64B", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_13_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14(lb_copy_14_in((&(&(&(&value0->right)->data[k2])->value)->text_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14_message[sizeof("value0.right[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14_message), "value0.right[%zu]?.textValue was rejected by NominalPrimitiveSubtypes.textB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_14_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15(lb_copy_15_in((&(&(&(&value0->right)->data[k2])->value)->bytes_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15_message[sizeof("value0.right[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15_message), "value0.right[%zu]?.bytesValue was rejected by NominalPrimitiveSubtypes.bytesB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_15_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16(lb_copy_16_in((&(&(&(&value0->right)->data[k2])->value)->char_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16_message[sizeof("value0.right[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16_message), "value0.right[%zu]?.charValue was rejected by NominalPrimitiveSubtypes.charB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_16_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17(lb_copy_17_in((&(&(&(&value0->right)->data[k2])->value)->usize_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17_message[sizeof("value0.right[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17_message), "value0.right[%zu]?.usizeValue was rejected by NominalPrimitiveSubtypes.usizeB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_17_message);
      }
      if (!lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18(lb_copy_18_in((&(&(&(&value0->right)->data[k2])->value)->isize_value)))) {
        static _Thread_local char lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18_message[sizeof("value0.right[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB") + 1 * 3 * sizeof(size_t)];
        (void)snprintf(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18_message, sizeof(lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18_message), "value0.right[%zu]?.isizeValue was rejected by NominalPrimitiveSubtypes.isizeB", k2);
        return lb_invalid(error, lb_fe44a84c56da309434fd70ce_refinement_0_1_0_0_18_message);
      }
    }
  }
  lean_object *checked = lb_fe44a84c56da309434fd70ce(lb_copy_27_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_pair result = {0};
  int status = lb_copy_27_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_pair_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_produce(void *context, const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_28_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_4d420414dfdb252510c59482(lb_copy_28_in(value0));
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value result = {0};
  int status = lb_copy_20_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_produce_choices(void *context, const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_28_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_e791062d392a94a18563a45f(lb_copy_28_in(value0));
  nominalprimitivesubtypes_event result = {0};
  int status = lb_copy_26_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_event_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_produce_event(void *context, const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_event *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_28_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_e721c226f4fcff66a4ffea0f(lb_copy_28_in(value0));
  nominalprimitivesubtypes_event result = {0};
  int status = lb_copy_26_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_event_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_produce_group(void *context, const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_28_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_2c1c751c1667dd64cd4c3fe3(lb_copy_28_in(value0));
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span result = {0};
  int status = lb_copy_21_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_produce_pair(void *context, const nominalprimitivesubtypes_raw_packet *value0, nominalprimitivesubtypes_pair *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_28_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_a54b47645ca8b931f9ef293a(lb_copy_28_in(value0));
  nominalprimitivesubtypes_pair result = {0};
  int status = lb_copy_27_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_pair_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_refuse_unit(void *context, const nominalprimitivesubtypes_packet *value0, nominalprimitivesubtypes_packet *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_19_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fin_below((&value0->digit)->data, (&value0->digit)->length, lb_fin_refuse_unit_0_0, 1)) return lb_invalid(error, "value0.digit is not below its Fin 3 bound");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_0(lb_copy_0_in((&value0->unit_value)))) return lb_invalid(error, "value0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_1(lb_copy_1_in((&value0->bool_value)))) return lb_invalid(error, "value0.boolValue was rejected by NominalPrimitiveSubtypes.boolA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_2(lb_copy_2_in((&value0->uint8_value)))) return lb_invalid(error, "value0.uint8Value was rejected by NominalPrimitiveSubtypes.uint8A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_3(lb_copy_3_in((&value0->uint16_value)))) return lb_invalid(error, "value0.uint16Value was rejected by NominalPrimitiveSubtypes.uint16A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_4(lb_copy_4_in((&value0->uint32_value)))) return lb_invalid(error, "value0.uint32Value was rejected by NominalPrimitiveSubtypes.uint32A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_5(lb_copy_5_in((&value0->uint64_value)))) return lb_invalid(error, "value0.uint64Value was rejected by NominalPrimitiveSubtypes.uint64A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_6(lb_copy_6_in((&value0->int8_value)))) return lb_invalid(error, "value0.int8Value was rejected by NominalPrimitiveSubtypes.int8A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_7(lb_copy_7_in((&value0->int16_value)))) return lb_invalid(error, "value0.int16Value was rejected by NominalPrimitiveSubtypes.int16A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_8(lb_copy_8_in((&value0->int32_value)))) return lb_invalid(error, "value0.int32Value was rejected by NominalPrimitiveSubtypes.int32A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_9(lb_copy_9_in((&value0->int64_value)))) return lb_invalid(error, "value0.int64Value was rejected by NominalPrimitiveSubtypes.int64A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_10(lb_copy_10_in((&value0->nat_value)))) return lb_invalid(error, "value0.natValue was rejected by NominalPrimitiveSubtypes.natA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_11(lb_copy_11_in((&value0->int_value)))) return lb_invalid(error, "value0.intValue was rejected by NominalPrimitiveSubtypes.intA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_12(lb_copy_12_in((&value0->float32_value)))) return lb_invalid(error, "value0.float32Value was rejected by NominalPrimitiveSubtypes.float32A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_13(lb_copy_13_in((&value0->float64_value)))) return lb_invalid(error, "value0.float64Value was rejected by NominalPrimitiveSubtypes.float64A");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_14(lb_copy_14_in((&value0->text_value)))) return lb_invalid(error, "value0.textValue was rejected by NominalPrimitiveSubtypes.textA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_15(lb_copy_15_in((&value0->bytes_value)))) return lb_invalid(error, "value0.bytesValue was rejected by NominalPrimitiveSubtypes.bytesA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_16(lb_copy_16_in((&value0->char_value)))) return lb_invalid(error, "value0.charValue was rejected by NominalPrimitiveSubtypes.charA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_17(lb_copy_17_in((&value0->usize_value)))) return lb_invalid(error, "value0.usizeValue was rejected by NominalPrimitiveSubtypes.usizeA");
  if (!lb_0ca05a58ebc875690e9ebfb5_refinement_0_18(lb_copy_18_in((&value0->isize_value)))) return lb_invalid(error, "value0.isizeValue was rejected by NominalPrimitiveSubtypes.isizeA");
  lean_object *checked = lb_0ca05a58ebc875690e9ebfb5(lb_copy_19_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  nominalprimitivesubtypes_packet result = {0};
  int status = lb_copy_19_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { nominalprimitivesubtypes_packet_clear(&result); return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

static nominalprimitivesubtypes_status lb_call_word_bits(void *context, uint32_t *out, nominalprimitivesubtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR;
  uint32_t value = lb_2df79ff835926bf7b8864ec6(lean_box(0));
  uint32_t result = {0};
  int status = lb_copy_4_out(value, &result, &budget);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) { return NOMINALPRIMITIVESUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (nominalprimitivesubtypes_error){0};
  return NOMINALPRIMITIVESUBTYPES_STATUS_OK;
}

extern lean_object *initialize_LeanBridgeNative19ad06f04a0c2d39(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return initialize_LeanBridgeNative19ad06f04a0c2d39(builtin); }
static nominalprimitivesubtypes_status lb_runtime_initialize(void *context, nominalprimitivesubtypes_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize("nominalprimitivesubtypes@1.0.0", lb_initialize)
    ? NOMINALPRIMITIVESUBTYPES_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const nominalprimitivesubtypes_runtime_v1 lb_runtime = {
  .abi_version = NOMINALPRIMITIVESUBTYPES_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
  .aliases = lb_call_aliases,
  .combine = lb_call_combine,
  .echo_a = lb_call_echo_a,
  .echo_b = lb_call_echo_b,
  .echo_event_a = lb_call_echo_event_a,
  .echo_event_b = lb_call_echo_event_b,
  .echo_pair = lb_call_echo_pair,
  .produce = lb_call_produce,
  .produce_choices = lb_call_produce_choices,
  .produce_event = lb_call_produce_event,
  .produce_group = lb_call_produce_group,
  .produce_pair = lb_call_produce_pair,
  .refuse_unit = lb_call_refuse_unit,
  .word_bits = lb_call_word_bits,

};
__attribute__((constructor)) static void lb_install(void) {
  (void)nominalprimitivesubtypes_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach("nominalprimitivesubtypes@1.0.0");
}
