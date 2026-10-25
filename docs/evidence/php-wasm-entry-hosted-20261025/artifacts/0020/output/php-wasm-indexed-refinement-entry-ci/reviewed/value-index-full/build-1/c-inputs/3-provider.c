#include "checkedrecordvalueindices_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>


static inline checkedrecordvalueindices_status lb_invalid(checkedrecordvalueindices_error *error, const char *message) {
  if (error) *error = (checkedrecordvalueindices_error){CHECKEDRECORDVALUEINDICES_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return CHECKEDRECORDVALUEINDICES_STATUS_INVALID_ARGUMENT;
}
static inline checkedrecordvalueindices_status lb_failure(checkedrecordvalueindices_error *error, const char *message) {
  if (error) *error = (checkedrecordvalueindices_error){CHECKEDRECORDVALUEINDICES_ERROR_UNEXPECTED, message, strlen(message)};
  return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
}
static inline checkedrecordvalueindices_status lb_ready(checkedrecordvalueindices_error *error) {
  return lean_bridge_native_component_ready("checkedrecordvalueindices@1.0.0")
    ? CHECKEDRECORDVALUEINDICES_STATUS_OK : lb_failure(error, "Lean runtime is not ready or has been retired");
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

static inline int lb_copy_0_check(const checkedrecordvalueindices_nat *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_0_in(const checkedrecordvalueindices_nat *value) {
  (void)value;
  return lb_nat_in(value->data, value->length);
}
static inline int lb_copy_0_out(lean_object * value, checkedrecordvalueindices_nat *out, size_t *budget) {
  (void)value; (void)budget;
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(value, &data, &length, *budget);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (checkedrecordvalueindices_nat){data, length, data, free};
  return 1;
}

static inline int lb_copy_1_check(const checkedrecordvalueindices_ab *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_ab))) return 0;
  if (1 && !lb_copy_0_check(&value->size, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_1_in(const checkedrecordvalueindices_ab *value) {
  (void)value;
  return lb_te6e782ea1d9b18dc3e44_make(lb_copy_0_in(&value->size));
}
static inline int lb_copy_1_out(lean_object * value, checkedrecordvalueindices_ab *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_ab))) return 0;
  *out = (checkedrecordvalueindices_ab){0};
  lean_inc(value);
  lean_object * field0 = lb_te6e782ea1d9b18dc3e44_get0(value);
  int status0 = lb_copy_0_out(field0, &out->size, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_ab_clear(out); return status0; }
  return 1;
}

typedef struct { size_t length; checkedrecordvalueindices_nat data[]; } lb_copy_2_owner;
static void lb_copy_2_release(void *raw) {
  lb_copy_2_owner *owner = raw;
  for (size_t i = 0; i < owner->length; ++i) checkedrecordvalueindices_nat_clear(&owner->data[i]);
  free(owner);
}
static inline int lb_copy_2_check(const checkedrecordvalueindices_array_nat_span *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, ((sizeof(checkedrecordvalueindices_nat) > sizeof(void *)) ? sizeof(checkedrecordvalueindices_nat) : sizeof(void *)))) return 0;
  for (size_t i = 0; i < value->length; ++i) if (!lb_copy_0_check(&value->data[i], budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_2_in(const checkedrecordvalueindices_array_nat_span *value) {
  (void)value;
  lean_object *result = lean_alloc_array(value->length, value->length);
  for (size_t i = 0; i < value->length; ++i) lean_array_set_core(result, i, lb_copy_0_in(&value->data[i]));
  return result;
}
static inline int lb_copy_2_out(lean_object * value, checkedrecordvalueindices_array_nat_span *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_array_size(value);
  if (!lb_charge(budget, length, ((sizeof(checkedrecordvalueindices_nat) > sizeof(void *)) ? sizeof(checkedrecordvalueindices_nat) : sizeof(void *))) || !lb_charge(budget, 1, sizeof(lb_copy_2_owner))) { return 0; }
  if (!length) { *out = (checkedrecordvalueindices_array_nat_span){0}; return 1; }
  lb_copy_2_owner *owner = calloc(1, sizeof(*owner) + length * sizeof(checkedrecordvalueindices_nat));
  if (!owner) { return -1; }
  owner->length = length;
  for (size_t i = 0; i < length; ++i) {
    int status = lb_copy_0_out(lean_array_get_core(value, i), &owner->data[i], budget);
    if (status != 1) { lb_copy_2_release(owner); return status; }
  }
  *out = (checkedrecordvalueindices_array_nat_span){owner->data, length, owner, lb_copy_2_release};
  return 1;
}

static inline int lb_copy_3_check(const checkedrecordvalueindices_empty_sized *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_empty_sized))) return 0;
  if (1 && !lb_copy_2_check(&value->data, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_3_in(const checkedrecordvalueindices_empty_sized *value) {
  (void)value;
  return lb_t97a1bccb66cfd61c7d52_make(lb_copy_2_in(&value->data));
}
static inline int lb_copy_3_out(lean_object * value, checkedrecordvalueindices_empty_sized *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_empty_sized))) return 0;
  *out = (checkedrecordvalueindices_empty_sized){0};
  lean_inc(value);
  lean_object * field0 = lb_t97a1bccb66cfd61c7d52_get0(value);
  int status0 = lb_copy_2_out(field0, &out->data, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_empty_sized_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_4_check(const checkedrecordvalueindices_empty_token *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_empty_token))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_4_in(const checkedrecordvalueindices_empty_token *value) {
  (void)value;
  return lb_t0ac37d04b2c3f2e53e25_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_4_out(lean_object * value, checkedrecordvalueindices_empty_token *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_empty_token))) return 0;
  *out = (checkedrecordvalueindices_empty_token){0};
  lean_inc(value);
  lean_object * field0 = lb_t0ac37d04b2c3f2e53e25_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_empty_token_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_5_check(const checkedrecordvalueindices_off *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_off))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_5_in(const checkedrecordvalueindices_off *value) {
  (void)value;
  return lb_ta9c042e57916781102d9_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_5_out(lean_object * value, checkedrecordvalueindices_off *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_off))) return 0;
  *out = (checkedrecordvalueindices_off){0};
  lean_inc(value);
  lean_object * field0 = lb_ta9c042e57916781102d9_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_off_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_6_check(const checkedrecordvalueindices_on *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_on))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_6_in(const checkedrecordvalueindices_on *value) {
  (void)value;
  return lb_td74f96c3ad55654fb4e2_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_6_out(lean_object * value, checkedrecordvalueindices_on *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_on))) return 0;
  *out = (checkedrecordvalueindices_on){0};
  lean_inc(value);
  lean_object * field0 = lb_td74f96c3ad55654fb4e2_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_on_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_7_check(const checkedrecordvalueindices_unicode_token *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_unicode_token))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_7_in(const checkedrecordvalueindices_unicode_token *value) {
  (void)value;
  return lb_ta8d5e8c0b6bc9e7e0253_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_7_out(lean_object * value, checkedrecordvalueindices_unicode_token *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_unicode_token))) return 0;
  *out = (checkedrecordvalueindices_unicode_token){0};
  lean_inc(value);
  lean_object * field0 = lb_ta8d5e8c0b6bc9e7e0253_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_unicode_token_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_8_check(const checkedrecordvalueindices_wide_token *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_wide_token))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_8_in(const checkedrecordvalueindices_wide_token *value) {
  (void)value;
  return lb_t15b03e27f4c8772be0ea_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_8_out(lean_object * value, checkedrecordvalueindices_wide_token *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_wide_token))) return 0;
  *out = (checkedrecordvalueindices_wide_token){0};
  lean_inc(value);
  lean_object * field0 = lb_t15b03e27f4c8772be0ea_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_wide_token_clear(out); return status0; }
  return 1;
}

static inline int lb_copy_9_check(const checkedrecordvalueindices_zero_token *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_zero_token))) return 0;
  if (1 && !lb_copy_0_check(&value->count, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_9_in(const checkedrecordvalueindices_zero_token *value) {
  (void)value;
  return lb_tcd43cc36cead5a0e3bc7_make(lb_copy_0_in(&value->count));
}
static inline int lb_copy_9_out(lean_object * value, checkedrecordvalueindices_zero_token *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(checkedrecordvalueindices_zero_token))) return 0;
  *out = (checkedrecordvalueindices_zero_token){0};
  lean_inc(value);
  lean_object * field0 = lb_tcd43cc36cead5a0e3bc7_get0(value);
  int status0 = lb_copy_0_out(field0, &out->count, budget);
  lean_dec(field0);
  if (status0 != 1) { checkedrecordvalueindices_zero_token_clear(out); return status0; }
  return 1;
}

static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}

static checkedrecordvalueindices_status lb_call_ab_string_index(void *context, const checkedrecordvalueindices_ab *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_aa7389f0b324bcc872e58eb7_refinement_0(lb_copy_1_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkAb");
  lean_object *checked = lb_aa7389f0b324bcc872e58eb7(lb_copy_1_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_empty_sized_index(void *context, const checkedrecordvalueindices_empty_sized *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_3_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_bc7bc77b17e26626a1e79470_refinement_0(lb_copy_3_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkEmptySized");
  lean_object *checked = lb_bc7bc77b17e26626a1e79470(lb_copy_3_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_empty_string_index(void *context, const checkedrecordvalueindices_empty_token *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_4_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_9317a25424a9625bb91b8651_refinement_0(lb_copy_4_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkEmptyToken");
  lean_object *checked = lb_9317a25424a9625bb91b8651(lb_copy_4_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_false_bool_index(void *context, const checkedrecordvalueindices_off *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_5_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_8171c54f4160a22ad89a1929_refinement_0(lb_copy_5_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkOff");
  lean_object *checked = lb_8171c54f4160a22ad89a1929(lb_copy_5_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_ab(void *context, checkedrecordvalueindices_ab *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_4d7bad0a7665bc1e177e4091(lean_box(0));
  checkedrecordvalueindices_ab result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_ab_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_empty_sized(void *context, checkedrecordvalueindices_empty_sized *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_2cb2ac73cad1bf0e92f223f2(lean_box(0));
  checkedrecordvalueindices_empty_sized result = {0};
  int status = lb_copy_3_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_empty_sized_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_empty_string(void *context, const checkedrecordvalueindices_nat *value0, checkedrecordvalueindices_empty_token *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_1c301039413f26b466ffc0ac(lb_copy_0_in(value0));
  checkedrecordvalueindices_empty_token result = {0};
  int status = lb_copy_4_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_empty_token_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_false_bool(void *context, checkedrecordvalueindices_off *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_4aa58b13819217d37533c8be(lean_box(0));
  checkedrecordvalueindices_off result = {0};
  int status = lb_copy_5_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_off_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_true_bool(void *context, checkedrecordvalueindices_on *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_fa4a826e4cfc4b858bea336d(lean_box(0));
  checkedrecordvalueindices_on result = {0};
  int status = lb_copy_6_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_on_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_unicode_string(void *context, const checkedrecordvalueindices_nat *value0, checkedrecordvalueindices_unicode_token *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_c3c99619aef987f5fd710b1d(lb_copy_0_in(value0));
  checkedrecordvalueindices_unicode_token result = {0};
  int status = lb_copy_7_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_unicode_token_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_wide_nat(void *context, const checkedrecordvalueindices_nat *value0, checkedrecordvalueindices_wide_token *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_ee4a5ad2bcd3cf6bb8065218(lb_copy_0_in(value0));
  checkedrecordvalueindices_wide_token result = {0};
  int status = lb_copy_8_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_wide_token_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_produce_zero_nat(void *context, const checkedrecordvalueindices_nat *value0, checkedrecordvalueindices_zero_token *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_de7d470e18379efff61de31b(lb_copy_0_in(value0));
  checkedrecordvalueindices_zero_token result = {0};
  int status = lb_copy_9_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_zero_token_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_true_bool_index(void *context, const checkedrecordvalueindices_on *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_6_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_d1b030ebab8bb6628451db44_refinement_0(lb_copy_6_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkOn");
  lean_object *checked = lb_d1b030ebab8bb6628451db44(lb_copy_6_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_unicode_string_index(void *context, const checkedrecordvalueindices_unicode_token *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_7_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_35b0d02ac4b5686e440a8198_refinement_0(lb_copy_7_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkUnicodeToken");
  lean_object *checked = lb_35b0d02ac4b5686e440a8198(lb_copy_7_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_wide_nat_index(void *context, const checkedrecordvalueindices_wide_token *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_8_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_629d14b28988602cba2f4f16_refinement_0(lb_copy_8_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkWideToken");
  lean_object *checked = lb_629d14b28988602cba2f4f16(lb_copy_8_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

static checkedrecordvalueindices_status lb_call_zero_nat_index(void *context, const checkedrecordvalueindices_zero_token *value0, checkedrecordvalueindices_nat *out, checkedrecordvalueindices_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_9_check(value0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_2ddd8644625ba5d077273f54_refinement_0(lb_copy_9_in(value0))) return lb_invalid(error, "value0 was rejected by CheckedRecordValueIndices.mkZeroToken");
  lean_object *checked = lb_2ddd8644625ba5d077273f54(lb_copy_9_in(value0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  checkedrecordvalueindices_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != CHECKEDRECORDVALUEINDICES_STATUS_OK) { checkedrecordvalueindices_nat_clear(&result); return CHECKEDRECORDVALUEINDICES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (checkedrecordvalueindices_error){0};
  return CHECKEDRECORDVALUEINDICES_STATUS_OK;
}

extern lean_object *initialize_LeanBridgeNative767c615eabad08d7(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return initialize_LeanBridgeNative767c615eabad08d7(builtin); }
static checkedrecordvalueindices_status lb_runtime_initialize(void *context, checkedrecordvalueindices_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize("checkedrecordvalueindices@1.0.0", lb_initialize)
    ? CHECKEDRECORDVALUEINDICES_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const checkedrecordvalueindices_runtime_v1 lb_runtime = {
  .abi_version = CHECKEDRECORDVALUEINDICES_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
  .ab_string_index = lb_call_ab_string_index,
  .empty_sized_index = lb_call_empty_sized_index,
  .empty_string_index = lb_call_empty_string_index,
  .false_bool_index = lb_call_false_bool_index,
  .produce_ab = lb_call_produce_ab,
  .produce_empty_sized = lb_call_produce_empty_sized,
  .produce_empty_string = lb_call_produce_empty_string,
  .produce_false_bool = lb_call_produce_false_bool,
  .produce_true_bool = lb_call_produce_true_bool,
  .produce_unicode_string = lb_call_produce_unicode_string,
  .produce_wide_nat = lb_call_produce_wide_nat,
  .produce_zero_nat = lb_call_produce_zero_nat,
  .true_bool_index = lb_call_true_bool_index,
  .unicode_string_index = lb_call_unicode_string_index,
  .wide_nat_index = lb_call_wide_nat_index,
  .zero_nat_index = lb_call_zero_nat_index,

};
__attribute__((constructor)) static void lb_install(void) {
  (void)checkedrecordvalueindices_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach("checkedrecordvalueindices@1.0.0");
}
