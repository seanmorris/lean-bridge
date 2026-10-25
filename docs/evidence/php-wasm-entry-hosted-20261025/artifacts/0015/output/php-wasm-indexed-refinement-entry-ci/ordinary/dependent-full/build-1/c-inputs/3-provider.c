#include "dependentrecords_runtime.h"
#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdlib.h>
#include <string.h>


static inline dependentrecords_status lb_invalid(dependentrecords_error *error, const char *message) {
  if (error) *error = (dependentrecords_error){DEPENDENTRECORDS_ERROR_INVALID_ARGUMENT, message, strlen(message)};
  return DEPENDENTRECORDS_STATUS_INVALID_ARGUMENT;
}
static inline dependentrecords_status lb_failure(dependentrecords_error *error, const char *message) {
  if (error) *error = (dependentrecords_error){DEPENDENTRECORDS_ERROR_UNEXPECTED, message, strlen(message)};
  return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR;
}
static inline dependentrecords_status lb_ready(dependentrecords_error *error) {
  return lean_bridge_native_component_ready("dependentrecords@1.0.0")
    ? DEPENDENTRECORDS_STATUS_OK : lb_failure(error, "Lean runtime is not ready or has been retired");
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

static inline int lb_copy_0_check(const dependentrecords_nat *value, size_t *budget) {
  (void)value; (void)budget;
  if ((value->length && !value->data) || !lb_charge(budget, value->length, sizeof(uint32_t))) return 0;
  return 1;
}
static inline lean_object * lb_copy_0_in(const dependentrecords_nat *value) {
  (void)value;
  return lb_nat_in(value->data, value->length);
}
static inline int lb_copy_0_out(lean_object * value, dependentrecords_nat *out, size_t *budget) {
  (void)value; (void)budget;
  uint32_t *data = NULL; size_t length = 0;
  int status = lb_nat_out(value, &data, &length, *budget);
  if (status != 1) return status;
  *budget -= length * sizeof(uint32_t);
  *out = (dependentrecords_nat){data, length, data, free};
  return 1;
}

static inline int lb_copy_1_check(const dependentrecords_dependent *value, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(dependentrecords_dependent))) return 0;
  if (1 && !lb_copy_0_check(&value->bound, budget)) return 0;
  if (1 && !lb_copy_0_check(&value->below, budget)) return 0;
  return 1;
}
static inline lean_object * lb_copy_1_in(const dependentrecords_dependent *value) {
  (void)value;
  return lb_t9c7fb003d50bbc5bd05d_make(lb_copy_0_in(&value->bound), lb_copy_0_in(&value->below));
}
static inline int lb_copy_1_out(lean_object * value, dependentrecords_dependent *out, size_t *budget) {
  (void)value; (void)budget;
  if (!lb_charge(budget, 1, sizeof(dependentrecords_dependent))) return 0;
  *out = (dependentrecords_dependent){0};
  lean_inc(value);
  lean_object * field0 = lb_t9c7fb003d50bbc5bd05d_get0(value);
  int status0 = lb_copy_0_out(field0, &out->bound, budget);
  lean_dec(field0);
  if (status0 != 1) { dependentrecords_dependent_clear(out); return status0; }
  lean_inc(value);
  lean_object * field1 = lb_t9c7fb003d50bbc5bd05d_get1(value);
  int status1 = lb_copy_0_out(field1, &out->below, budget);
  lean_dec(field1);
  if (status1 != 1) { dependentrecords_dependent_clear(out); return status1; }
  return 1;
}

static inline int lb_fin_below(const uint32_t *data, size_t length, const uint32_t *bound, size_t bound_length) {
  while (length && data[length - 1] == 0) --length;
  if (length != bound_length) return length < bound_length;
  while (length--) if (data[length] != bound[length]) return data[length] < bound[length];
  return 0;
}

static dependentrecords_status lb_call_dependent_result(void *context, const dependentrecords_nat *arg0, dependentrecords_dependent *out, dependentrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_0_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  lean_object * value = lb_e59e187300c993f56dccdfb9(lb_copy_0_in(arg0));
  dependentrecords_dependent result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) { dependentrecords_dependent_clear(&result); return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (dependentrecords_error){0};
  return DEPENDENTRECORDS_STATUS_OK;
}

static dependentrecords_status lb_call_dependent_roundtrip(void *context, const dependentrecords_dependent *arg0, dependentrecords_dependent *out, dependentrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_5c4342be8d065a841e1981ff_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by DependentRecords.mkDependent");
  lean_object *checked = lb_5c4342be8d065a841e1981ff(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  dependentrecords_dependent result = {0};
  int status = lb_copy_1_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) { dependentrecords_dependent_clear(&result); return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (dependentrecords_error){0};
  return DEPENDENTRECORDS_STATUS_OK;
}

static dependentrecords_status lb_call_dependent_total(void *context, const dependentrecords_dependent *arg0, dependentrecords_nat *out, dependentrecords_error *error) {
  (void)context; size_t budget = 16u * 1024u * 1024u;
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR;
  if (!lb_copy_1_check(arg0, &budget)) return lb_invalid(error, "Invalid copied input or 16 MiB call limit exceeded");
  if (!lb_6742bb14f123c11405a71a1d_refinement_0(lb_copy_1_in(arg0))) return lb_invalid(error, "arg0 was rejected by DependentRecords.mkDependent");
  lean_object *checked = lb_6742bb14f123c11405a71a1d(lb_copy_1_in(arg0));
  if (lean_is_scalar(checked)) return lb_invalid(error, "Lean rejected an argument outside its checked refinement");
  lean_object *boxed = lean_ctor_get(checked, 0);
  lean_inc(boxed);
  lean_object * value = boxed;
  lean_dec(checked);
  dependentrecords_nat result = {0};
  int status = lb_copy_0_out(value, &result, &budget);
  lean_dec(value);
  if (status == 0) return lb_invalid(error, "16 MiB call limit exceeded");
  if (status == -2) return lb_failure(error, "Invalid native Unicode scalar result");
  if (status < 0) return lb_failure(error, "Cannot allocate copied result");
  if (lb_ready(error) != DEPENDENTRECORDS_STATUS_OK) { dependentrecords_nat_clear(&result); return DEPENDENTRECORDS_STATUS_UNEXPECTED_ERROR; }
  *out = result;
  if (error) *error = (dependentrecords_error){0};
  return DEPENDENTRECORDS_STATUS_OK;
}

extern lean_object *initialize_LeanBridgeNativeca8ca903379eb247(uint8_t builtin);
static void *lb_initialize(uint8_t builtin) { return initialize_LeanBridgeNativeca8ca903379eb247(builtin); }
static dependentrecords_status lb_runtime_initialize(void *context, dependentrecords_error *error) {
  (void)context;
  return lean_bridge_native_component_initialize("dependentrecords@1.0.0", lb_initialize)
    ? DEPENDENTRECORDS_STATUS_OK : lb_failure(error, "Lean runtime initialization failed");
}
static const dependentrecords_runtime_v1 lb_runtime = {
  .abi_version = DEPENDENTRECORDS_BINDING_ABI_VERSION, .context = NULL,
  .initialize = lb_runtime_initialize,
  .dependent_result = lb_call_dependent_result,
  .dependent_roundtrip = lb_call_dependent_roundtrip,
  .dependent_total = lb_call_dependent_total,

};
__attribute__((constructor)) static void lb_install(void) {
  (void)dependentrecords_runtime_install_v1(&lb_runtime, NULL);
}
__attribute__((destructor)) static void lb_detach(void) {
  lean_bridge_native_component_detach("dependentrecords@1.0.0");
}
