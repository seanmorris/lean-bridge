#include "zeropayloadcheckedrecords_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>


static inline zeropayloadcheckedrecords_status lb_invalid(zeropayloadcheckedrecords_error *error, const char *message) {
  if (error) *error = (zeropayloadcheckedrecords_error){ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT;
}
static inline zeropayloadcheckedrecords_status lb_failure(zeropayloadcheckedrecords_error *error, const char *message) {
  if (error) *error = (zeropayloadcheckedrecords_error){ZEROPAYLOADCHECKEDRECORDS_ERROR_UNEXPECTED, message, strlen(message)};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
}
static inline zeropayloadcheckedrecords_status lb_ready(zeropayloadcheckedrecords_error *error) {
  return lean_bridge_native_component_ready("zeropayloadcheckedrecords@1.0.0")
    ? ZEROPAYLOADCHECKEDRECORDS_STATUS_OK : lb_failure(error, "Lean runtime is not ready or has been retired");
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

static inline int lb_copy_0_check(const zeropayloadcheckedrecords_witness *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_witness))) return 0;
  return 1;
}
static inline lean_object * lb_copy_0_in(const zeropayloadcheckedrecords_witness *value) {
  (void)value;
  return lb_t34d3e5dc58186a7e28fe_make(lean_box(0));
}
static inline int lb_copy_0_out(lean_object * value, zeropayloadcheckedrecords_witness *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_witness))) return 0;
  *out = (zeropayloadcheckedrecords_witness){0};
  return 1;
}

static inline int lb_copy_1_check(const zeropayloadcheckedrecords_nat *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_1_in(const zeropayloadcheckedrecords_nat *value) {
  (void)value;
  return lb_nat_in(value->data, value->length);
}
static inline int lb_copy_1_out(lean_object * value, zeropayloadcheckedrecords_nat *out, size_t *budget) {
  (void)value; (void)budget;
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(value, &data, &length, *budget);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (zeropayloadcheckedrecords_nat){data, length, data, free};
  return 1;
}

static inline int lb_copy_2_check(const zeropayloadcheckedrecords_mark *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_mark))) return 0;
  switch (value->kind) {
  case 0:
    break;
  case 1:
    if (!lb_copy_0_check(&value->cases.marked.witness, budget)) return 0;
    break;
  default: return 0;
  }
  return 1;
}
static inline lean_object * lb_copy_2_in(const zeropayloadcheckedrecords_mark *value) {
  (void)value;
  switch (value->kind) {
  case 0:
    return lb_tfb04270e7e168afb2516_make0(lean_box(0));
  case 1:
    return lb_tfb04270e7e168afb2516_make1(lb_copy_0_in(&value->cases.marked.witness));
  default: abort();
  }
}
static inline int lb_copy_2_out(lean_object * value, zeropayloadcheckedrecords_mark *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_mark))) return 0;
  lean_inc(value);
  uint32_t kind = lb_tfb04270e7e168afb2516_tag(value);
  if (kind >= 2) return -3;
  *out = (zeropayloadcheckedrecords_mark){0};
  out->kind = kind;
  switch (kind) {
  case 0: {
    break;
  }
  case 1: {
    lean_inc(value);
    lean_object * field0 = lb_tfb04270e7e168afb2516_get1_0(value);
    int status0 = lb_copy_0_out(field0, &out->cases.marked.witness, budget);
    lean_dec(field0);
    if (status0 != 1) { zeropayloadcheckedrecords_mark_clear(out); return status0; }
    break;
  }
  default: return -3;
  }
  return 1;
}

static inline int lb_copy_3_check(const zeropayloadcheckedrecords_marker *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_marker))) return 0;
  return 1;
}
static inline lean_object * lb_copy_3_in(const zeropayloadcheckedrecords_marker *value) {
  (void)value;
  return lb_tc0930e24985d380f1be0_make(lean_box(0));
}
static inline int lb_copy_3_out(lean_object * value, zeropayloadcheckedrecords_marker *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_marker))) return 0;
  *out = (zeropayloadcheckedrecords_marker){0};
  return 1;
}

static inline int lb_copy_4_check(const bool *value, size_t *budget) {
  (void)value; (void)budget;
  return 1;
}
static inline uint8_t lb_copy_4_in(const bool *value) {
  (void)value;
  return (uint8_t)*value;
}
static inline int lb_copy_4_out(uint8_t value, bool *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (bool)value;
  return 1;
}

static inline int lb_copy_5_check(const zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value))) return 0;
  if (value->has_value > 1) return 0;
  if (value->has_value && !lb_copy_0_check(&value->value, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_5_in(const zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value) {
  (void)value;
  return value->has_value ? lb_t69a9586cb343e910790a_some(lb_copy_0_in(&value->value)) : lb_t69a9586cb343e910790a_none(lean_box(0));
}
static inline int lb_copy_5_out(lean_object * value, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value))) return 0;
  *out = (zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value){0};
  lean_inc(value);
  out->has_value = lb_t69a9586cb343e910790a_has(value);
  if (out->has_value) {
  lean_inc(value);
  lean_object * field0 = lb_t69a9586cb343e910790a_get0(value);
  int status0 = lb_copy_0_out(field0, &out->value, budget);
  lean_dec(field0);
  if (status0 != 1) { zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(out); return status0; }
  }
  return 1;
}

static inline int lb_copy_6_check(const uint8_t *value, size_t *budget) {
  (void)value; (void)budget;
  if (*value != 0) return 0;
  return 1;
}
static inline lean_object * lb_copy_6_in(const uint8_t *value) {
  (void)value;
  return lean_box(0);
}
static inline int lb_copy_6_out(lean_object * value, uint8_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = 0;
  return 1;
}

static inline int lb_copy_7_check(const zeropayloadcheckedrecords_token *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_token))) return 0;
  if (1 && !lb_copy_6_check(&value->tag, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_7_in(const zeropayloadcheckedrecords_token *value) {
  (void)value;
  return lb_t57b6486affb0e5f49fdf_make(lb_copy_6_in(&value->tag));
}
static inline int lb_copy_7_out(lean_object * value, zeropayloadcheckedrecords_token *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(zeropayloadcheckedrecords_token))) return 0;
  *out = (zeropayloadcheckedrecords_token){0};
  lean_inc(value);
  lean_object * field0 = lb_t57b6486affb0e5f49fdf_get0(value);
  int status0 = lb_copy_6_out(field0, &out->tag, budget);
  lean_dec(field0);
  if (status0 != 1) { zeropayloadcheckedrecords_token_clear(out); return status0; }
  return 1;
}

typedef struct { size_t length; zeropayloadcheckedrecords_witness data[]; } lb_copy_8_owner;
static void lb_copy_8_release(void *raw) {
  lb_copy_8_owner *owner = raw;
  for (size_t i = 0; i < owner->length; ++i) zeropayloadcheckedrecords_witness_clear(&owner->data[i]);
  free(owner);
}
static inline int lb_copy_8_check(const zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, ((sizeof(zeropayloadcheckedrecords_witness) > sizeof(void *)) ? sizeof(zeropayloadcheckedrecords_witness) : sizeof(void *)))) return 0;
  for (size_t i = 0; i < value->length; ++i) if (!lb_copy_0_check(&value->data[i], budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_8_in(const zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value) {
  (void)value;
  lean_object *result = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, lb_copy_0_in(&value->data[i]));
  return result;
}
static inline int lb_copy_8_out(lean_object * value, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_array_size(value);
  if (!lb_charge(budget, length, ((sizeof(zeropayloadcheckedrecords_witness) > sizeof(void *)) ? sizeof(zeropayloadcheckedrecords_witness) : sizeof(void *))) || !lb_charge(budget, 1, sizeof(lb_copy_8_owner))) { return 0; }
  if (!length) { *out = (zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span){0}; return 1; }
  lb_copy_8_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(zeropayloadcheckedrecords_witness));
  if (!owner) { return -1; }
  owner->length = length;
  for (size_t i = 0; i < length; ++i) {
    int status = lb_copy_0_out(lean_array_get_core(value, i), &owner->data[i], budget);
    if (status != 1) { lb_copy_8_release(owner); return status; }
  }
  *out = (zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span){owner->data, length, owner, lb_copy_8_release};
  return 1;
}

static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}

static zeropayloadcheckedrecords_status lb_call_absent_count(void *context, const zeropayloadcheckedrecords_witness *arg0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_2e762f0a465455f60e6d2e91_refinement_0(lb_copy_0_in(arg0))) return lb_invalid(error, "arg0 was rejected by ZeroPayloadCheckedRecords.mkAbsent");
  lean_object *checked = lb_2e762f0a465455f60e6d2e91(lb_copy_0_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  zeropayloadcheckedrecords_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_nat_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_mark_count(void *context, const zeropayloadcheckedrecords_mark *arg0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_2_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (arg0->kind == 1u) {
  }
  if (arg0->kind == 1u) {
    if (!lb_8dde9faac3cf2ad062791db9_refinement_0_1_0(lb_copy_0_in((&arg0->cases.marked.witness)))) return lb_invalid(error, "arg0.marked.witness was rejected by ZeroPayloadCheckedRecords.mkWitness");
  }
  lean_object *checked = lb_8dde9faac3cf2ad062791db9(lb_copy_2_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  zeropayloadcheckedrecords_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_nat_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_marker_count(void *context, const zeropayloadcheckedrecords_marker *arg0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_3_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_51200de1ff13cece7733b1f1(lb_copy_3_in(arg0));
  zeropayloadcheckedrecords_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_nat_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_maybe_witness(void *context, bool arg0, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_4_check(&arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_cde1a97bb44e62e5508a2ab3(lb_copy_4_in(&arg0));
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value result = {0};
  int status = lb_copy_5_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_produce_mark(void *context, bool arg0, zeropayloadcheckedrecords_mark *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_4_check(&arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_3190b0fd601d06277d65cc15(lb_copy_4_in(&arg0));
  zeropayloadcheckedrecords_mark result = {0};
  int status = lb_copy_2_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_mark_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_produce_marker(void *context, zeropayloadcheckedrecords_marker *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_53d00d3f28c820ff014ddaab(lean_box(0));
  zeropayloadcheckedrecords_marker result = {0};
  int status = lb_copy_3_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_marker_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_produce_token(void *context, zeropayloadcheckedrecords_token *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_582f4605f271fe1a26173078(lean_box(0));
  zeropayloadcheckedrecords_token result = {0};
  int status = lb_copy_7_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_token_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_produce_witness(void *context, zeropayloadcheckedrecords_witness *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_e28f59b3ac170ab2f8d671cf(lean_box(0));
  zeropayloadcheckedrecords_witness result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_witness_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_token_tag(void *context, const zeropayloadcheckedrecords_token *arg0, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_7_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_8b1381b2213f3d87f755a4ae_refinement_0(lb_copy_7_in(arg0))) return lb_invalid(error, "arg0 was rejected by ZeroPayloadCheckedRecords.mkToken");
  lean_object *checked = lb_8b1381b2213f3d87f755a4ae(lb_copy_7_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  lean_dec(value); (void)budget;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_witness_count(void *context, const zeropayloadcheckedrecords_witness *arg0, zeropayloadcheckedrecords_nat *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_cbd016913ee33db9a876fa11_refinement_0(lb_copy_0_in(arg0))) return lb_invalid(error, "arg0 was rejected by ZeroPayloadCheckedRecords.mkWitness");
  lean_object *checked = lb_cbd016913ee33db9a876fa11(lb_copy_0_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  zeropayloadcheckedrecords_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_nat_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

static zeropayloadcheckedrecords_status lb_call_witnesses(void *context, const zeropayloadcheckedrecords_nat *arg0, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out, zeropayloadcheckedrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_77f288f49ad4518952eca999(lb_copy_1_in(arg0));
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span result = {0};
  int status = lb_copy_8_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status == -3) return lb_failure(error, "Invalid native variant result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != ZEROPAYLOADCHECKEDRECORDS_STATUS_OK) { zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(&result); return ZEROPAYLOADCHECKEDRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (zeropayloadcheckedrecords_error){0};
  return ZEROPAYLOADCHECKEDRECORDS_STATUS_OK;
}

extern lean_object *initialize_LeanBridgeNatived43d7c5a9f170f3c(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return initialize_LeanBridgeNatived43d7c5a9f170f3c(builtin); }
static zeropayloadcheckedrecords_status lb_runtime_initialize(void *context, zeropayloadcheckedrecords_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize("zeropayloadcheckedrecords@1.0.0", lb_initialize)
    ? ZEROPAYLOADCHECKEDRECORDS_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const zeropayloadcheckedrecords_runtime_v1 lb_runtime = {
  .abi_version = ZEROPAYLOADCHECKEDRECORDS_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
  .absent_count = lb_call_absent_count,
  .mark_count = lb_call_mark_count,
  .marker_count = lb_call_marker_count,
  .maybe_witness = lb_call_maybe_witness,
  .produce_mark = lb_call_produce_mark,
  .produce_marker = lb_call_produce_marker,
  .produce_token = lb_call_produce_token,
  .produce_witness = lb_call_produce_witness,
  .token_tag = lb_call_token_tag,
  .witness_count = lb_call_witness_count,
  .witnesses = lb_call_witnesses,

};
__attribute__((constructor)) static void lb_install(void) {
  (void)zeropayloadcheckedrecords_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach("zeropayloadcheckedrecords@1.0.0");
}
