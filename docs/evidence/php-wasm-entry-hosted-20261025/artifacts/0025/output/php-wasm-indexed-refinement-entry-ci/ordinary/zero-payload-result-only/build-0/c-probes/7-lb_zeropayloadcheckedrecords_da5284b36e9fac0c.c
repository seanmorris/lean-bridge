#include <stdio.h>
static void lb_probe_end(const char **label) { fprintf(stderr, "LB_SUBTYPE_ENTRY_V1 end public %s\n", *label); }
#include <php.h>
#include <limits.h>
#include <Zend/zend_exceptions.h>
#include "zeropayloadcheckedrecords.h"

_Static_assert(sizeof(zend_long) * CHAR_BIT == 32, "PHP integer width differs from the generated adapter");
_Static_assert(sizeof(bool) == sizeof(unsigned char), "Bool wire markers require one byte");
#if PHP_VERSION_ID < 80200 || PHP_VERSION_ID >= 90000
#error This adapter requires PHP 8.2 through 8.x
#endif
#ifdef ZTS
#error This adapter requires a non-thread-safe PHP runtime
#endif

#include <inttypes.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>

#ifndef LB_ZEND_CALLOC
#define LB_ZEND_CALLOC calloc
#endif
#ifndef LB_ZEND_FREE
#define LB_ZEND_FREE free
#endif

typedef struct lb_block { struct lb_block *next; void *data; } lb_block;
typedef struct {
  size_t remaining;
  lb_block *blocks;
  const char *error;
  int type_error;
} lb_scope;

static int lb_fail(lb_scope *s, const char *message, int type_error) {
  if (!s->error) { s->error = message; s->type_error = type_error; }
  return 0;
}
static int lb_charge(lb_scope *s, size_t count, size_t width) {
  if (!width || count > s->remaining / width)
    return lb_fail(s, "16 MiB Zend conversion limit exceeded", 0);
  s->remaining -= count * width;
  return 1;
}
static int lb_readable(lb_scope *s, const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return 1;
  if (!data || !width || !alignment || count > SIZE_MAX / width)
    return lb_fail(s, "Invalid native output buffer", 0);
  if ((uintptr_t)data % alignment)
    return lb_fail(s, "Misaligned native output buffer", 0);
#ifdef __wasm__
  if ((uint64_t)(uintptr_t)data + (uint64_t)count * width > (uint64_t)__builtin_wasm_memory_size(0) * 65536)
    return lb_fail(s, "Native output buffer exceeds Wasm memory", 0);
#endif
  return 1;
}
static void *lb_allocate(lb_scope *s, size_t count, size_t width) {
  if (!lb_charge(s, count ? count : 1, width) || !lb_charge(s, 1, sizeof(lb_block))) return NULL;
  lb_block *block = LB_ZEND_CALLOC(1, sizeof(*block));
  void *data = block ? LB_ZEND_CALLOC(count ? count : 1, width) : NULL;
  if (!data) { LB_ZEND_FREE(block); lb_fail(s, "Zend conversion allocation failed", 0); return NULL; }
  block->data = data; block->next = s->blocks; s->blocks = block;
  return data;
}
static void lb_scope_clear(lb_scope *s) {
  while (s->blocks) {
    lb_block *block = s->blocks; s->blocks = block->next;
    LB_ZEND_FREE(block->data); LB_ZEND_FREE(block);
  }
}
static int lb_utf8(const unsigned char *p, size_t n) {
  size_t i = 0;
  while (i < n) {
    unsigned a = p[i++], c = 0, minimum = 0, rest = 0;
    if (a < 128) continue;
    if (a >= 0xc2 && a <= 0xdf) { c = a & 31; minimum = 0x80; rest = 1; }
    else if (a >= 0xe0 && a <= 0xef) { c = a & 15; minimum = 0x800; rest = 2; }
    else if (a >= 0xf0 && a <= 0xf4) { c = a & 7; minimum = 0x10000; rest = 3; }
    else return 0;
    if (rest > n - i) return 0;
    while (rest--) { unsigned b = p[i++]; if ((b & 0xc0) != 0x80) return 0; c = (c << 6) | (b & 63); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return 0;
  }
  return 1;
}
static inline int lb_char_in(const unsigned char *text, size_t length, uint32_t *out) {
  if (!length || length > 4 || !lb_utf8(text, length)) return 0;
  size_t expected = text[0] < 128 ? 1 : text[0] < 0xe0 ? 2 : text[0] < 0xf0 ? 3 : 4;
  if (length != expected) return 0;
  uint32_t point = text[0] & (length == 1 ? 127 : length == 2 ? 31 : length == 3 ? 15 : 7);
  for (size_t i = 1; i < length; i++) point = (point << 6) | (text[i] & 63);
  *out = point; return 1;
}
static inline size_t lb_char_out(uint32_t point, char *text) {
  if (point < 128) { text[0] = (char)point; return 1; }
  size_t length = point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  for (size_t i = length - 1; i > 0; i--) { text[i] = (char)(0x80 | (point & 63)); point >>= 6; }
  text[0] = (char)((length == 2 ? 0xc0 : length == 3 ? 0xe0 : 0xf0) | point); return length;
}
static int lb_decimal(zval *value, lb_scope *s, const char **digits, size_t *length, bool *negative) {
  if (Z_TYPE_P(value) != IS_STRING) return lb_fail(s, "Expected canonical decimal text", 1);
  const char *text = Z_STRVAL_P(value); size_t n = Z_STRLEN_P(value);
  if (!lb_charge(s, n, 1)) return 0;
  bool sign = n && text[0] == '-';
  if (sign) { text++; n--; }
  if (!n || n > 16384 || (text[0] == '0' && (n != 1 || sign)))
    return lb_fail(s, "Expected canonical decimal text of at most 16384 digits", 0);
  for (size_t i = 0; i < n; i++) if (text[i] < '0' || text[i] > '9')
    return lb_fail(s, "Expected canonical decimal text", 0);
  *digits = text; *length = n; *negative = sign; return 1;
}
static int lb_u64_in(zval *value, lb_scope *s, uint64_t *out, bool signed_value, unsigned bits) {
  const char *digits; size_t n; bool negative;
  if (!lb_decimal(value, s, &digits, &n, &negative)) return 0;
  if (negative && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  uint64_t limit = signed_value ? (negative ? UINT64_C(9223372036854775808) : INT64_MAX)
    : bits == 32 ? UINT32_MAX : UINT64_MAX;
  uint64_t magnitude = 0;
  for (size_t i = 0; i < n; i++) {
    unsigned digit = (unsigned)(digits[i] - '0');
    if (magnitude > (limit - digit) / 10) return lb_fail(s, "Integer is outside the declared Lean range", 0);
    magnitude = magnitude * 10 + digit;
  }
  *out = negative ? UINT64_C(0) - magnitude : magnitude; return 1;
}
static int lb_big_in(zval *value, lb_scope *s, uint32_t **out, size_t *length, bool *negative, bool signed_value) {
  const char *digits; size_t n; bool sign;
  if (!lb_decimal(value, s, &digits, &n, &sign)) return 0;
  if (sign && !signed_value) return lb_fail(s, "Expected an unsigned integer", 0);
  size_t capacity = n / 9 + 1, count = 0;
  uint32_t *words = lb_allocate(s, capacity, sizeof(uint32_t));
  if (!words) return 0;
  for (size_t offset = 0; offset < n;) {
    size_t width = (n - offset) % 9; if (!width) width = 9;
    uint64_t carry = 0, base = 1;
    for (size_t i = 0; i < width; i++) { carry = carry * 10 + (unsigned)(digits[offset++] - '0'); base *= 10; }
    for (size_t i = 0; i < count; i++) { uint64_t v = (uint64_t)words[i] * base + carry; words[i] = (uint32_t)v; carry = v >> 32; }
    if (carry) words[count++] = (uint32_t)carry;
  }
  *out = words; *length = count; *negative = sign; return 1;
}
static int lb_big_out(const uint32_t *words, size_t length, bool negative, zval *out, lb_scope *s) {
  if (length > 1701 || (!length && negative))
    return lb_fail(s, "Invalid or excessive big integer output", 0);
  if (!lb_readable(s, words, length, sizeof(*words), _Alignof(uint32_t))) return 0;
  if (length && !words[length - 1]) return lb_fail(s, "Noncanonical big integer output", 0);
  if (!lb_charge(s, length, sizeof(uint32_t))) return 0;
  uint32_t *chunks = lb_allocate(s, length * 2 + 1, sizeof(uint32_t));
  if (!chunks) return 0;
  size_t count = 0;
  for (size_t index = length; index > 0; index--) {
    uint64_t carry = words[index - 1];
    for (size_t i = 0; i < count; i++) {
      uint64_t v = (uint64_t)chunks[i] * UINT64_C(4294967296) + carry;
      chunks[i] = (uint32_t)(v % 1000000000); carry = v / 1000000000;
    }
    while (carry) { chunks[count++] = (uint32_t)(carry % 1000000000); carry /= 1000000000; }
  }
  size_t capacity = count * 9 + 2;
  char *text = lb_allocate(s, capacity, 1); if (!text) return 0;
  size_t used = negative ? 1 : 0; if (negative) text[0] = '-';
  used += (size_t)snprintf(text + used, capacity - used, "%" PRIu32, count ? chunks[--count] : 0);
  while (count) used += (size_t)snprintf(text + used, capacity - used, "%09" PRIu32, chunks[--count]);
  if (used - (negative ? 1 : 0) > 16384) return lb_fail(s, "BigInteger decimal conversion limit exceeded", 0);
  if (!lb_charge(s, used, 1)) return 0;
  ZVAL_STRINGL(out, text, used); return 1;
}

static int lb_to0(zval *value, bool *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_TRUE && Z_TYPE_P(value) != IS_FALSE) return lb_fail(s, "Bool requires bool", 1);
  *out = Z_TYPE_P(value) == IS_TRUE;
  return 1;
}
static int lb_from0(const bool *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  unsigned char raw; memcpy(&raw, value, sizeof(raw));
  if (raw > 1) return lb_fail(s, "Invalid native Bool marker", 0);
  ZVAL_BOOL(out, raw);
  return 1;
}

static int lb_to1(zval *value, zeropayloadcheckedrecords_witness *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 0) return lb_fail(s, "Record wire field count differs", 0);
  out->empty = 0;
  return 1;
}
static int lb_from1(const zeropayloadcheckedrecords_witness *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 0, 32)) return 0;
  array_init_size(out, 0);
  (void)value;
  return 1;
}

static int lb_to2(zval *value, zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) == IS_NULL) { out->has_value = 0; return 1; }
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Option wire requires null or one payload", 1);
  if (!lb_charge(s, 1, 32)) return 0;
  out->has_value = 1;
  if (!lb_to1(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->value, s)) return 0;
  return 1;
}
static int lb_from2(const zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->has_value > 1) return lb_fail(s, "Invalid native Option flag", 0);
  if (!value->has_value) { ZVAL_NULL(out); return 1; }
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item; ZVAL_NULL(&item);
  if (!lb_from1(&value->value, &item, s)) { zval_ptr_dtor(&item); return 0; }
  add_next_index_zval(out, &item);
  return 1;
}

static int lb_to3(zval *value, zeropayloadcheckedrecords_mark *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value)) || zend_hash_num_elements(Z_ARRVAL_P(value)) < 1) return lb_fail(s, "Variant wire requires a constructor tag and fields", 1);
  zval *tag = zend_hash_index_find(Z_ARRVAL_P(value), 0); ZVAL_DEREF(tag);
  if (Z_TYPE_P(tag) != IS_LONG) return lb_fail(s, "Variant wire tag requires int", 1);
  if (Z_LVAL_P(tag) < 0 || (uint64_t)Z_LVAL_P(tag) >= 2) return lb_fail(s, "Invalid variant wire constructor", 0);
  out->kind = (uint32_t)Z_LVAL_P(tag);
  switch (out->kind) {
  case 0: {
    if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Variant wire field count differs", 0);
    if (!lb_charge(s, 1, 32)) return 0;
    break;
  }
  case 1: {
    if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 2) return lb_fail(s, "Variant wire field count differs", 0);
    if (!lb_charge(s, 2, 32)) return 0;
    if (!lb_to1(zend_hash_index_find(Z_ARRVAL_P(value), 1), &out->cases.marked.witness, s)) return 0;
    break;
  }
  }
  return 1;
}
static int lb_from3(const zeropayloadcheckedrecords_mark *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (value->kind >= 2) return lb_fail(s, "Invalid native variant constructor", 0);
  switch (value->kind) {
  case 0: {
    if (!lb_charge(s, 1, 32)) return 0;
    array_init_size(out, 1);
    add_next_index_long(out, 0);
    break;
  }
  case 1: {
    if (!lb_charge(s, 2, 32)) return 0;
    array_init_size(out, 2);
    add_next_index_long(out, 1);
    zval item0; ZVAL_NULL(&item0);
    if (!lb_from1(&value->cases.marked.witness, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
    add_next_index_zval(out, &item0);
    break;
  }
  }
  return 1;
}

static int lb_to4(zval *value, zeropayloadcheckedrecords_marker *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 0) return lb_fail(s, "Record wire field count differs", 0);
  out->empty = 0;
  return 1;
}
static int lb_from4(const zeropayloadcheckedrecords_marker *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 0, 32)) return 0;
  array_init_size(out, 0);
  (void)value;
  return 1;
}

static int lb_to5(zval *value, uint8_t *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_NULL) return lb_fail(s, "Unit requires null", 1);
  *out = 0;
  return 1;
}
static int lb_from5(const uint8_t *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (*value != 0) return lb_fail(s, "Invalid native Unit marker", 0);
  ZVAL_NULL(out);
  return 1;
}

static int lb_to6(zval *value, zeropayloadcheckedrecords_token *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  if (zend_hash_num_elements(Z_ARRVAL_P(value)) != 1) return lb_fail(s, "Record wire field count differs", 0);
  if (!lb_to5(zend_hash_index_find(Z_ARRVAL_P(value), 0), &out->tag, s)) return 0;
  return 1;
}
static int lb_from6(const zeropayloadcheckedrecords_token *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, 1, 32)) return 0;
  array_init_size(out, 1);
  zval item0; ZVAL_NULL(&item0);
  if (!lb_from5(&value->tag, &item0, s)) { zval_ptr_dtor(&item0); return 0; }
  add_next_index_zval(out, &item0);
  return 1;
}

static int lb_to7(zval *value, zeropayloadcheckedrecords_nat *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  uint32_t *words; bool negative; if (!lb_big_in(value, s, &words, &out->length, &negative, false)) return 0;
  out->data = words;
  return 1;
}
static int lb_from7(const zeropayloadcheckedrecords_nat *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  return lb_big_out(value->data, value->length, false, out, s);
  return 1;
}

static int lb_to8(zval *value, zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *out, lb_scope *s) {
  ZVAL_DEREF(value);
  if (!lb_charge(s, 1, 16)) return 0;
  if (Z_TYPE_P(value) != IS_ARRAY || !zend_array_is_list(Z_ARRVAL_P(value))) return lb_fail(s, "Expected a consecutive-key wire list", 1);
  size_t count = zend_hash_num_elements(Z_ARRVAL_P(value));
  if (!lb_charge(s, count, 32)) return 0;
  zeropayloadcheckedrecords_witness *data = lb_allocate(s, count, sizeof(*data)); if (!data) return 0;
  out->data = data; out->length = count;
  for (size_t i = 0; i < count; i++) if (!lb_to1(zend_hash_index_find(Z_ARRVAL_P(value), i), &data[i], s)) return 0;
  return 1;
}
static int lb_from8(const zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span *value, zval *out, lb_scope *s) {
  if (!lb_charge(s, 1, 16)) return 0;
  if (!lb_charge(s, value->length, 32) || (value->length && !value->data)) return lb_fail(s, "Invalid array output", 0);
  if (value->length && (uintptr_t)value->data % _Alignof(zeropayloadcheckedrecords_witness)) return lb_fail(s, "Misaligned sequence output", 0);
  #ifdef __wasm__
  if (value->length && ((uint64_t)(uintptr_t)value->data + (uint64_t)value->length * sizeof(*value->data) > (uint64_t)__builtin_wasm_memory_size(0) * 65536)) return lb_fail(s, "Sequence output exceeds Wasm memory", 0);
  #endif
  array_init_size(out, (uint32_t)value->length);
  for (size_t i = 0; i < value->length; i++) {
    zval item; ZVAL_NULL(&item);
    if (!lb_from1(&value->data[i], &item, s)) { zval_ptr_dtor(&item); return 0; }
    add_next_index_zval(out, &item);
  }
  return 1;
}
typedef struct {
  lb_scope scope;
  bool input0;
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context0;
static void lb_cleanup0(lb_context0 *ctx) {
  zeropayloadcheckedrecords_option_lean_zero_payload_checked_records_witness_value_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute0(lb_context0 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = zeropayloadcheckedrecords_maybe_witness(ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from2(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args0, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call0) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "maybeWitness";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public maybeWitness\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context0) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context0 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute0(ctx, args, return_value); }
  zend_catch { lb_cleanup0(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup0(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  bool input0;
  zeropayloadcheckedrecords_mark output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context1;
static void lb_cleanup1(lb_context1 *ctx) {
  zeropayloadcheckedrecords_mark_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute1(lb_context1 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to0(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = zeropayloadcheckedrecords_produce_mark(ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from3(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args1, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call1) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "produceMark";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public produceMark\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context1) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context1 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute1(ctx, args, return_value); }
  zend_catch { lb_cleanup1(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup1(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  
  zeropayloadcheckedrecords_marker output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context2;
static void lb_cleanup2(lb_context2 *ctx) {
  zeropayloadcheckedrecords_marker_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute2(lb_context2 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = zeropayloadcheckedrecords_produce_marker(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from4(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args2, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call2) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "produceMarker";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public produceMarker\n", stderr);

  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context2) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context2 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute2(ctx, args, return_value); }
  zend_catch { lb_cleanup2(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup2(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  
  zeropayloadcheckedrecords_token output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context3;
static void lb_cleanup3(lb_context3 *ctx) {
  zeropayloadcheckedrecords_token_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute3(lb_context3 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = zeropayloadcheckedrecords_produce_token(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from6(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args3, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call3) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "produceToken";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public produceToken\n", stderr);

  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context3) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context3 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute3(ctx, args, return_value); }
  zend_catch { lb_cleanup3(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup3(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  
  zeropayloadcheckedrecords_witness output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context4;
static void lb_cleanup4(lb_context4 *ctx) {
  zeropayloadcheckedrecords_witness_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute4(lb_context4 *ctx, zval *args, zval *out) {
  (void)args;

  ctx->status = zeropayloadcheckedrecords_produce_witness(&ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from1(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args4, 0, 0, 0)

ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call4) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "produceWitness";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public produceWitness\n", stderr);

  if (ZEND_NUM_ARGS() != 0) { zend_argument_count_error("Expected exactly 0 arguments"); RETURN_THROWS(); }
  zval args[1];
  
  if (sizeof(lb_context4) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context4 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute4(ctx, args, return_value); }
  zend_catch { lb_cleanup4(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup4(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}

typedef struct {
  lb_scope scope;
  zeropayloadcheckedrecords_nat input0;
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span output;
  zeropayloadcheckedrecords_error error;
  int status;
} lb_context5;
static void lb_cleanup5(lb_context5 *ctx) {
  zeropayloadcheckedrecords_array_lean_zero_payload_checked_records_witness_span_clear(&ctx->output);
  lb_scope_clear(&ctx->scope); LB_ZEND_FREE(ctx);
}
static void lb_execute5(lb_context5 *ctx, zval *args, zval *out) {
  (void)args;
  if (!lb_to7(&args[0], &ctx->input0, &ctx->scope)) return;
  ctx->status = zeropayloadcheckedrecords_witnesses(&ctx->input0, &ctx->output, &ctx->error);
  if (ctx->status) return;
  (void)lb_from8(&ctx->output, out, &ctx->scope);
}
ZEND_BEGIN_ARG_INFO_EX(lb_args5, 0, 0, 1)
  ZEND_ARG_INFO(0, arg0)
ZEND_END_ARG_INFO()
static ZEND_FUNCTION(lb_call5) {
  const char *lb_probe_public_scope __attribute__((cleanup(lb_probe_end))) = "witnesses";
  fputs("LB_SUBTYPE_ENTRY_V1 begin public witnesses\n", stderr);

  if (ZEND_NUM_ARGS() != 1) { zend_argument_count_error("Expected exactly 1 arguments"); RETURN_THROWS(); }
  zval args[1];
  if (zend_get_parameters_array_ex(1, args) != SUCCESS) RETURN_THROWS();
  if (sizeof(lb_context5) > 16 * 1024 * 1024) { zend_value_error("Zend call context exceeds the conversion limit"); RETURN_THROWS(); }
  lb_context5 *ctx = LB_ZEND_CALLOC(1, sizeof(*ctx));
  if (!ctx) { zend_throw_error(NULL, "Zend call allocation failed"); RETURN_THROWS(); }
  ctx->scope.remaining = 16 * 1024 * 1024 - sizeof(*ctx);
  ZVAL_NULL(return_value);
  zend_try { lb_execute5(ctx, args, return_value); }
  zend_catch { lb_cleanup5(ctx); zend_bailout(); }
  zend_end_try();
  const char *message = ctx->scope.error; int type_error = ctx->scope.type_error;
  int status = ctx->status;
  /* Error text may belong to the native result. Copy it before releasing owners. */
  char native_message[16385];
  if (status) {
    size_t length = ctx->error.message ? ctx->error.message_length : 0;
    if (length > sizeof(native_message) - 1) length = sizeof(native_message) - 1;
    if (!lb_readable(&ctx->scope, ctx->error.message, length, 1, 1)) message = ctx->scope.error;
    else {
      if (length) memcpy(native_message, ctx->error.message, length);
      native_message[length] = 0;
      message = length ? native_message : "Compiled Lean call failed";
    }
  }
  lb_cleanup5(ctx);
  if (message) {
    zval_ptr_dtor(return_value); ZVAL_NULL(return_value);
    if (type_error) zend_type_error("%s", message);
    else if (status) zend_throw_exception(zend_ce_exception, message, status);
    else zend_value_error("%s", message);
    RETURN_THROWS();
  }
}



static const zend_function_entry lb_functions[] = {
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call0, zif_lb_call0, lb_args0)
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call1, zif_lb_call1, lb_args1)
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call2, zif_lb_call2, lb_args2)
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call3, zif_lb_call3, lb_args3)
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call4, zif_lb_call4, lb_args4)
  ZEND_NS_NAMED_FE("LeanZeropayloadcheckedrecords\\Internal\\Zendda5284b36e9fac0c", call5, zif_lb_call5, lb_args5)

  PHP_FE_END
};
zend_module_entry lb_zeropayloadcheckedrecords_da5284b36e9fac0c_module_entry = {
  STANDARD_MODULE_HEADER, "lb_zeropayloadcheckedrecords_da5284b36e9fac0c", lb_functions,
  NULL, NULL, NULL, NULL, NULL, "1", STANDARD_MODULE_PROPERTIES
};
ZEND_GET_MODULE(lb_zeropayloadcheckedrecords_da5284b36e9fac0c)
