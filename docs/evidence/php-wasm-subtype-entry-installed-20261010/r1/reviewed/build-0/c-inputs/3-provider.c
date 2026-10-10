#include "subtypes_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>


static inline subtypes_status lb_invalid(subtypes_error *error, const char *message) {
  if (error) *error = (subtypes_error){SUBTYPES_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return SUBTYPES_STATUS_INVALID_ARGUMENT;
}
static inline subtypes_status lb_failure(subtypes_error *error, const char *message) {
  if (error) *error = (subtypes_error){SUBTYPES_ERROR_UNEXPECTED, message, strlen(message)};
  return SUBTYPES_STATUS_UNEXPECTED_ERROR;
}
static inline subtypes_status lb_ready(subtypes_error *error) {
  return lean_bridge_native_component_ready("subtypes@1.0.0")
    ? SUBTYPES_STATUS_OK : lb_failure(error, "Lean runtime is not ready or has been retired");
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
  return 1;
}
static inline uint8_t lb_copy_0_in(const uint8_t *value) {
  (void)value;
  return (uint8_t)*value;
}
static inline int lb_copy_0_out(uint8_t value, uint8_t *out, size_t *budget) {
  (void)value; (void)budget;
  *out = (uint8_t)value;
  return 1;
}

static inline int lb_copy_1_check(const subtypes_nat *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_1_in(const subtypes_nat *value) {
  (void)value;
  return lb_nat_in(value->data, value->length);
}
static inline int lb_copy_1_out(lean_object * value, subtypes_nat *out, size_t *budget) {
  (void)value; (void)budget;
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(value, &data, &length, *budget);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (subtypes_nat){data, length, data, free};
  return 1;
}

static inline int lb_copy_2_check(const subtypes_bytes *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, 1)) return 0;
  return 1;
}
static inline lean_object * lb_copy_2_in(const subtypes_bytes *value) {
  (void)value;
  return lb_bytes_in(value->data, value->length);
}
static inline int lb_copy_2_out(lean_object * value, subtypes_bytes *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_sarray_size(value);
  if (!lb_charge(budget, length, 1)) return 0;
  void *data = length ? malloc(length) : NULL;
  if (length && !data) return -1;
  if (length) memcpy(data, lean_sarray_cptr(value), length);
  *out = (subtypes_bytes){data, length, data, free};
  return 1;
}

static inline int lb_copy_3_check(const subtypes_string *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, 1)) return 0;
  if (!lb_utf8((const uint8_t *)value->data, value->length)) return 0;
  return 1;
}
static inline lean_object * lb_copy_3_in(const subtypes_string *value) {
  (void)value;
  return lean_mk_string_from_bytes(value->length ? value->data : "", value->length);
}
static inline int lb_copy_3_out(lean_object * value, subtypes_string *out, size_t *budget) {
  (void)value; (void)budget;
  size_t length = lean_string_size(value) - 1;
  if (!lb_charge(budget, length, 1)) return 0;
  void *data = length ? malloc(length) : NULL;
  if (length && !data) return -1;
  if (length) memcpy(data, lean_string_cstr(value), length);
  *out = (subtypes_string){data, length, data, free};
  return 1;
}

static inline int lb_copy_4_check(const subtypes_int *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_4_in(const subtypes_int *value) {
  (void)value;
  return lb_int_in(value->data, value->length, value->negative);
}
static inline int lb_copy_4_out(lean_object * value, subtypes_int *out, size_t *budget) {
  (void)value; (void)budget;
  bool negative = lean_int_lt(value, lean_box(0));
  lean_object *magnitude = lean_nat_abs(value);
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(magnitude, &data, &length, *budget);
  lean_dec(magnitude);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (subtypes_int){data, length, data, free, negative};
  return 1;
}

static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}
static const uint32_t lb_fin_mix_1[1] = {0xau};

static subtypes_status lb_call_byte(void *context, uint8_t arg0, uint8_t *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(&arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_6815c3e5d952f60b3136d82d_refinement_0(lb_copy_0_in(&arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedByte");
  lean_object *checked = lb_6815c3e5d952f60b3136d82d(lb_copy_0_in(&arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  uint8_t value = (uint8_t)lean_unbox(boxed);
  lean_dec(checked);
  uint8_t result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_clamp(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_c91ef75f139613c4dde809e0_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedBounded");
  lean_object *checked = lb_c91ef75f139613c4dde809e0(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_first_even(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_9bb269bf43e5265e28a853e1_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedEven");
  lean_object *checked = lb_9bb269bf43e5265e28a853e1(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_half(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_91473598b255f6e5c1372d98_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedEven");
  lean_object *checked = lb_91473598b255f6e5c1372d98(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_head(void *context, const subtypes_bytes *arg0, uint8_t *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_2_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_1886f5b34ac04df8628c9301_refinement_0(lb_copy_2_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedPayload");
  lean_object *checked = lb_1886f5b34ac04df8628c9301(lb_copy_2_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  uint8_t value = (uint8_t)lean_unbox(boxed);
  lean_dec(checked);
  uint8_t result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_join(void *context, const subtypes_string *arg0, const subtypes_string *arg1, subtypes_string *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_3_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_copy_3_check(arg1, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_9205887c464685a24bd748da_refinement_0(lb_copy_3_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedWord");
  if (!lb_9205887c464685a24bd748da_refinement_1(lb_copy_3_in(arg1))) return lb_invalid(error, "arg1 was rejected by Subtypes.checkedWord");
  lean_object *checked = lb_9205887c464685a24bd748da(lb_copy_3_in(arg0), lb_copy_3_in(arg1));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_string result = {0};
  int status = lb_copy_3_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_string_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_mix(void *context, const subtypes_nat *arg0, const subtypes_nat *arg1, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_copy_1_check(arg1, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fin_below(arg1->data, arg1->length, lb_fin_mix_1, 1)) return lb_invalid(error, "arg1 is not below its Fin 10 bound");
  if (!lb_208c4c169dd06ab4d3767757_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedEven");
  lean_object *checked = lb_208c4c169dd06ab4d3767757(lb_copy_1_in(arg0), lb_copy_1_in(arg1));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its Fin bound");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_pad(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_726954a7fecd6b63c462c2e2(lb_copy_1_in(arg0));
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_scale(void *context, const subtypes_int *arg0, const subtypes_int *arg1, subtypes_int *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_4_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_copy_4_check(arg1, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_fa19a195ff9ce74a4b7afc1d_refinement_1(lb_copy_4_in(arg1))) return lb_invalid(error, "arg1 was rejected by Subtypes.checkedSmall");
  lean_object *checked = lb_fa19a195ff9ce74a4b7afc1d(lb_copy_4_in(arg0), lb_copy_4_in(arg1));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_int result = {0};
  int status = lb_copy_4_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_int_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_second_even(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_a5a1d2658399cacb73553f8b_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.normalizedEven");
  lean_object *checked = lb_a5a1d2658399cacb73553f8b(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_shout(void *context, const subtypes_string *arg0, subtypes_string *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_3_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_80fdcaaaf560c424e720029c_refinement_0(lb_copy_3_in(arg0))) return lb_invalid(error, "arg0 was rejected by Subtypes.checkedWord");
  lean_object *checked = lb_80fdcaaaf560c424e720029c(lb_copy_3_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  subtypes_string result = {0};
  int status = lb_copy_3_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_string_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_unrestricted(void *context, const subtypes_nat *arg0, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_1fd7234bf1e157d167e32146(lb_copy_1_in(arg0));
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

static subtypes_status lb_call_zero_even(void *context, subtypes_nat *out, subtypes_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != SUBTYPES_STATUS_OK) return SUBTYPES_STATUS_UNEXPECTED_ERROR;
  lean_object * value = lb_c467ef12fd0e27374fac8f55(lean_box(0));
  subtypes_nat result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != SUBTYPES_STATUS_OK) { subtypes_nat_clear(&result); return SUBTYPES_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (subtypes_error){0};
  return SUBTYPES_STATUS_OK;
}

extern lean_object *initialize_LeanBridgeNative9da28bcf49ab7dd6(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return initialize_LeanBridgeNative9da28bcf49ab7dd6(builtin); }
static subtypes_status lb_runtime_initialize(void *context, subtypes_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize("subtypes@1.0.0", lb_initialize)
    ? SUBTYPES_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const subtypes_runtime_v1 lb_runtime = {
  .abi_version = SUBTYPES_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
  .byte = lb_call_byte,
  .clamp = lb_call_clamp,
  .first_even = lb_call_first_even,
  .half = lb_call_half,
  .head = lb_call_head,
  .join = lb_call_join,
  .mix = lb_call_mix,
  .pad = lb_call_pad,
  .scale = lb_call_scale,
  .second_even = lb_call_second_even,
  .shout = lb_call_shout,
  .unrestricted = lb_call_unrestricted,
  .zero_even = lb_call_zero_even,

};
__attribute__((constructor)) static void lb_install(void) {
  (void)subtypes_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach("subtypes@1.0.0");
}
